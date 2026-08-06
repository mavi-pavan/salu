import { z } from "zod";

import { ZONAS } from "./zeu";
import { VARIACOES } from "./busca/consultas";

/** "" -> null; aceita vírgula decimal digitada por engano. */
const paraNumero = (v: unknown): unknown => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const texto = String(v).trim();
  if (texto === "") return null;
  const n = Number(texto.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
};

const paraTexto = (v: unknown): unknown => {
  if (typeof v !== "string") return v ?? null;
  const t = v.trim();
  return t === "" ? null : t;
};

const paraBooleano = (v: unknown): unknown => v === "on" || v === "true" || v === true || v === "1";

const textoOpcional = (max: number) =>
  z.preprocess(paraTexto, z.string().max(max, `Máximo de ${max} caracteres`).nullable());

const numeroOpcional = (min: number, max: number) =>
  z.preprocess(
    paraNumero,
    z
      .number({ error: "Informe um número válido" })
      .min(min, `Mínimo ${min}`)
      .max(max, `Máximo ${max}`)
      .nullable(),
  );

const inteiroOpcional = (min: number, max: number) =>
  z.preprocess(
    paraNumero,
    z.number().int("Informe um número inteiro").min(min).max(max).nullable(),
  );

const booleano = z.preprocess(paraBooleano, z.boolean());

export const TOPOGRAFIAS = [
  "PLANA",
  "ACLIVE_LEVE",
  "DECLIVE_LEVE",
  "ACLIVE_ACENTUADO",
  "DECLIVE_ACENTUADO",
  "IRREGULAR",
  "NAO_INFORMADO",
] as const;

export const OCUPACOES = [
  "VAZIO",
  "EDIFICACAO_SIMPLES",
  "EDIFICACAO_RELEVANTE",
  "ALUGADO",
  "OCUPACAO_IRREGULAR",
  "NAO_INFORMADO",
] as const;

export const DOCUMENTAIS = [
  "REGULAR",
  "PENDENCIA_SIMPLES",
  "ESPOLIO_INVENTARIO",
  "LITIGIO_USUCAPIAO",
  "NAO_INFORMADO",
] as const;

export const ORIGENS = [
  "CORRETOR",
  "PROPRIETARIO",
  "PORTAL",
  "PROSPECCAO_ATIVA",
  "INDICACAO",
  "OUTRA",
] as const;

export const MOTIVACOES = ["ALTA", "MEDIA", "BAIXA", "NAO_INFORMADO"] as const;

export const STATUS_PIPELINE = [
  "NOVO",
  "EM_ANALISE",
  "VISITADO",
  "PROPOSTA_ENVIADA",
  "EM_NEGOCIACAO",
  "DUE_DILIGENCE",
  "CONTRATADO",
  "DESCARTADO",
  "PERDIDO",
] as const;

export const STATUS_DD = ["PENDENTE", "EM_ANDAMENTO", "OK", "PROBLEMA", "NAO_APLICAVEL"] as const;

export const TIPOS_NOTA = ["NOTA", "VISITA", "LIGACAO", "REUNIAO", "PROPOSTA"] as const;

export const PAPEIS = ["ADMIN", "MEMBRO", "LEITOR"] as const;

export const CATEGORIAS_DD = [
  "DOCUMENTAL",
  "VENDEDOR",
  "URBANISTICO",
  "AMBIENTAL",
  "INFRAESTRUTURA",
  "COMERCIAL",
  "FINANCEIRO",
] as const;

