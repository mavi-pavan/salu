"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { signOut } from "@/auth";
import { exigirAdmin, exigirEdicao, exigirUsuario, SemPermissaoError } from "@/lib/authz";
import { CHECKLIST_PADRAO } from "@/lib/due-diligence";
import { normalizarPesos, type Pesos } from "@/lib/scoring";
import { normalizarPremissas, PREMISSAS_PERCENTUAIS, type Premissas } from "@/lib/viabilidade";
import {
  conviteSchema,
  documentoSchema,
  errosDoZod,
  itemDDSchema,
  notaSchema,
  objetoDoForm,
  pesosSchema,
  premissasSchema,
  statusSchema,
  terrenoSchema,
  type ErrosCampo,
  type TerrenoEntrada,
} from "@/lib/validation";
import type { EstadoForm } from "@/lib/form-state";
import { camposScore, obterConfiguracao } from "./queries";

function falha(mensagem: string, erros?: ErrosCampo): EstadoForm {
  return { ok: false, mensagem, erros };
}

/** Converte exceção de permissão em estado de formulário em vez de tela de erro. */
function tratarErro(erro: unknown): EstadoForm {
  if (erro instanceof SemPermissaoError) return falha(erro.message);
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    return falha("Já existe um registro com esse valor único.");
  }
  console.error(erro);
  return falha("Não foi possível concluir a operação. Tente de novo.");
}

/**
 * `detalhe` aceita qualquer objeto serializável — a conversão para o tipo Json
 * do Prisma fica concentrada aqui em vez de espalhada por cada chamada.
 */
async function registrar(usuarioId: string, acao: string, terrenoId?: string | null, detalhe?: unknown) {
  await prisma.evento.create({
    data: {
      usuarioId,
      acao,
      terrenoId: terrenoId ?? null,
      detalhe: detalhe === undefined ? undefined : (detalhe as Prisma.InputJsonValue),
    },
  });
}

// ---------------------------------------------------------------------------
// Terrenos
// ---------------------------------------------------------------------------

/** TER-0001, TER-0002... legível em conversa e estável no tempo. */
async function proximoCodigo(): Promise<string> {
  const ultimo = await prisma.terreno.findFirst({
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  });
  const numero = ultimo ? Number.parseInt(ultimo.codigo.replace(/\D/g, ""), 10) : 0;
  return `TER-${String((Number.isFinite(numero) ? numero : 0) + 1).padStart(4, "0")}`;
}

function dadosPersistiveis(dados: TerrenoEntrada, pesos: Pesos) {
  const base = {
    apelido: dados.apelido,
    logradouro: dados.logradouro,
    numero: dados.numero,
    complemento: dados.complemento,
    bairro: dados.bairro,
    distrito: dados.distrito,
    cep: dados.cep,
    latitude: dados.latitude,
    longitude: dados.longitude,
    sqlContribuinte: dados.sqlContribuinte,
    zona: dados.zona,
    zonaObservacao: dados.zonaObservacao,
    caBasico: dados.caBasico,
    caMaximo: dados.caMaximo,
    areaTerreno: dados.areaTerreno,
    testada: dados.testada,
    profundidade: dados.profundidade,
    numeroLotes: dados.numeroLotes ?? 1,
    numeroMatriculas: dados.numeroMatriculas ?? 1,
    topografia: dados.topografia,
    ocupacao: dados.ocupacao,
    estacaoProxima: dados.estacaoProxima,
    linhaTransporte: dados.linhaTransporte,
    distanciaEstacaoM: dados.distanciaEstacaoM,
    precoPedido: dados.precoPedido,
    valorVenalM2: dados.valorVenalM2,
    aceitaPermuta: dados.aceitaPermuta,
    percentualPermuta: dados.percentualPermuta,
    origem: dados.origem,
    motivacaoVendedor: dados.motivacaoVendedor,
    contatoNome: dados.contatoNome,
    contatoTelefone: dados.contatoTelefone,
    contatoEmail: dados.contatoEmail,
    situacaoDocumental: dados.situacaoDocumental,
    tombado: dados.tombado,
    zepecEntorno: dados.zepecEntorno,
    areaContaminada: dados.areaContaminada,
    melhoramentoViario: dados.melhoramentoViario,
    areaPreservacao: dados.areaPreservacao,
    servidao: dados.servidao,
    restricaoAeroportuaria: dados.restricaoAeroportuaria,
    restricoesObservacao: dados.restricoesObservacao,
    status: dados.status,
    responsavelId: dados.responsavelId,
    observacoes: dados.observacoes,
  };

  return { ...base, ...camposScore(base, pesos) };
}

