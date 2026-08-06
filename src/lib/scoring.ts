/**
 * Pontuação objetiva de terrenos.
 *
 * A ideia é simples e proposital: cada critério vira uma nota de 0 a 10 por
 * faixa (regra explícita, não "feeling"), cada critério tem um peso, e o score
 * final é a média ponderada em escala 0-100.
 *
 * Dois cuidados que fazem a diferença na prática:
 *
 * 1. Critério sem dado NÃO vira zero — ele sai da conta. Um terreno recém
 *    cadastrado sem preço não pode parecer ruim, ele é apenas desconhecido.
 *    Por isso existe a `cobertura`: quanto do peso total já tem informação.
 *    Score 82 com cobertura 40% é um palpite; com 95% é uma decisão.
 *
 * 2. Cada nota vem com um texto explicando por quê. Quando um sócio perguntar
 *    "por que esse terreno tirou 6 em testada?", a resposta está na tela.
 */

import {
  parametrosDaZona,
  coeficientes,
  type ZonaChave,
} from "./zeu";
import type {
  Motivacao,
  Ocupacao,
  SituacaoDocumental,
  Topografia,
} from "./enums";

export const CRITERIOS_CHAVES = [
  "preco_potencial",
  "area",
  "restricoes",
  "zona",
  "testada",
  "distancia_estacao",
  "documental",
  "topografia",
  "ocupacao",
  "vendedor",
] as const;

export type CriterioChave = (typeof CRITERIOS_CHAVES)[number];

export type Pesos = Record<CriterioChave, number>;

/** Soma 100 por conveniência de leitura, mas qualquer soma funciona. */
export const PESOS_PADRAO: Pesos = {
  preco_potencial: 20,
  area: 15,
  restricoes: 15,
  zona: 10,
  testada: 10,
  distancia_estacao: 10,
  documental: 10,
  topografia: 4,
  ocupacao: 4,
  vendedor: 2,
};

export const CRITERIO_META: Record<
  CriterioChave,
  { rotulo: string; descricao: string }
> = {
  preco_potencial: {
    rotulo: "Preço por potencial",
    descricao:
      "R$ pedidos por m² de área computável máxima (preço ÷ (área × CA máximo)). É o indicador que compara terrenos de tamanhos diferentes.",
  },
  area: {
    rotulo: "Área do terreno",
    descricao:
      "Área em m². Abaixo de ~600 m² a torre não fecha; acima de 5.000 m² entram exigências extras.",
  },
  restricoes: {
    rotulo: "Restrições",
    descricao:
      "Penalidades por tombamento, contaminação, melhoramento viário, APP, servidão e afins.",
  },
  zona: {
    rotulo: "Zoneamento",
    descricao: "Aderência da zona à tese de eixo (ZEU e equivalentes).",
  },
  testada: {
    rotulo: "Testada",
    descricao:
      "Frente do lote em metros. Define implantação, número de torres e a viabilidade da fachada ativa.",
  },
  distancia_estacao: {
    rotulo: "Distância do transporte",
    descricao: "Metros a pé até estação de metrô/trem ou corredor de ônibus.",
  },
  documental: {
    rotulo: "Situação documental",
    descricao: "Matrícula, espólio, litígio — o que trava a escritura.",
  },
  topografia: { rotulo: "Topografia", descricao: "Impacto no custo de fundação e movimentação de terra." },
  ocupacao: {
    rotulo: "Ocupação atual",
    descricao: "Custo e prazo para desocupar e demolir.",
  },
  vendedor: {
    rotulo: "Motivação do vendedor",
    descricao: "Disposição real de negociar preço e prazo.",
  },
};