export const terrenoSchema = z
  .object({
    apelido: z.string().trim().min(3, "Dê um nome de pelo menos 3 letras").max(120),
    logradouro: z.string().trim().min(3, "Informe o logradouro").max(200),
    numero: textoOpcional(20),
    complemento: textoOpcional(120),
    bairro: textoOpcional(120),
    distrito: textoOpcional(120),
    cep: z.preprocess(
      paraTexto,
      z
        .string()
        .regex(/^\d{5}-?\d{3}$/, "CEP no formato 00000-000")
        .nullable(),
    ),
    latitude: numeroOpcional(-90, 90),
    longitude: numeroOpcional(-180, 180),
    sqlContribuinte: textoOpcional(30),

    zona: z.enum(ZONAS),
    zonaObservacao: textoOpcional(500),
    caBasico: numeroOpcional(0, 10),
    caMaximo: numeroOpcional(0, 20),

    areaTerreno: z.preprocess(
      paraNumero,
      z
        .number({ error: "Informe a área do terreno" })
        .positive("A área precisa ser maior que zero")
        .max(1_000_000, "Área acima do razoável"),
    ),
    testada: numeroOpcional(0, 5_000),
    profundidade: numeroOpcional(0, 5_000),
    numeroLotes: z.preprocess(paraNumero, z.number().int().min(1).max(200).nullable()),
    numeroMatriculas: z.preprocess(paraNumero, z.number().int().min(1).max(200).nullable()),
    topografia: z.enum(TOPOGRAFIAS),
    ocupacao: z.enum(OCUPACOES),

    estacaoProxima: textoOpcional(120),
    linhaTransporte: textoOpcional(120),
    distanciaEstacaoM: inteiroOpcional(0, 50_000),

    precoPedido: numeroOpcional(0, 10_000_000_000),
    valorVenalM2: numeroOpcional(0, 1_000_000),
    aceitaPermuta: booleano,
    percentualPermuta: numeroOpcional(0, 100),
    origem: z.enum(ORIGENS),
    motivacaoVendedor: z.enum(MOTIVACOES),
    contatoNome: textoOpcional(120),
    contatoTelefone: textoOpcional(40),
    contatoEmail: z.preprocess(paraTexto, z.email("E-mail inválido").nullable()),

    situacaoDocumental: z.enum(DOCUMENTAIS),

    tombado: booleano,
    zepecEntorno: booleano,
    areaContaminada: booleano,
    melhoramentoViario: booleano,
    areaPreservacao: booleano,
    servidao: booleano,
    restricaoAeroportuaria: booleano,
    restricoesObservacao: textoOpcional(1000),

    status: z.enum(STATUS_PIPELINE),
    responsavelId: textoOpcional(40),
    observacoes: textoOpcional(4000),
  })
  .superRefine((dados, ctx) => {
    if (dados.caBasico != null && dados.caMaximo != null && dados.caMaximo < dados.caBasico) {
      ctx.addIssue({
        code: "custom",
        path: ["caMaximo"],
        message: "O CA máximo não pode ser menor que o básico",
      });
    }
    if (dados.aceitaPermuta && dados.percentualPermuta == null) {
      ctx.addIssue({
        code: "custom",
        path: ["percentualPermuta"],
        message: "Informe o percentual de permuta",
      });
    }
    if (
      dados.latitude != null &&
      dados.longitude == null
    ) {
      ctx.addIssue({ code: "custom", path: ["longitude"], message: "Informe também a longitude" });
    }
    if (dados.longitude != null && dados.latitude == null) {
      ctx.addIssue({ code: "custom", path: ["latitude"], message: "Informe também a latitude" });
    }
  });

export type TerrenoEntrada = z.infer<typeof terrenoSchema>;

export const notaSchema = z.object({
  terrenoId: z.string().min(1),
  tipo: z.enum(TIPOS_NOTA),
  corpo: z.string().trim().min(2, "Escreva alguma coisa").max(4000),
});

export const documentoSchema = z.object({
  terrenoId: z.string().min(1),
  nome: z.string().trim().min(2, "Dê um nome ao documento").max(160),
  url: z.url("Cole um link válido (https://...)"),
  categoria: z.preprocess(paraTexto, z.enum(CATEGORIAS_DD).nullable()),
});