export async function criarTerreno(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  let destino: string;

  try {
    const usuario = await exigirEdicao();
    const analise = terrenoSchema.safeParse(objetoDoForm(formData));
    if (!analise.success) {
      return falha("Revise os campos destacados.", errosDoZod(analise.error));
    }

    const { pesos } = await obterConfiguracao();
    const codigo = await proximoCodigo();

    const terreno = await prisma.terreno.create({
      data: {
        ...dadosPersistiveis(analise.data, pesos),
        codigo,
        criadoPorId: usuario.id,
        itensDD: {
          create: CHECKLIST_PADRAO.map((item, indice) => ({
            chave: item.chave,
            categoria: item.categoria,
            titulo: item.titulo,
            descricao: item.descricao ?? null,
            critico: item.critico ?? false,
            ordem: indice,
          })),
        },
      },
      select: { id: true, codigo: true, apelido: true },
    });

    await registrar(usuario.id, "terreno.criado", terreno.id, {
      codigo: terreno.codigo,
      apelido: terreno.apelido,
    });

    // Cadastro veio de um anúncio encontrado na busca: amarra os dois e guarda
    // o link do anúncio como documento, que é a fonte do dado.
    const resultadoId = String(formData.get("resultadoId") ?? "");
    if (resultadoId) {
      const resultado = await prisma.resultadoBusca.findUnique({
        where: { id: resultadoId },
        select: { id: true, url: true, fonte: true, titulo: true },
      });
      if (resultado) {
        await prisma.resultadoBusca.update({
          where: { id: resultado.id },
          data: { terrenoId: terreno.id },
        });
        await prisma.documento.create({
          data: {
            terrenoId: terreno.id,
            nome: `Anúncio original (${resultado.fonte})`,
            url: resultado.url,
            categoria: "COMERCIAL",
            adicionadoPorId: usuario.id,
          },
        });
        await prisma.nota.create({
          data: {
            terrenoId: terreno.id,
            autorId: usuario.id,
            tipo: "NOTA",
            corpo: `Importado da prospecção automática.\n\n${resultado.titulo}\n${resultado.url}`,
          },
        });
      }
    }

    destino = `/terrenos/${terreno.id}`;
  } catch (erro) {
    return tratarErro(erro);
  }

  revalidatePath("/terrenos");
  revalidatePath("/painel");
  redirect(destino);
}

export async function atualizarTerreno(
  id: string,
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  let destino: string;

  try {
    const usuario = await exigirEdicao();
    const analise = terrenoSchema.safeParse(objetoDoForm(formData));
    if (!analise.success) {
      return falha("Revise os campos destacados.", errosDoZod(analise.error));
    }

    const anterior = await prisma.terreno.findUnique({
      where: { id },
      select: { precoPedido: true, status: true, areaTerreno: true, zona: true },
    });
    if (!anterior) return falha("Terreno não encontrado.");

    const { pesos } = await obterConfiguracao();
    await prisma.terreno.update({
      where: { id },
      data: dadosPersistiveis(analise.data, pesos),
    });

    const mudancas: Record<string, { de: unknown; para: unknown }> = {};
    if (anterior.precoPedido !== analise.data.precoPedido) {
      mudancas.precoPedido = { de: anterior.precoPedido, para: analise.data.precoPedido };
    }
    if (anterior.status !== analise.data.status) {
      mudancas.status = { de: anterior.status, para: analise.data.status };
    }
    if (anterior.zona !== analise.data.zona) {
      mudancas.zona = { de: anterior.zona, para: analise.data.zona };
    }
    if (anterior.areaTerreno !== analise.data.areaTerreno) {
      mudancas.areaTerreno = { de: anterior.areaTerreno, para: analise.data.areaTerreno };
    }

    await registrar(usuario.id, "terreno.editado", id, mudancas);
    destino = `/terrenos/${id}`;
  } catch (erro) {
    return tratarErro(erro);
  }

  revalidatePath("/terrenos");
  revalidatePath(`/terrenos/${id}`);
  redirect(destino);
}

