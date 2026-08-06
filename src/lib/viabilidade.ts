/**
 * Estudo de massa expresso + conta de padaria da incorporação.
 *
 * Não substitui estudo de viabilidade de verdade (arquiteto + orçamentista).
 * O objetivo é responder, em segundos e com premissas explícitas, a única
 * pergunta que importa na triagem:
 *
 *     "Quanto eu posso pagar neste terreno para a conta fechar?"
 *
 * Por isso a função principal devolve `precoMaximoTerreno` — o preço que
 * entrega exatamente a margem alvo. Comparar esse número com o preço pedido é
 * o que separa terreno caro de terreno viável.
 *
 * Outorga onerosa (OODC): segue a fórmula do art. 117 do PDE (Lei 16.050/2014):
 *
 *     Ct = (At / Ac) x V x Fs x Fp
 *
 * onde Ct é a contrapartida por m² de potencial adicional, At a área do
 * terreno, Ac a área construída computável total, V o valor do m² de terreno
 * do Cadastro de Valor de Terreno (Quadro 14 do PDE), Fs o fator de interesse
 * social e Fp o fator de planejamento. O total é Ct x área adicional.
 */

import { coeficientes, parametrosDaZona, type ZonaChave } from "./zeu";

export interface Premissas {
  /** Área privativa / área computável. */
  eficienciaPrivativa: number;
  /** Área total construída / área computável (garagens, áreas comuns, técnicas). */
  fatorAreaTotal: number;
  /** Área privativa média por unidade (m²). */
  areaMediaUnidadeM2: number;
  /** Preço de venda esperado (R$/m² privativo). */
  precoVendaM2: number;
  /** Custo de obra (R$/m² de área equivalente de construção). */
  custoObraM2: number;
  /** Área equivalente / área total construída. */
  fatorAreaEquivalente: number;
  /** Projetos, aprovações, administração, taxas (% do VGV). */
  custosIndiretosPctVGV: number;
  /** Comissão de venda + marketing (% do VGV). */
  comissaoMarketingPctVGV: number;
  /** Impostos sobre a venda, ex. RET (% do VGV). */
  impostosPctVGV: number;
  /** Fator de interesse social da outorga (Fs). */
  fatorSocial: number;
  /** Fator de planejamento da outorga (Fp). */
  fatorPlanejamento: number;
  /** ITBI + custos de cartório sobre o valor do terreno. */
  itbiPct: number;
  /** Margem líquida alvo sobre o VGV. */
  margemAlvoPct: number;
}

/**
 * Calibração dos padrões.
 *
 * Os valores abaixo foram ajustados para que a estrutura de custo caia onde
 * uma incorporação de médio padrão em eixo realmente cai, em proporção do VGV:
 *
 *   obra ~50% | indiretos 9% | comissão e marketing 6% | impostos 4%
 *   outorga ~5% | terreno + ITBI ~8% | margem 18%
 *
 * A conferência que importa: com estes números, o preço máximo de terreno de
 * um lote de 1.000 m² em ZEU fica na casa dos R$ 3.000/m² — a ordem de
 * grandeza praticada. Se o time trabalha com outro padrão de produto, é para
 * mexer aqui (ou em Configurações), e o teste de arredondamento continua
 * valendo porque ele checa a coerência interna, não os valores absolutos.
 */
export const PREMISSAS_PADRAO: Premissas = {
  eficienciaPrivativa: 0.75,
  fatorAreaTotal: 1.35,
  areaMediaUnidadeM2: 42,
  precoVendaM2: 13000,
  custoObraM2: 4600,
  fatorAreaEquivalente: 0.78,
  custosIndiretosPctVGV: 0.09,
  comissaoMarketingPctVGV: 0.06,
  impostosPctVGV: 0.04,
  fatorSocial: 1,
  fatorPlanejamento: 1,
  itbiPct: 0.03,
  margemAlvoPct: 0.18,
};

export const PREMISSA_META: Record<
  keyof Premissas,
  { rotulo: string; sufixo: "R$/m²" | "%" | "m²" | "x"; passo: number; ajuda: string }
