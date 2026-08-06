import "server-only";

import { Prisma, type Terreno } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CHECKLIST_PADRAO } from "@/lib/due-diligence";
import {
  calcularScore,
  normalizarPesos,
  type EntradaScore,
  type Pesos,
  type ResultadoScore,
} from "@/lib/scoring";
import { normalizarPremissas, type Premissas } from "@/lib/viabilidade";
import type { StatusPipeline } from "@/lib/enums";
import type { ZonaChave } from "@/lib/zeu";

/**
 * O volume aqui é de dezenas a poucas centenas de terrenos — um time de 3 a 6
 * pessoas prospectando. Por isso várias ordenações e métricas derivadas são
 * calculadas em memória: é mais simples de ler e de manter do que SQL
 * equivalente, e a diferença de desempenho nesta escala é irrelevante.
 */
const LIMITE_LISTAGEM = 500;

// ---------------------------------------------------------------------------
// Configuração global
// ---------------------------------------------------------------------------

export interface ConfiguracaoApp {
  pesos: Pesos;
  premissas: Premissas;
  atualizadoEm: Date | null;
}

export async function obterConfiguracao(): Promise<ConfiguracaoApp> {
  const registro = await prisma.configuracao.findUnique({ where: { id: "global" } });
  return {
    pesos: normalizarPesos((registro?.pesos as Record<string, unknown>) ?? {}),
    premissas: normalizarPremissas(registro?.premissas),
    atualizadoEm: registro?.atualizadoEm ?? null,
  };
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

type DadosScore = Pick<
  Terreno,
  | "zona"
  | "areaTerreno"
  | "testada"
  | "precoPedido"
  | "caBasico"
  | "caMaximo"
  | "distanciaEstacaoM"
  | "topografia"
  | "ocupacao"
  | "situacaoDocumental"
  | "motivacaoVendedor"
  | "tombado"
  | "zepecEntorno"
  | "areaContaminada"
  | "melhoramentoViario"
  | "areaPreservacao"
  | "servidao"
  | "restricaoAeroportuaria"
>;

export function entradaScore(t: DadosScore): EntradaScore {
  return {
    zona: t.zona as ZonaChave,
    areaTerreno: t.areaTerreno,
    testada: t.testada,
    precoPedido: t.precoPedido,
    caBasico: t.caBasico,
    caMaximo: t.caMaximo,
    distanciaEstacaoM: t.distanciaEstacaoM,
    topografia: t.topografia,
    ocupacao: t.ocupacao,
    situacaoDocumental: t.situacaoDocumental,
    motivacaoVendedor: t.motivacaoVendedor,
    tombado: t.tombado,
    zepecEntorno: t.zepecEntorno,
    areaContaminada: t.areaContaminada,
    melhoramentoViario: t.melhoramentoViario,
    areaPreservacao: t.areaPreservacao,
    servidao: t.servidao,
    restricaoAeroportuaria: t.restricaoAeroportuaria,
  };
}

/** Campos de cache do score, prontos para ir no create/update. */
export function camposScore(dados: DadosScore, pesos: Pesos) {
  const resultado = calcularScore(entradaScore(dados), pesos);
  return {
    scoreTotal: resultado.total,
    scoreCobertura: resultado.cobertura,
    scoreDetalhe: resultado as unknown as Prisma.InputJsonValue,
  };
}

export function scoreArmazenado(t: Terreno): ResultadoScore | null {
  return (t.scoreDetalhe as unknown as ResultadoScore | null) ?? null;
}

// ---------------------------------------------------------------------------
// Listagem
// ---------------------------------------------------------------------------

export type Ordenacao = "score" | "recentes" | "preco_potencial" | "area" | "preco";

export interface FiltrosTerreno {
  q?: string;
  status?: StatusPipeline[];
  zona?: ZonaChave[];
  scoreMin?: number;
  areaMin?: number;
  precoMax?: number;
  responsavelId?: string;
  arquivados?: boolean;
  ordenar?: Ordenacao;
}

export type TerrenoListado = Terreno & {
  responsavel: { id: string; name: string | null; email: string } | null;
  _count: { itensDD: number; notas: number };
  /** Derivados calculados na leitura, não persistidos. */
  precoPorPotencial: number | null;
  precoPorM2: number | null;
  bloqueios: number;
};

export async function listarTerrenos(filtros: FiltrosTerreno = {}): Promise<TerrenoListado[]> {
  const where: Prisma.TerrenoWhereInput = {
    arquivado: filtros.arquivados ? undefined : false,
  };

  if (filtros.q) {
    const q = filtros.q.trim();
    where.OR = [
      { apelido: { contains: q, mode: "insensitive" } },
      { logradouro: { contains: q, mode: "insensitive" } },
      { bairro: { contains: q, mode: "insensitive" } },
      { codigo: { contains: q, mode: "insensitive" } },
      { sqlContribuinte: { contains: q, mode: "insensitive" } },
      { estacaoProxima: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filtros.status?.length) where.status = { in: filtros.status };
  if (filtros.zona?.length) where.zona = { in: filtros.zona };
  if (filtros.scoreMin != null) where.scoreTotal = { gte: filtros.scoreMin };
  if (filtros.areaMin != null) where.areaTerreno = { gte: filtros.areaMin };
  if (filtros.precoMax != null) where.precoPedido = { lte: filtros.precoMax };
  if (filtros.responsavelId) where.responsavelId = filtros.responsavelId;

  const registros = await prisma.terreno.findMany({
    where,
    include: {
      responsavel: { select: { id: true, name: true, email: true } },
      _count: { select: { itensDD: true, notas: true } },
    },
    take: LIMITE_LISTAGEM,
    orderBy: { updatedAt: "desc" },
  });

  const enriquecidos: TerrenoListado[] = registros.map((t) => {
    const detalhe = scoreArmazenado(t);
    return {
      ...t,
      precoPorPotencial: detalhe?.precoPorPotencial ?? null,
      precoPorM2: detalhe?.precoPorM2Terreno ?? null,
      bloqueios: detalhe?.alertas.filter((a) => a.nivel === "bloqueio").length ?? 0,
    };
  });

  return ordenar(enriquecidos, filtros.ordenar ?? "score");
}

function ordenar(lista: TerrenoListado[], criterio: Ordenacao): TerrenoListado[] {
  const copia = [...lista];
  switch (criterio) {
    case "recentes":
      return copia.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    case "area":
      return copia.sort((a, b) => b.areaTerreno - a.areaTerreno);
    case "preco":
      return copia.sort((a, b) => nuloPorUltimo(a.precoPedido, b.precoPedido, "asc"));
    case "preco_potencial":
      return copia.sort((a, b) => nuloPorUltimo(a.precoPorPotencial, b.precoPorPotencial, "asc"));
    case "score":
    default:
      return copia.sort((a, b) => (b.scoreTotal ?? -1) - (a.scoreTotal ?? -1));
  }
}

/** Registros sem o dado vão para o fim da lista, e não para o topo. */
function nuloPorUltimo(a: number | null, b: number | null, direcao: "asc" | "desc"): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direcao === "asc" ? a - b : b - a;
}

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------

export async function obterTerreno(id: string) {
  return prisma.terreno.findUnique({
    where: { id },
    include: {
      criadoPor: { select: { id: true, name: true, email: true } },
      responsavel: { select: { id: true, name: true, email: true } },
      itensDD: {
        orderBy: [{ categoria: "asc" }, { ordem: "asc" }],
        include: { responsavel: { select: { id: true, name: true, email: true } } },
      },
      notas: {
        orderBy: { createdAt: "desc" },
        include: { autor: { select: { id: true, name: true, email: true } } },
      },
      documentos: {
        orderBy: { createdAt: "desc" },
        include: { adicionadoPor: { select: { id: true, name: true, email: true } } },
      },
      eventos: {
        orderBy: { createdAt: "desc" },
        take: 60,
        include: { usuario: { select: { id: true, name: true, email: true } } },
      },
    },
  });
}

export type TerrenoDetalhado = NonNullable<Awaited<ReturnType<typeof obterTerreno>>>;

/** Itens do template que ainda não existem neste terreno (template evoluiu). */
export function itensFaltantes(itensExistentes: Array<{ chave: string }>): number {
  const existentes = new Set(itensExistentes.map((i) => i.chave));
  return CHECKLIST_PADRAO.filter((i) => !existentes.has(i.chave)).length;
}

export function progressoDD(itens: Array<{ status: string; critico: boolean }>) {
  const aplicaveis = itens.filter((i) => i.status !== "NAO_APLICAVEL");
  const concluidos = aplicaveis.filter((i) => i.status === "OK").length;
  const problemas = itens.filter((i) => i.status === "PROBLEMA");
  return {
    total: aplicaveis.length,
    concluidos,
    pendentes: aplicaveis.length - concluidos,
    problemas: problemas.length,
    problemasCriticos: problemas.filter((i) => i.critico).length,
    percentual: aplicaveis.length ? Math.round((concluidos / aplicaveis.length) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

export async function estatisticas() {
  const [ativos, porStatus, agregados, topScore, problemas, atividade] = await Promise.all([
    prisma.terreno.count({ where: { arquivado: false } }),
    prisma.terreno.groupBy({
      by: ["status"],
      where: { arquivado: false },
      _count: { _all: true },
    }),
    prisma.terreno.aggregate({
      where: { arquivado: false, status: { notIn: ["DESCARTADO", "PERDIDO"] } },
      _sum: { areaTerreno: true, precoPedido: true },
      _avg: { scoreTotal: true },
    }),
    prisma.terreno.findMany({
      where: { arquivado: false, status: { notIn: ["DESCARTADO", "PERDIDO"] } },
      orderBy: { scoreTotal: "desc" },
      take: 5,
      select: {
        id: true,
        codigo: true,
        apelido: true,
        bairro: true,
        zona: true,
        scoreTotal: true,
        scoreCobertura: true,
        areaTerreno: true,
        precoPedido: true,
        status: true,
      },
    }),
    prisma.itemDueDiligence.findMany({
      where: { status: "PROBLEMA", terreno: { arquivado: false } },
      take: 8,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        titulo: true,
        critico: true,
        categoria: true,
        terreno: { select: { id: true, codigo: true, apelido: true } },
      },
    }),
    prisma.evento.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: {
        usuario: { select: { name: true, email: true } },
        terreno: { select: { id: true, codigo: true, apelido: true } },
      },
    }),
  ]);

  const contagem = new Map<string, number>(porStatus.map((s) => [s.status, s._count._all]));

  return {
    ativos,
    contagemPorStatus: contagem,
    areaTotal: agregados._sum.areaTerreno ?? 0,
    valorEmAnalise: agregados._sum.precoPedido ?? 0,
    scoreMedio: agregados._avg.scoreTotal ?? 0,
    topScore,
    problemas,
    atividade,
  };
}

// ---------------------------------------------------------------------------
// Pessoas
// ---------------------------------------------------------------------------

export async function listarMembros() {
  return prisma.user.findMany({
    orderBy: [{ papel: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      papel: true,
      ativo: true,
      createdAt: true,
      emailVerified: true,
      _count: { select: { terrenosCriados: true } },
    },
  });
}

export async function listarConvites() {
  return prisma.convite.findMany({
    orderBy: { createdAt: "desc" },
    include: { autor: { select: { name: true, email: true } } },
  });
}

/** Terrenos com coordenada, no formato que o mapa consome. */
export async function terrenosComCoordenada() {
  const registros = await prisma.terreno.findMany({
    where: { arquivado: false, latitude: { not: null }, longitude: { not: null } },
    select: {
      id: true,
      codigo: true,
      apelido: true,
      bairro: true,
      zona: true,
      status: true,
      scoreTotal: true,
      areaTerreno: true,
      precoPedido: true,
      latitude: true,
      longitude: true,
      estacaoProxima: true,
    },
    take: LIMITE_LISTAGEM,
  });

  return registros.map((t) => ({
    ...t,
    latitude: t.latitude as number,
    longitude: t.longitude as number,
  }));
}

export type TerrenoMapa = Awaited<ReturnType<typeof terrenosComCoordenada>>[number];