export async function mudarStatus(formData: FormData): Promise<void> {
  try {
    const usuario = await exigirEdicao();
    const analise = statusSchema.safeParse(objetoDoForm(formData));
    if (!analise.success) return;

    const { terrenoId, status } = analise.data;
    const atual = await prisma.terreno.findUnique({
      where: { id: terrenoId },
      select: { status: true },
    });
    if (!atual || atual.status === status) return;

    await prisma.terreno.update({ where: { id: terrenoId }, data: { status } });
    await registrar(usuario.id, "terreno.status", terrenoId, { de: atual.status, para: status });

    revalidatePath(`/terrenos/${terrenoId}`);
    revalidatePath("/terrenos");
    revalidatePath("/painel");
  } catch (erro) {
    console.error(erro);
  }
}

export async function alternarArquivo(formData: FormData): Promise<void> {
  try {
    const usuario = await exigirEdicao();
    const id = String(formData.get("terrenoId") ?? "");
    const terreno = await prisma.terreno.findUnique({
      where: { id },
      select: { arquivado: true },
    });
    if (!terreno) return;

    await prisma.terreno.update({ where: { id }, data: { arquivado: !terreno.arquivado } });
    await registrar(usuario.id, terreno.arquivado ? "terreno.desarquivado" : "terreno.arquivado", id);

    revalidatePath("/terrenos");
    revalidatePath(`/terrenos/${id}`);
  } catch (erro) {
    console.error(erro);
  }
}

export async function excluirTerreno(formData: FormData): Promise<void> {
  let apagou = false;
  try {
    const usuario = await exigirAdmin();
    const id = String(formData.get("terrenoId") ?? "");
    const terreno = await prisma.terreno.findUnique({ where: { id }, select: { codigo: true } });
    if (!terreno) return;

    await prisma.terreno.delete({ where: { id } });
    await registrar(usuario.id, "terreno.excluido", null, { codigo: terreno.codigo });
    apagou = true;
  } catch (erro) {
    console.error(erro);
  }

  if (apagou) {
    revalidatePath("/terrenos");
    revalidatePath("/painel");
    redirect("/terrenos");
  }
}

/** Premissas de viabilidade específicas de um terreno (sobrepõem o padrão). */
export async function salvarPremissasTerreno(
  terrenoId: string,
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  try {
    const usuario = await exigirEdicao();

    if (formData.get("restaurarPadrao") === "1") {
      await prisma.terreno.update({ where: { id: terrenoId }, data: { premissas: Prisma.DbNull } });
      await registrar(usuario.id, "terreno.premissas_restauradas", terrenoId);
      revalidatePath(`/terrenos/${terrenoId}`);
      return { ok: true, mensagem: "Premissas voltaram ao padrão da equipe." };
    }

    const analise = premissasSchema.safeParse(objetoDoForm(formData));
    if (!analise.success) {
      return falha("Revise as premissas.", errosDoZod(analise.error));
    }

    await prisma.terreno.update({
      where: { id: terrenoId },
      data: { premissas: paraPremissasArmazenadas(analise.data) as unknown as Prisma.InputJsonValue },
    });
    await registrar(usuario.id, "terreno.premissas", terrenoId);

    revalidatePath(`/terrenos/${terrenoId}`);
    return { ok: true, mensagem: "Premissas salvas para este terreno." };
  } catch (erro) {
    return tratarErro(erro);
  }
}

// ---------------------------------------------------------------------------
// Due diligence
// ---------------------------------------------------------------------------

export async function atualizarItemDD(formData: FormData): Promise<void> {
  try {
    const usuario = await exigirEdicao();
    const analise = itemDDSchema.safeParse(objetoDoForm(formData));
    if (!analise.success) return;

    const { itemId, status, responsavelId, prazo, observacao } = analise.data;
    const item = await prisma.itemDueDiligence.findUnique({
      where: { id: itemId },
      select: { terrenoId: true, status: true, titulo: true },
    });
    if (!item) return;

    await prisma.itemDueDiligence.update({
      where: { id: itemId },
      data: {
        status,
        responsavelId: responsavelId || null,
        prazo: prazo ? new Date(prazo) : null,
        observacao,
        concluidoEm: status === "OK" ? new Date() : null,
      },
    });

    if (item.status !== status) {
      await registrar(usuario.id, "dd.status", item.terrenoId, {
        item: item.titulo,
        de: item.status,
        para: status,
      });
    }

    revalidatePath(`/terrenos/${item.terrenoId}`);
    revalidatePath("/painel");
  } catch (erro) {
    console.error(erro);
  }
}