export interface EntradaScore {
  zona: ZonaChave;
  areaTerreno: number;
  testada?: number | null;
  precoPedido?: number | null;
  caBasico?: number | null;
  caMaximo?: number | null;
  distanciaEstacaoM?: number | null;
  topografia?: Topografia | null;
  ocupacao?: Ocupacao | null;
  situacaoDocumental?: SituacaoDocumental | null;
  motivacaoVendedor?: Motivacao | null;
  tombado?: boolean;
  zepecEntorno?: boolean;
  areaContaminada?: boolean;
  melhoramentoViario?: boolean;
  areaPreservacao?: boolean;
  servidao?: boolean;
  restricaoAeroportuaria?: boolean;
}

interface Avaliacao {
  nota: number;
  texto: string;
}

export interface CriterioAvaliado {
  chave: CriterioChave;
  rotulo: string;
  /** null = sem dado suficiente; o critério é excluído da média. */
  nota: number | null;
  peso: number;
  /** Quanto o critério somou no total de 0 a 100. */
  contribuicao: number;
  texto: string;
}

export interface Alerta {
  nivel: "bloqueio" | "atencao";
  texto: string;
}

export interface ResultadoScore {
  total: number;
  cobertura: number;
  criterios: CriterioAvaliado[];
  alertas: Alerta[];
  /** Métrica derivada, útil o suficiente para viajar junto do score. */
  precoPorPotencial: number | null;
  precoPorM2Terreno: number | null;
}

interface Faixa {
  /** Limite superior (inclusive) da faixa. */
  ate: number;
  nota: number;
  texto: string;
}

