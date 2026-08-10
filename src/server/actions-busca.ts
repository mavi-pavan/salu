"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { exigirEdicao, SemPermissaoError } from "@/lib/authz";
import { buscaSchema, errosDoZod, objetoDoForm } from "@/lib/validation";
import type { EstadoForm } from "@/lib/form-state";
import type { ZonaChave } from "@/lib/zeu";
import { executarBusca, parametrosDaBusca } from "./busca";

export async function buscarNaInternet(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  let destino: string;

  try {
    const usuario = await exigirEdicao();

    // getAll: zonas e regiões chegam como múltiplos valores da mesma chave.
    const bruto = {
      ...objetoDoForm(formData),
      zonas: formData.getAll("zonas").map(String),
      regioes: formData.getAll("regioes").map(String),
      variacoes: formData.getAll("variacoes").map(String),
    };

    const analise = buscaSchema.safeParse(bruto);
    if (!analise.success) {
      return { ok: false, mensagem: "Revise os filtros.", erros: errosDoZod(analise.error) };
    }

    const dados = analise.data;
    const resumo = await executarBusca(
      {
        zonas: dados.zonas as ZonaChave[],
        regioes: dados.regioes,
        areaMin: dados.areaMin,
        areaMax: dados.areaMax,
        precoMax: dados.precoMax,
        termosExtras: dados.termosExtras,
        exigirArea: dados.exigirArea,
        exigirZonaConfirmada: dados.exigirZonaConfirmada,
        maxConsultas: dados.maxConsultas ?? 6,
        variacoes: dados.variacoes,
      },
      usuario.id,
    );

    destino = `/buscar/${resumo.buscaId}`;
  } catch (erro) {
    if (erro instanceof SemPermissaoError) return { ok: false, mensagem: erro.message };
    console.error(erro);
    return {
      ok: false,
      mensagem:
        erro instanceof Error
          ? `Falha na busca: ${erro.message}`
          : "Não foi possível concluir a busca.",
    };
  }

  revalidatePath("/buscar");
  redirect(destino);
}

export async function alternarDescarte(formData: FormData): Promise<void> {
  try {
    await exigirEdicao();
    const id = String(formData.get("resultadoId") ?? "");
    const atual = await prisma.resultadoBusca.findUnique({
      where: { id },
      select: { descartado: true, buscaId: true },
    });
    if (!atual) return;

    await prisma.resultadoBusca.update({
      where: { id },
      data: { descartado: !atual.descartado },
    });
    revalidatePath(`/buscar/${atual.buscaId}`);
  } catch (erro) {
    console.error(erro);
  }
}

export async function excluirBusca(formData: FormData): Promise<void> {
  let apagou = false;
  try {
    await exigirEdicao();
    const id = String(formData.get("buscaId") ?? "");
    if (!id) return;
    await prisma.busca.delete({ where: { id } });
    apagou = true;
  } catch (erro) {
    console.error(erro);
  }

  if (apagou) {
    revalidatePath("/buscar");
    redirect("/buscar");
  }
}

/**
 * Roda de novo uma busca já feita, com o mesmo filtro.
 *
 * É o que transforma prospecção em rotina: na segunda-feira ele abre a busca
 * da semana passada, clica, e a tela nova marca como "novo" só o que entrou no
 * mercado desde então. Preencher o formulário de memória toda semana era o
 * atrito que fazia isso não acontecer.
 */
export async function repetirBusca(formData: FormData): Promise<void> {
  let destino: string;

  try {
    const usuario = await exigirEdicao();
    const id = String(formData.get("buscaId") ?? "");
    if (!id) return;

    const anterior = await prisma.busca.findUnique({ where: { id } });
    if (!anterior) return;

    const resumo = await executarBusca(parametrosDaBusca(anterior), usuario.id);
    destino = `/buscar/${resumo.buscaId}`;
  } catch (erro) {
    console.error(erro);
    return;
  }

  revalidatePath("/buscar");
  redirect(destino);
}