/** Cria no terreno os itens que passaram a existir no template depois do cadastro. */
export async function sincronizarChecklist(formData: FormData): Promise<void> {
  try {
    const usuario = await exigirEdicao();
    const terrenoId = String(formData.get("terrenoId") ?? "");

    const existentes = await prisma.itemDueDiligence.findMany({
      where: { terrenoId },
      select: { chave: true },
    });
    const chaves = new Set(existentes.map((i) => i.chave));
    const faltantes = CHECKLIST_PADRAO.map((item, indice) => ({ item, indice })).filter(
      ({ item }) => !chaves.has(item.chave),
    );
    if (!faltantes.length) return;

    await prisma.itemDueDiligence.createMany({
      data: faltantes.map(({ item, indice }) => ({
        terrenoId,
        chave: item.chave,
        categoria: item.categoria,
        titulo: item.titulo,
        descricao: item.descricao ?? null,
        critico: item.critico ?? false,
        ordem: indice,
      })),
      skipDuplicates: true,
    });

    await registrar(usuario.id, "dd.sincronizado", terrenoId, { adicionados: faltantes.length });
    revalidatePath(`/terrenos/${terrenoId}`);
  } catch (erro) {
    console.error(erro);
  }
}

// ---------------------------------------------------------------------------
// Notas e documentos
// ---------------------------------------------------------------------------

export async function adicionarNota(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  try {
    const usuario = await exigirEdicao();
    const analise = notaSchema.safeParse(objetoDoForm(formData));
    if (!analise.success) {
      return falha("Revise a nota.", errosDoZod(analise.error));
    }

    const { terrenoId, tipo, corpo } = analise.data;
    await prisma.nota.create({ data: { terrenoId, tipo, corpo, autorId: usuario.id } });
    await registrar(usuario.id, "nota.criada", terrenoId, { tipo });

    revalidatePath(`/terrenos/${terrenoId}`);
    return { ok: true, mensagem: "Nota registrada." };
  } catch (erro) {
    return tratarErro(erro);
  }
}

export async function adicionarDocumento(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  try {
    const usuario = await exigirEdicao();
    const analise = documentoSchema.safeParse(objetoDoForm(formData));
    if (!analise.success) {
      return falha("Revise o documento.", errosDoZod(analise.error));
    }

    const { terrenoId, nome, url, categoria } = analise.data;
    await prisma.documento.create({
      data: { terrenoId, nome, url, categoria, adicionadoPorId: usuario.id },
    });
    await registrar(usuario.id, "documento.adicionado", terrenoId, { nome });

    revalidatePath(`/terrenos/${terrenoId}`);
    return { ok: true, mensagem: "Documento adicionado." };
  } catch (erro) {
    return tratarErro(erro);
  }
}

export async function removerDocumento(formData: FormData): Promise<void> {
  try {
    const usuario = await exigirEdicao();
    const id = String(formData.get("documentoId") ?? "");
    const doc = await prisma.documento.findUnique({
      where: { id },
      select: { terrenoId: true, nome: true },
    });
    if (!doc) return;

    await prisma.documento.delete({ where: { id } });
    await registrar(usuario.id, "documento.removido", doc.terrenoId, { nome: doc.nome });
    revalidatePath(`/terrenos/${doc.terrenoId}`);
  } catch (erro) {
    console.error(erro);
  }
}

// ---------------------------------------------------------------------------
// Configuração (admin)
// ---------------------------------------------------------------------------

/** Percentuais são digitados como 20 e guardados como 0,20. */
function paraPremissasArmazenadas(entrada: Record<string, number>): Premissas {
  const convertido: Record<string, number> = { ...entrada };
  for (const chave of PREMISSAS_PERCENTUAIS) {
    if (typeof convertido[chave] === "number") convertido[chave] = convertido[chave] / 100;
  }
  return normalizarPremissas(convertido);
}