function porFaixa(valor: number, faixas: Faixa[], acima: Avaliacao): Avaliacao {
  for (const f of faixas) {
    if (valor <= f.ate) return { nota: f.nota, texto: f.texto };
  }
  return acima;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const num = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

// ---------------------------------------------------------------------------
// Avaliadores por critério. Retornar null significa "sem dado".
// ---------------------------------------------------------------------------

const AVALIADORES: Record<CriterioChave, (e: EntradaScore) => Avaliacao | null> = {
  preco_potencial(e) {
    const preco = e.precoPedido;
    if (!preco || preco <= 0 || !e.areaTerreno || e.areaTerreno <= 0) return null;
    const { caMaximo } = coeficientes(e.zona, { caBasico: e.caBasico, caMaximo: e.caMaximo });
    const potencial = e.areaTerreno * caMaximo;
    if (potencial <= 0) return null;
    const rs = preco / potencial;
    const t = `${brl(rs)}/m² de potencial (CA ${num(caMaximo, 1)})`;
    return porFaixa(
      rs,
      [
        { ate: 700, nota: 10, texto: `${t} — muito abaixo do praticado em eixo` },
        { ate: 1000, nota: 9, texto: `${t} — excelente` },
        { ate: 1300, nota: 8, texto: `${t} — bom` },
        { ate: 1600, nota: 6.5, texto: `${t} — dentro da média` },
        { ate: 2000, nota: 5, texto: `${t} — apertado` },
        { ate: 2400, nota: 3.5, texto: `${t} — caro` },
        { ate: 3000, nota: 2, texto: `${t} — muito caro` },
      ],
      { nota: 0, texto: `${t} — fora de qualquer conta` },
    );
  },

  area(e) {
    const a = e.areaTerreno;
    if (!a || a <= 0) return null;
    const t = `${num(a)} m²`;
    return porFaixa(
      a,
      [
        { ate: 400, nota: 1, texto: `${t} — pequeno demais para torre` },
        { ate: 600, nota: 3, texto: `${t} — só viabiliza produto muito compacto` },
        { ate: 1000, nota: 5.5, texto: `${t} — viável com implantação enxuta` },
        { ate: 1500, nota: 7.5, texto: `${t} — bom para torre única` },
        { ate: 2500, nota: 9, texto: `${t} — porte ideal` },
        { ate: 5000, nota: 10, texto: `${t} — permite duas torres e lazer completo` },
      ],
      {
        nota: 8.5,
        texto: `${num(a)} m² — ótimo porte, mas acima de 5.000 m² entram fruição pública e maior complexidade`,
      },
    );
  },

  restricoes(e) {
    const penalidades: Array<[boolean | undefined, number, string]> = [
      [e.tombado, 10, "tombamento"],
      [e.areaContaminada, 6, "área contaminada"],
      [e.areaPreservacao, 5, "APP / curso d'água"],
      [e.melhoramentoViario, 4, "melhoramento viário"],
      [e.servidao, 3, "servidão"],
      [e.zepecEntorno, 2, "ZEPEC no entorno"],
      [e.restricaoAeroportuaria, 2, "restrição aeroportuária"],
    ];
    const ativas = penalidades.filter(([flag]) => flag === true);
    const desconto = ativas.reduce((soma, [, peso]) => soma + peso, 0);
    const nota = Math.max(0, 10 - desconto);
    return {
      nota,
      texto: ativas.length
        ? `Restrições: ${ativas.map(([, , nome]) => nome).join(", ")}`
        : "Nenhuma restrição registrada",
    };
  },

  zona(e) {
    const p = parametrosDaZona(e.zona);
    if (e.zona === "A_VERIFICAR") return null;
    return {
      nota: p.notaZona,
      texto: `${p.rotulo} — CA básico ${num(p.caBasico, 1)} / máximo ${num(p.caMaximo, 1)}`,
    };
  },

  testada(e) {
    const t = e.testada;
    if (!t || t <= 0) return null;
    const r = `${num(t, 1)} m de testada`;
    return porFaixa(
      t,
      [
        { ate: 10, nota: 0.5, texto: `${r} — inviabiliza implantação de torre` },
        { ate: 15, nota: 3, texto: `${r} — muito estreito` },
        { ate: 20, nota: 5.5, texto: `${r} — limitado, exige projeto cuidadoso` },
        { ate: 30, nota: 7.5, texto: `${r} — confortável` },
        { ate: 45, nota: 9, texto: `${r} — muito bom` },
      ],
      { nota: 10, texto: `${num(t, 1)} m de testada — excelente, permite duas torres` },
    );
  },

  distancia_estacao(e) {
    const d = e.distanciaEstacaoM;
    if (d == null || d < 0) return null;
    const r = `${num(d)} m até o transporte`;
    return porFaixa(
      d,
      [
        { ate: 300, nota: 10, texto: `${r} — porta do transporte` },
        { ate: 500, nota: 9, texto: `${r} — caminhada curta` },
        { ate: 700, nota: 8, texto: `${r} — dentro do raio que o mercado valoriza` },
        { ate: 1000, nota: 6, texto: `${r} — aceitável` },
        { ate: 1500, nota: 3.5, texto: `${r} — longe para o argumento de venda` },
      ],
      { nota: 1.5, texto: `${num(d)} m — sem apelo de transporte` },
    );
  },

  documental(e) {
    const mapa: Record<SituacaoDocumental, Avaliacao | null> = {
      REGULAR: { nota: 10, texto: "Matrícula regular" },
      PENDENCIA_SIMPLES: { nota: 7, texto: "Pendência simples, resolvível" },
      ESPOLIO_INVENTARIO: { nota: 4, texto: "Espólio/inventário — prazo longo e imprevisível" },
      LITIGIO_USUCAPIAO: { nota: 0.5, texto: "Litígio ou usucapião em curso" },
      NAO_INFORMADO: null,
    };
    return e.situacaoDocumental ? mapa[e.situacaoDocumental] : null;
  },

  topografia(e) {
    const mapa: Record<Topografia, Avaliacao | null> = {
      PLANA: { nota: 10, texto: "Plana" },
      ACLIVE_LEVE: { nota: 7.5, texto: "Aclive leve" },
      DECLIVE_LEVE: { nota: 7, texto: "Declive leve" },
      ACLIVE_ACENTUADO: { nota: 3.5, texto: "Aclive acentuado — encarece contenção" },
      DECLIVE_ACENTUADO: { nota: 3, texto: "Declive acentuado — encarece fundação e contenção" },
      IRREGULAR: { nota: 4, texto: "Terreno irregular" },
      NAO_INFORMADO: null,
    };
    return e.topografia ? mapa[e.topografia] : null;
  },

  ocupacao(e) {
    const mapa: Record<Ocupacao, Avaliacao | null> = {
      VAZIO: { nota: 10, texto: "Vazio — sem custo de desocupação" },
      EDIFICACAO_SIMPLES: { nota: 8, texto: "Edificação simples — demolição barata" },
      EDIFICACAO_RELEVANTE: { nota: 5, texto: "Edificação relevante — demolição cara" },
      ALUGADO: { nota: 4.5, texto: "Alugado — depende do fim do contrato" },
      OCUPACAO_IRREGULAR: { nota: 0.5, texto: "Ocupação irregular — prazo e risco altos" },
      NAO_INFORMADO: null,
    };
    return e.ocupacao ? mapa[e.ocupacao] : null;
  },

  vendedor(e) {
    const mapa: Record<Motivacao, Avaliacao | null> = {
      ALTA: { nota: 10, texto: "Vendedor motivado" },
      MEDIA: { nota: 6, texto: "Motivação média" },
      BAIXA: { nota: 2.5, texto: "Vendedor sem pressa — pouca margem de negociação" },
      NAO_INFORMADO: null,
    };
    return e.motivacaoVendedor ? mapa[e.motivacaoVendedor] : null;
  },
};

// ---------------------------------------------------------------------------

function levantarAlertas(e: EntradaScore): Alerta[] {
  const alertas: Alerta[] = [];
  const p = parametrosDaZona(e.zona);

  if (e.tombado) {
    alertas.push({ nivel: "bloqueio", texto: "Imóvel tombado — não há incorporação possível sem desmembrar o bem." });
  }
  if (e.situacaoDocumental === "LITIGIO_USUCAPIAO") {
    alertas.push({ nivel: "bloqueio", texto: "Litígio/usucapião em curso — não avançar sem parecer jurídico." });
  }
  if (e.zona !== "A_VERIFICAR" && !p.elegivelIncorporacao) {
    alertas.push({
      nivel: "bloqueio",
      texto: `Zona ${p.rotulo} não comporta o produto alvo (CA máximo ${p.caMaximo}).`,
    });
  }
  if (e.areaTerreno > 0 && e.areaTerreno < 400) {
    alertas.push({ nivel: "bloqueio", texto: "Área abaixo de 400 m² — inviável para torre." });
  }
  if (e.zona === "A_VERIFICAR") {
    alertas.push({ nivel: "atencao", texto: "Zoneamento não confirmado. Consultar o GeoSampa pelo número do contribuinte." });
  }
  if (p.vigenciaCondicionada) {
    alertas.push({
      nivel: "atencao",
      texto: "Eixo previsto: parâmetros condicionados à entrada em operação do transporte.",
    });
  }
  if (e.areaContaminada) {
    alertas.push({ nivel: "atencao", texto: "Área contaminada — exigir investigação confirmatória e orçar remediação." });
  }
  if (e.melhoramentoViario) {
    alertas.push({ nivel: "atencao", texto: "Melhoramento viário incidente — parte do lote pode ser não edificável." });
  }
  if (e.areaPreservacao) {
    alertas.push({ nivel: "atencao", texto: "APP / curso d'água — verificar faixa non aedificandi e licenciamento." });
  }
  if (e.ocupacao === "OCUPACAO_IRREGULAR") {
    alertas.push({ nivel: "atencao", texto: "Ocupação irregular — orçar desocupação e prazo judicial." });
  }
  if (e.zona !== "A_VERIFICAR" && p.fruicaoPublicaAcimaM2 != null && e.areaTerreno > p.fruicaoPublicaAcimaM2) {
    alertas.push({
      nivel: "atencao",
      texto: `Lote acima de ${p.fruicaoPublicaAcimaM2.toLocaleString("pt-BR")} m²: verificar fruição pública obrigatória.`,
    });
  }

  return alertas;
}

export function calcularScore(entrada: EntradaScore, pesos: Pesos = PESOS_PADRAO): ResultadoScore {
  const criterios: CriterioAvaliado[] = [];
  let somaPesosComDado = 0;
  let somaPonderada = 0;
  let somaPesosTotal = 0;

  for (const chave of CRITERIOS_CHAVES) {
    const peso = Math.max(0, pesos[chave] ?? 0);
    somaPesosTotal += peso;

    const avaliacao = AVALIADORES[chave](entrada);
    if (avaliacao === null) {
      criterios.push({
        chave,
        rotulo: CRITERIO_META[chave].rotulo,
        nota: null,
        peso,
        contribuicao: 0,
        texto: "Sem dado",
      });
      continue;
    }

    const nota = Math.min(10, Math.max(0, avaliacao.nota));
    somaPesosComDado += peso;
    somaPonderada += nota * peso;

    criterios.push({
      chave,
      rotulo: CRITERIO_META[chave].rotulo,
      nota,
      peso,
      contribuicao: peso > 0 ? nota * peso : 0,
      texto: avaliacao.texto,
    });
  }

  const total = somaPesosComDado > 0 ? (somaPonderada / somaPesosComDado) * 10 : 0;
  const cobertura = somaPesosTotal > 0 ? (somaPesosComDado / somaPesosTotal) * 100 : 0;

  // Normaliza a contribuição para a escala 0-100 do total.
  const fator = somaPesosComDado > 0 ? 10 / somaPesosComDado : 0;
  for (const c of criterios) c.contribuicao = arredondar(c.contribuicao * fator, 2);

  return {
    total: arredondar(total, 1),
    cobertura: arredondar(cobertura, 0),
    criterios,
    alertas: levantarAlertas(entrada),
    precoPorPotencial: precoPorPotencial(entrada),
    precoPorM2Terreno:
      entrada.precoPedido && entrada.areaTerreno > 0
        ? arredondar(entrada.precoPedido / entrada.areaTerreno, 2)
        : null,
  };
}

export function precoPorPotencial(e: EntradaScore): number | null {
  if (!e.precoPedido || e.precoPedido <= 0 || !e.areaTerreno || e.areaTerreno <= 0) return null;
  const { caMaximo } = coeficientes(e.zona, { caBasico: e.caBasico, caMaximo: e.caMaximo });
  const potencial = e.areaTerreno * caMaximo;
  return potencial > 0 ? arredondar(e.precoPedido / potencial, 2) : null;
}

function arredondar(v: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

export type FaixaScore = "excelente" | "bom" | "medio" | "fraco";

export function faixaScore(total: number): {
  faixa: FaixaScore;
  rotulo: string;
  classe: string;
  classePonto: string;
} {
  if (total >= 80)
    return {
      faixa: "excelente",
      rotulo: "Excelente",
      classe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      classePonto: "bg-emerald-500",
    };
  if (total >= 65)
    return {
      faixa: "bom",
      rotulo: "Bom",
      classe: "bg-sky-50 text-sky-700 ring-sky-200",
      classePonto: "bg-sky-500",
    };
  if (total >= 45)
    return {
      faixa: "medio",
      rotulo: "Médio",
      classe: "bg-amber-50 text-amber-800 ring-amber-200",
      classePonto: "bg-amber-500",
    };
  return {
    faixa: "fraco",
    rotulo: "Fraco",
    classe: "bg-rose-50 text-rose-700 ring-rose-200",
    classePonto: "bg-rose-500",
  };
}

/** Valida e normaliza pesos vindos da tela de configuração. */
export function normalizarPesos(entrada: Partial<Record<string, unknown>>): Pesos {
  const saida = { ...PESOS_PADRAO };
  for (const chave of CRITERIOS_CHAVES) {
    const valor = Number(entrada?.[chave]);
    if (Number.isFinite(valor) && valor >= 0 && valor <= 100) saida[chave] = valor;
  }
  return saida;
}