> = {
  precoVendaM2: {
    rotulo: "Preço de venda",
    sufixo: "R$/m²",
    passo: 100,
    ajuda: "R$ por m² privativo na região. Puxe de lançamentos comparáveis.",
  },
  custoObraM2: {
    rotulo: "Custo de obra",
    sufixo: "R$/m²",
    passo: 100,
    ajuda: "R$ por m² de área equivalente. Referência: CUB/SINAPI + BDI.",
  },
  areaMediaUnidadeM2: {
    rotulo: "Unidade média",
    sufixo: "m²",
    passo: 1,
    ajuda: "Área privativa média do produto. Em eixo, compactos de 25 a 45 m².",
  },
  eficienciaPrivativa: {
    rotulo: "Eficiência privativa",
    sufixo: "%",
    passo: 1,
    ajuda: "Área privativa ÷ área computável. Tipicamente 68% a 78%.",
  },
  fatorAreaTotal: {
    rotulo: "Área total ÷ computável",
    sufixo: "x",
    passo: 0.05,
    ajuda: "Quanto se constrói além do computável (garagem, comum, técnica).",
  },
  fatorAreaEquivalente: {
    rotulo: "Área equivalente",
    sufixo: "x",
    passo: 0.05,
    ajuda: "Área equivalente ÷ área total construída, para orçar a obra.",
  },
  custosIndiretosPctVGV: {
    rotulo: "Custos indiretos",
    sufixo: "%",
    passo: 0.5,
    ajuda: "Projetos, aprovações, administração, taxas.",
  },
  comissaoMarketingPctVGV: {
    rotulo: "Comissão + marketing",
    sufixo: "%",
    passo: 0.5,
    ajuda: "Corretagem e verba de lançamento.",
  },
  impostosPctVGV: {
    rotulo: "Impostos sobre venda",
    sufixo: "%",
    passo: 0.5,
    ajuda: "RET e demais tributos sobre a receita.",
  },
  itbiPct: {
    rotulo: "ITBI + cartório",
    sufixo: "%",
    passo: 0.1,
    ajuda: "Incide sobre o valor do terreno. ITBI em São Paulo: 3%.",
  },
  fatorSocial: {
    rotulo: "Fator social (Fs)",
    sufixo: "x",
    passo: 0.1,
    ajuda: "Fator de interesse social da outorga. Uso residencial comum: 1,0.",
  },
  fatorPlanejamento: {
    rotulo: "Fator planejamento (Fp)",
    sufixo: "x",
    passo: 0.1,
    ajuda: "Fator de planejamento da outorga, conforme o quadro do PDE.",
  },
  margemAlvoPct: {
    rotulo: "Margem alvo",
    sufixo: "%",
    passo: 1,
    ajuda: "Margem líquida sobre o VGV que o negócio precisa entregar.",
  },
};

/** Premissas guardadas como % inteiro na UI viram fração aqui. */
export const PREMISSAS_PERCENTUAIS: Array<keyof Premissas> = [
  "eficienciaPrivativa",
  "custosIndiretosPctVGV",
  "comissaoMarketingPctVGV",
  "impostosPctVGV",
  "itbiPct",
  "margemAlvoPct",
];

export interface EntradaViabilidade {
  zona: ZonaChave;
  areaTerreno: number;
  caBasico?: number | null;
  caMaximo?: number | null;
  precoPedido?: number | null;
  /** R$/m² do Cadastro de Valor de Terreno. Sem ele, usamos o preço pedido/m². */
  valorVenalM2?: number | null;
}

export interface Viabilidade {
  caBasico: number;
  caMaximo: number;
  origemCA: "terreno" | "zona";

  areaComputavel: number;
  areaBasica: number;
  areaAdicional: number;
  areaTotalConstruida: number;
  areaEquivalente: number;
  areaPrivativa: number;
  unidadesEstimadas: number;
  unidadesMinimasCotaParte: number | null;

  vgv: number;
  /** VGV por m² de terreno — atalho mental para comparar terrenos. */
  vgvPorM2Terreno: number;

  outorga: number;
  outorgaPorM2Adicional: number;
  /** true quando V veio do preço pedido, e não do valor venal informado. */
  outorgaEstimadaPeloPedido: boolean;