export async function salvarConfiguracao(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  try {
    const usuario = await exigirAdmin();
    const dados = objetoDoForm(formData);

    const analisePesos = pesosSchema.safeParse(dados);
    const analisePremissas = premissasSchema.safeParse(dados);
    if (!analisePesos.success || !analisePremissas.success) {
      return falha("Revise os valores.", {
        ...(analisePesos.success ? {} : errosDoZod(analisePesos.error)),
        ...(analisePremissas.success ? {} : errosDoZod(analisePremissas.error)),
      });
    }

    const pesos = normalizarPesos(analisePesos.data);
    const premissas = paraPremissasArmazenadas(analisePremissas.data);

    await prisma.configuracao.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        pesos: pesos as unknown as Prisma.InputJsonValue,
        premissas: premissas as unknown as Prisma.InputJsonValue,
        atualizadoPor: usuario.id,
      },
      update: {
        pesos: pesos as unknown as Prisma.InputJsonValue,
        premissas: premissas as unknown as Prisma.InputJsonValue,
        atualizadoPor: usuario.id,
      },
    });

    const recalculados = await recalcularTodosOsScores(pesos);
    await registrar(usuario.id, "config.salva", null, { recalculados });

    revalidatePath("/configuracoes");
    revalidatePath("/terrenos");
    revalidatePath("/painel");
    return {
      ok: true,
      mensagem: `Configuração salva. ${recalculados} terreno(s) repontuado(s).`,
    };
  } catch (erro) {
    return tratarErro(erro);
  }
}

/**
 * Mudar peso muda o ranking de todo mundo. Como o score fica em cache na
 * tabela (para permitir ordenar e filtrar no banco), ele precisa ser
 * reescrito sempre que os pesos mudam.
 */
async function recalcularTodosOsScores(pesos: Pesos): Promise<number> {
  const terrenos = await prisma.terreno.findMany();
  await prisma.$transaction(
    terrenos.map((t) =>
      prisma.terreno.update({ where: { id: t.id }, data: camposScore(t, pesos) }),
    ),
  );
  return terrenos.length;
}

// ---------------------------------------------------------------------------
// Membros (admin)
// ---------------------------------------------------------------------------

export async function convidarMembro(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  try {
    const usuario = await exigirAdmin();
    const analise = conviteSchema.safeParse(objetoDoForm(formData));
    if (!analise.success) {
      return falha("Revise o convite.", errosDoZod(analise.error));
    }

    const { email, papel } = analise.data;
    const jaExiste = await prisma.user.findUnique({ where: { email } });
    if (jaExiste) return falha("Esse e-mail já tem conta no app.");

    await prisma.convite.upsert({
      where: { email },
      create: { email, papel, autorId: usuario.id },
      update: { papel, autorId: usuario.id },
    });
    await registrar(usuario.id, "convite.criado", null, { email, papel });

    revalidatePath("/configuracoes");
    return {
      ok: true,
      mensagem: `${email} liberado. Peça para entrar em /entrar com esse e-mail.`,
    };
  } catch (erro) {
    return tratarErro(erro);
  }
}

export async function removerConvite(formData: FormData): Promise<void> {
  try {
    const usuario = await exigirAdmin();
    const id = String(formData.get("conviteId") ?? "");
    const convite = await prisma.convite.findUnique({ where: { id }, select: { email: true } });
    if (!convite) return;

    await prisma.convite.delete({ where: { id } });
    await registrar(usuario.id, "convite.removido", null, { email: convite.email });
    revalidatePath("/configuracoes");
  } catch (erro) {
    console.error(erro);
  }
}

export async function alterarMembro(formData: FormData): Promise<void> {
  try {
    const usuario = await exigirAdmin();
    const id = String(formData.get("usuarioId") ?? "");
    const papel = String(formData.get("papel") ?? "");
    const ativo = formData.get("ativo");

    const alvo = await prisma.user.findUnique({
      where: { id },
      select: { email: true, papel: true, ativo: true },
    });
    if (!alvo) return;

    // Trava de segurança: não deixar a conta ficar sem nenhum administrador.
    if (alvo.papel === "ADMIN" && papel && papel !== "ADMIN") {
      const admins = await prisma.user.count({ where: { papel: "ADMIN", ativo: true } });
      if (admins <= 1) return;
    }
    if (id === usuario.id && ativo === "false") return;

    await prisma.user.update({
      where: { id },
      data: {
        papel: papel === "ADMIN" || papel === "MEMBRO" || papel === "LEITOR" ? papel : undefined,
        ativo: ativo == null ? undefined : ativo === "true",
      },
    });
    await registrar(usuario.id, "membro.alterado", null, {
      email: alvo.email,
      papel,
      ativo: ativo == null ? null : String(ativo),
    });

    revalidatePath("/configuracoes");
  } catch (erro) {
    console.error(erro);
  }
}

export async function sair(): Promise<void> {
  await exigirUsuario();
  await signOut({ redirectTo: "/entrar" });
}