export const itemDDSchema = z.object({
  itemId: z.string().min(1),
  status: z.enum(STATUS_DD),
  responsavelId: textoOpcional(40),
  prazo: z.preprocess(paraTexto, z.string().nullable()),
  observacao: textoOpcional(2000),
});

export const conviteSchema = z.object({
  email: z.email("E-mail inválido").transform((e) => e.toLowerCase()),
  papel: z.enum(PAPEIS),
});

export const statusSchema = z.object({
  terrenoId: z.string().min(1),
  status: z.enum(STATUS_PIPELINE),
});

const peso = z.preprocess(paraNumero, z.number().min(0).max(100));

/** Escrito campo a campo de propósito: o tipo inferido vira a fonte da verdade. */
export const pesosSchema = z.object({
  preco_potencial: peso,
  area: peso,
  restricoes: peso,
  zona: peso,
  testada: peso,
  distancia_estacao: peso,
  documental: peso,
  topografia: peso,
  ocupacao: peso,
  vendedor: peso,
});

const premissaPct = z.preprocess(paraNumero, z.number().min(0).max(100));
const premissaValor = z.preprocess(paraNumero, z.number().min(0).max(1_000_000));

export const premissasSchema = z.object({
  eficienciaPrivativa: premissaPct,
  fatorAreaTotal: z.preprocess(paraNumero, z.number().min(1).max(4)),
  areaMediaUnidadeM2: z.preprocess(paraNumero, z.number().min(10).max(1000)),
  precoVendaM2: premissaValor,
  custoObraM2: premissaValor,
  fatorAreaEquivalente: z.preprocess(paraNumero, z.number().min(0.1).max(2)),
  custosIndiretosPctVGV: premissaPct,
  comissaoMarketingPctVGV: premissaPct,
  impostosPctVGV: premissaPct,
  fatorSocial: z.preprocess(paraNumero, z.number().min(0).max(2)),
  fatorPlanejamento: z.preprocess(paraNumero, z.number().min(0).max(2)),
  itbiPct: premissaPct,
  margemAlvoPct: premissaPct,
});

export const buscaSchema = z
  .object({
    zonas: z.array(z.enum(ZONAS)).max(12),
    regioes: z.array(z.string().max(80)).max(20),
    variacoes: z.array(z.enum(VARIACOES)).max(3),
    areaMin: numeroOpcional(0, 1_000_000),
    areaMax: numeroOpcional(0, 1_000_000),
    precoMax: numeroOpcional(0, 10_000_000_000),
    termosExtras: textoOpcional(160),
    exigirArea: booleano,
    exigirZonaConfirmada: booleano,
    maxConsultas: z.preprocess(paraNumero, z.number().int().min(1).max(20).nullable()),
  })
  .superRefine((dados, ctx) => {
    if (dados.areaMin != null && dados.areaMax != null && dados.areaMax < dados.areaMin) {
      ctx.addIssue({
        code: "custom",
        path: ["areaMax"],
        message: "A área máxima precisa ser maior que a mínima",
      });
    }
    if (dados.areaMin == null && dados.areaMax == null) {
      ctx.addIssue({
        code: "custom",
        path: ["areaMin"],
        message: "Informe pelo menos a área mínima",
      });
    }
  });

/** FormData -> objeto simples. Checkbox ausente vira `false` no preprocess. */
export function objetoDoForm(formData: FormData): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of formData.entries()) {
    if (valor instanceof File) continue;
    saida[chave] = valor;
  }
  return saida;
}

export type ErrosCampo = Record<string, string>;

/** Achata os issues do Zod em { campo: "mensagem" } para renderizar no formulário. */
export function errosDoZod(erro: z.ZodError): ErrosCampo {
  const saida: ErrosCampo = {};
  for (const issue of erro.issues) {
    const campo = issue.path.join(".") || "_";
    if (!saida[campo]) saida[campo] = issue.message;
  }
  return saida;
}