  custoObra: number;
  custosIndiretos: number;
  comissaoMarketing: number;
  impostos: number;
  custosSemTerreno: number;

  custoTerreno: number;
  itbi: number;
  custoTotal: number;

  resultado: number;
  margemPct: number;

  /** Preço de terreno que entrega exatamente a margem alvo. */
  precoMaximoTerreno: number;
  precoMaximoPorM2Terreno: number;
  /** precoMaximoTerreno - precoPedido. Positivo = ainda cabe negociação. */
  folga: number | null;
}

export function calcularViabilidade(
  entrada: EntradaViabilidade,
  premissas: Premissas = PREMISSAS_PADRAO,
): Viabilidade {
  const p = premissas;
  const area = Math.max(0, entrada.areaTerreno || 0);
  const { caBasico, caMaximo, origem } = coeficientes(entrada.zona, {
    caBasico: entrada.caBasico,
    caMaximo: entrada.caMaximo,
  });
  const params = parametrosDaZona(entrada.zona);

  const areaComputavel = area * caMaximo;
  const areaBasica = area * caBasico;
  const areaAdicional = Math.max(0, areaComputavel - areaBasica);
  const areaTotalConstruida = areaComputavel * p.fatorAreaTotal;
  const areaEquivalente = areaTotalConstruida * p.fatorAreaEquivalente;
  const areaPrivativa = areaComputavel * p.eficienciaPrivativa;

  const unidadesEstimadas =
    p.areaMediaUnidadeM2 > 0 ? Math.floor(areaPrivativa / p.areaMediaUnidadeM2) : 0;
  const unidadesMinimasCotaParte =
    params.cotaParteMaximaM2 != null && area > 0
      ? Math.ceil(area / params.cotaParteMaximaM2)
      : null;

  const vgv = areaPrivativa * p.precoVendaM2;

  // --- outorga onerosa ---
  const precoPedido = entrada.precoPedido ?? 0;
  const temValorVenal = (entrada.valorVenalM2 ?? 0) > 0;
  const valorTerrenoM2 = temValorVenal
    ? (entrada.valorVenalM2 as number)
    : area > 0
      ? precoPedido / area
      : 0;

  // Ct = (At/Ac) x V x Fs x Fp  ->  total = Ct x área adicional
  const ctPorM2 =
    areaComputavel > 0 ? (area / areaComputavel) * valorTerrenoM2 * p.fatorSocial * p.fatorPlanejamento : 0;
  const outorga = ctPorM2 * areaAdicional;

  const custoObra = areaEquivalente * p.custoObraM2;
  const custosIndiretos = vgv * p.custosIndiretosPctVGV;
  const comissaoMarketing = vgv * p.comissaoMarketingPctVGV;
  const impostos = vgv * p.impostosPctVGV;
  const custosSemTerreno = custoObra + custosIndiretos + comissaoMarketing + impostos + outorga;

  const custoTerreno = precoPedido;
  const itbi = custoTerreno * p.itbiPct;
  const custoTotal = custosSemTerreno + custoTerreno + itbi;

  const resultado = vgv - custoTotal;
  const margemPct = vgv > 0 ? (resultado / vgv) * 100 : 0;

  const precoMaximoTerreno = precoMaximoParaMargem(entrada, p);

  return {
    caBasico,
    caMaximo,
    origemCA: origem,
    areaComputavel: r2(areaComputavel),
    areaBasica: r2(areaBasica),
    areaAdicional: r2(areaAdicional),
    areaTotalConstruida: r2(areaTotalConstruida),
    areaEquivalente: r2(areaEquivalente),
    areaPrivativa: r2(areaPrivativa),
    unidadesEstimadas,
    unidadesMinimasCotaParte,
    vgv: r2(vgv),
    vgvPorM2Terreno: area > 0 ? r2(vgv / area) : 0,
    outorga: r2(outorga),
    outorgaPorM2Adicional: r2(ctPorM2),
    outorgaEstimadaPeloPedido: !temValorVenal && precoPedido > 0,
    custoObra: r2(custoObra),
    custosIndiretos: r2(custosIndiretos),
    comissaoMarketing: r2(comissaoMarketing),
    impostos: r2(impostos),
    custosSemTerreno: r2(custosSemTerreno),
    custoTerreno: r2(custoTerreno),
    itbi: r2(itbi),
    custoTotal: r2(custoTotal),
    resultado: r2(resultado),
    margemPct: r1(margemPct),
    precoMaximoTerreno: r2(precoMaximoTerreno),
    precoMaximoPorM2Terreno: area > 0 ? r2(precoMaximoTerreno / area) : 0,
    folga: precoPedido > 0 ? r2(precoMaximoTerreno - precoPedido) : null,
  };
}

/**
 * Resolve o preço de terreno que entrega a margem alvo.
 *
 *   VGV x (1 - margem) = custosSemTerreno + P x (1 + itbi)
 *
 * Quando o valor venal não foi informado, a outorga é estimada a partir do
 * próprio preço do terreno — o que torna a outorga proporcional a P. Nesse caso
 * ela entra do lado esquerdo como coeficiente, e não como constante:
 *
 *   outorga = k x P,  k = (área adicional / área computável) x Fs x Fp
 *   P = [VGV x (1 - margem) - outros custos] / (1 + itbi + k)
 */
export function precoMaximoParaMargem(
  entrada: EntradaViabilidade,
  premissas: Premissas = PREMISSAS_PADRAO,
): number {
  const p = premissas;
  const area = Math.max(0, entrada.areaTerreno || 0);
  if (area <= 0) return 0;

  const { caBasico, caMaximo } = coeficientes(entrada.zona, {
    caBasico: entrada.caBasico,
    caMaximo: entrada.caMaximo,
  });

  const areaComputavel = area * caMaximo;
  const areaAdicional = Math.max(0, areaComputavel - area * caBasico);
  const areaPrivativa = areaComputavel * p.eficienciaPrivativa;
  const areaEquivalente = areaComputavel * p.fatorAreaTotal * p.fatorAreaEquivalente;

  const vgv = areaPrivativa * p.precoVendaM2;
  const custoObra = areaEquivalente * p.custoObraM2;
  const custosPctVGV =
    vgv * (p.custosIndiretosPctVGV + p.comissaoMarketingPctVGV + p.impostosPctVGV);

  const temValorVenal = (entrada.valorVenalM2 ?? 0) > 0;

  // Coeficiente da outorga em função de P (só quando V depende do preço).
  const k =
    !temValorVenal && areaComputavel > 0
      ? (areaAdicional / areaComputavel) * p.fatorSocial * p.fatorPlanejamento
      : 0;

  const outorgaConstante = temValorVenal
    ? (area / areaComputavel) * (entrada.valorVenalM2 as number) * p.fatorSocial * p.fatorPlanejamento * areaAdicional
    : 0;

  const receitaAlvo = vgv * (1 - p.margemAlvoPct);
  const numerador = receitaAlvo - custoObra - custosPctVGV - outorgaConstante;
  const denominador = 1 + p.itbiPct + k;

  return Math.max(0, numerador / denominador);
}

/**
 * Premissas guardadas como fração (0,20) viram percentual inteiro (20) para
 * preencher o formulário. O caminho inverso mora na server action.
 */
export function paraPremissasFormulario(premissas: Premissas): Record<string, number> {
  const saida: Record<string, number> = { ...premissas };
  for (const chave of PREMISSAS_PERCENTUAIS) {
    saida[chave] = Math.round((premissas[chave] ?? 0) * 1000) / 10;
  }
  return saida;
}

/** Normaliza premissas vindas de JSON/formulário, mantendo os padrões no que faltar. */
export function normalizarPremissas(entrada: unknown): Premissas {
  const saida = { ...PREMISSAS_PADRAO };
  if (!entrada || typeof entrada !== "object") return saida;
  const obj = entrada as Record<string, unknown>;

  for (const chave of Object.keys(PREMISSAS_PADRAO) as Array<keyof Premissas>) {
    const valor = Number(obj[chave]);
    if (Number.isFinite(valor) && valor >= 0) saida[chave] = valor;
  }
  return saida;
}

const r2 = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
const r1 = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 10) / 10;
