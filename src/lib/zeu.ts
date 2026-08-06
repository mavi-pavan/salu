/**
 * Parâmetros urbanísticos por zona — LPUOS (Lei Municipal 16.402/2016),
 * com as alterações das Leis 18.081/2024 e 18.177/2024 (revisão intermediária
 * do Plano Diretor Estratégico e da lei de zoneamento).
 *
 * ------------------------------------------------------------------------
 * LEIA ISTO ANTES DE CONFIAR NOS NÚMEROS
 * ------------------------------------------------------------------------
 * Estes valores são um PONTO DE PARTIDA para triagem rápida, não uma consulta
 * oficial. Coeficientes, taxa de ocupação e cota-parte variam por perímetro,
 * por quadro anexo e por data de protocolo do projeto — e a revisão de 2024
 * alterou parte deles. Antes de assinar qualquer coisa:
 *
 *   1. Confirme a zona do lote no GeoSampa (geosampa.prefeitura.sp.gov.br)
 *      pelo número do contribuinte (SQL).
 *   2. Confira os Quadros 2, 2A, 3 e 4 da Lei 16.402/2016 na redação vigente.
 *   3. Peça Certidão de Zoneamento à SMUL para o lote específico.
 *
 * Cada terreno no app permite sobrescrever CA básico e CA máximo justamente
 * para o caso de o parâmetro real divergir do padrão da zona.
 */

export const AVISO_LEGAL =
  "Parâmetros de referência para triagem. Confirme zona no GeoSampa e os Quadros da Lei 16.402/2016 (alterada pelas Leis 18.081/2024 e 18.177/2024) antes de qualquer decisão.";

export const ZONAS = [
  "ZEU",
  "ZEUa",
  "ZEUP",
  "ZEUPa",
  "ZEM",
  "ZEMP",
  "ZC",
  "ZM",
  "ZR",
  "ZEIS",
  "OUTRA",
  "A_VERIFICAR",
] as const;

export type ZonaChave = (typeof ZONAS)[number];

export interface ParametrosZona {
  chave: ZonaChave;
  rotulo: string;
  nomeCompleto: string;
  descricao: string;
  /** Coeficiente de aproveitamento básico (área construída gratuita = área x CA básico). */
  caBasico: number;
  /** Coeficiente de aproveitamento máximo (o excedente sobre o básico paga outorga). */
  caMaximo: number;
  /** Taxa de ocupação máxima para lotes de até 500 m². */
  taxaOcupacaoAte500: number;
  /** Taxa de ocupação máxima para lotes acima de 500 m². */
  taxaOcupacaoAcima500: number;
  /** Gabarito de altura máxima em metros. null = sem limite de gabarito na zona. */
  gabaritoMaximoM: number | null;
  /**
   * Cota-parte máxima de terreno por unidade (m²). Limita o tamanho médio das
   * unidades: nº mínimo de unidades = área do terreno / cota-parte.
   * null = sem exigência.
   */
  cotaParteMaximaM2: number | null;
  /** Área a partir da qual há exigência de fruição pública (m²). null = não se aplica. */
  fruicaoPublicaAcimaM2: number | null;
  /** Vagas de garagem não computáveis por unidade habitacional. */
  vagasNaoComputaveisPorUH: number;
  /**
   * Zona previsão: os parâmetros de eixo só valem a partir da entrada em
   * operação da infraestrutura de transporte. Antes disso vale a zona anterior.
   */
  vigenciaCondicionada: boolean;
  /** A zona comporta incorporação vertical de médio/alto adensamento? */
  elegivelIncorporacao: boolean;
  /** Nota 0-10 usada no critério "zoneamento" da pontuação. */
  notaZona: number;
  observacao?: string;
}

const EIXO_BASE = {
  caBasico: 1,
  caMaximo: 4,
  taxaOcupacaoAte500: 0.85,
  taxaOcupacaoAcima500: 0.7,
  gabaritoMaximoM: null,
  cotaParteMaximaM2: 20,
  fruicaoPublicaAcimaM2: 5000,
  vagasNaoComputaveisPorUH: 1,
} as const;

export const PARAMETROS_ZONA: Record<ZonaChave, ParametrosZona> = {
  ZEU: {
    ...EIXO_BASE,
    chave: "ZEU",
    rotulo: "ZEU",
    nomeCompleto: "Zona Eixo de Estruturação da Transformação Urbana",
    descricao:
      "Eixo já implantado. Maior potencial construtivo da cidade fora das operações urbanas, sem limite de gabarito.",
    vigenciaCondicionada: false,
    elegivelIncorporacao: true,
    notaZona: 10,
  },
  ZEUa: {
    ...EIXO_BASE,
    chave: "ZEUa",
    rotulo: "ZEUa",
    nomeCompleto: "Zona Eixo de Estruturação da Transformação Urbana Ambiental",
    descricao:
      "Mesmo potencial da ZEU, com exigências ambientais mais restritivas (quota ambiental, permeabilidade, cobertura vegetal).",
    vigenciaCondicionada: false,
    elegivelIncorporacao: true,
    notaZona: 8,
    observacao:
      "Quota ambiental mais exigente reduz área de projeto e encarece paisagismo. Verificar exigência de arborização e permeabilidade.",
  },
  ZEUP: {
    ...EIXO_BASE,
    chave: "ZEUP",
    rotulo: "ZEUP",
    nomeCompleto: "Zona Eixo de Estruturação da Transformação Urbana Previsto",
    descricao:
      "Eixo previsto. Os parâmetros de eixo passam a valer com a entrada em operação da infraestrutura de transporte.",
    vigenciaCondicionada: true,
    elegivelIncorporacao: true,
    notaZona: 6,
    observacao:
      "Risco de cronograma: enquanto o transporte não opera, valem os parâmetros da zona anterior. Confirmar data prevista e estágio da obra.",
  },
  ZEUPa: {
    ...EIXO_BASE,
    chave: "ZEUPa",
    rotulo: "ZEUPa",
    nomeCompleto:
      "Zona Eixo de Estruturação da Transformação Urbana Previsto Ambiental",
    descricao:
      "Eixo previsto com restrições ambientais. Combina risco de cronograma e exigência ambiental.",
    vigenciaCondicionada: true,
    elegivelIncorporacao: true,
    notaZona: 5,
  },
  ZEM: {
    ...EIXO_BASE,
    chave: "ZEM",
    rotulo: "ZEM",
    nomeCompleto: "Zona Eixo de Estruturação da Transformação Metropolitana",
    descricao:
      "Eixo metropolitano, tipicamente ao longo de ferrovias e rodovias de integração metropolitana.",
    vigenciaCondicionada: false,
    elegivelIncorporacao: true,
    notaZona: 8,
  },
  ZEMP: {
    ...EIXO_BASE,
    chave: "ZEMP",
    rotulo: "ZEMP",
    nomeCompleto:
      "Zona Eixo de Estruturação da Transformação Metropolitana Previsto",
    descricao: "Eixo metropolitano previsto, condicionado à infraestrutura.",
    vigenciaCondicionada: true,
    elegivelIncorporacao: true,
    notaZona: 5,
  },
  ZC: {
    chave: "ZC",
    rotulo: "ZC",
    nomeCompleto: "Zona de Centralidade",
    descricao:
      "Centralidade de bairro. Potencial bem menor que o eixo; só faz sentido para produtos específicos.",
    caBasico: 1,
    caMaximo: 2,
    taxaOcupacaoAte500: 0.85,
    taxaOcupacaoAcima500: 0.7,
    gabaritoMaximoM: 48,
    cotaParteMaximaM2: null,
    fruicaoPublicaAcimaM2: null,
    vagasNaoComputaveisPorUH: 1,
    vigenciaCondicionada: false,
    elegivelIncorporacao: false,
    notaZona: 3,
  },
  ZM: {
    chave: "ZM",
    rotulo: "ZM",
    nomeCompleto: "Zona Mista",
    descricao: "Miolo de bairro, baixo potencial construtivo.",
    caBasico: 1,
    caMaximo: 2,
    taxaOcupacaoAte500: 0.7,
    taxaOcupacaoAcima500: 0.7,
    gabaritoMaximoM: 28,
    cotaParteMaximaM2: null,
    fruicaoPublicaAcimaM2: null,
    vagasNaoComputaveisPorUH: 1,
    vigenciaCondicionada: false,
    elegivelIncorporacao: false,
    notaZona: 2,
  },
  ZR: {
    chave: "ZR",
    rotulo: "ZR",
    nomeCompleto: "Zona Residencial",
    descricao: "Estritamente residencial de baixa densidade. Inviável para o produto alvo.",
    caBasico: 1,
    caMaximo: 1,
    taxaOcupacaoAte500: 0.5,
    taxaOcupacaoAcima500: 0.5,
    gabaritoMaximoM: 10,
    cotaParteMaximaM2: null,
    fruicaoPublicaAcimaM2: null,
    vagasNaoComputaveisPorUH: 1,
    vigenciaCondicionada: false,
    elegivelIncorporacao: false,
    notaZona: 0,
  },
  ZEIS: {
    chave: "ZEIS",
    rotulo: "ZEIS",
    nomeCompleto: "Zona Especial de Interesse Social",
    descricao:
      "Exige percentual mínimo de HIS/HMP. Potencial alto, porém com produto e faixa de renda determinados por lei.",
    caBasico: 1,
    caMaximo: 4,
    taxaOcupacaoAte500: 0.85,
    taxaOcupacaoAcima500: 0.7,
    gabaritoMaximoM: null,
    cotaParteMaximaM2: null,
    fruicaoPublicaAcimaM2: null,
    vagasNaoComputaveisPorUH: 1,
    vigenciaCondicionada: false,
    elegivelIncorporacao: true,
    notaZona: 4,
    observacao:
      "Exige percentual mínimo de HIS. Muda completamente o produto — avaliar só se houver tese de HIS/HMP.",
  },
  OUTRA: {
    chave: "OUTRA",
    rotulo: "Outra",
    nomeCompleto: "Outra zona",
    descricao: "Zona fora do escopo de prospecção.",
    caBasico: 1,
    caMaximo: 1,
    taxaOcupacaoAte500: 0.7,
    taxaOcupacaoAcima500: 0.7,
    gabaritoMaximoM: null,
    cotaParteMaximaM2: null,
    fruicaoPublicaAcimaM2: null,
    vagasNaoComputaveisPorUH: 1,
    vigenciaCondicionada: false,
    elegivelIncorporacao: false,
    notaZona: 0,
  },
  A_VERIFICAR: {
    chave: "A_VERIFICAR",
    rotulo: "A verificar",
    nomeCompleto: "Zoneamento ainda não confirmado",
    descricao: "Consultar o GeoSampa pelo número do contribuinte antes de avançar.",
    caBasico: 1,
    caMaximo: 4,
    taxaOcupacaoAte500: 0.85,
    taxaOcupacaoAcima500: 0.7,
    gabaritoMaximoM: null,
    cotaParteMaximaM2: 20,
    fruicaoPublicaAcimaM2: 5000,
    vagasNaoComputaveisPorUH: 1,
    vigenciaCondicionada: false,
    elegivelIncorporacao: true,
    notaZona: 0,
    observacao:
      "Enquanto a zona não for confirmada, os cálculos usam parâmetros de ZEU apenas como hipótese de trabalho.",
  },
};

/** Zonas da família eixo — as que realmente interessam à tese. */
export const ZONAS_EIXO: ZonaChave[] = ["ZEU", "ZEUa", "ZEUP", "ZEUPa", "ZEM", "ZEMP"];

export function parametrosDaZona(zona: ZonaChave): ParametrosZona {
  return PARAMETROS_ZONA[zona] ?? PARAMETROS_ZONA.A_VERIFICAR;
}

export function ehZonaEixo(zona: ZonaChave): boolean {
  return ZONAS_EIXO.includes(zona);
}

/**
 * CA efetivo do terreno: usa o valor sobrescrito quando existe (certidão de
 * zoneamento na mão), senão o padrão da zona.
 */
export function coeficientes(
  zona: ZonaChave,
  override?: { caBasico?: number | null; caMaximo?: number | null },
): { caBasico: number; caMaximo: number; origem: "terreno" | "zona" } {
  const p = parametrosDaZona(zona);
  const temOverride =
    (override?.caBasico != null && override.caBasico > 0) ||
    (override?.caMaximo != null && override.caMaximo > 0);
  return {
    caBasico: override?.caBasico != null && override.caBasico > 0 ? override.caBasico : p.caBasico,
    caMaximo: override?.caMaximo != null && override.caMaximo > 0 ? override.caMaximo : p.caMaximo,
    origem: temOverride ? "terreno" : "zona",
  };
}

/** Taxa de ocupação aplicável considerando a faixa de área do lote. */
export function taxaOcupacao(zona: ZonaChave, areaTerreno: number): number {
  const p = parametrosDaZona(zona);
  return areaTerreno <= 500 ? p.taxaOcupacaoAte500 : p.taxaOcupacaoAcima500;
}

/**
 * Observações urbanísticas que dependem do porte do lote — o tipo de coisa que
 * é fácil esquecer na planilha e cara de descobrir depois.
 */
export function alertasUrbanisticos(zona: ZonaChave, areaTerreno: number): string[] {
  const p = parametrosDaZona(zona);
  const alertas: string[] = [];

  if (p.fruicaoPublicaAcimaM2 != null && areaTerreno > p.fruicaoPublicaAcimaM2) {
    alertas.push(
      `Lote acima de ${p.fruicaoPublicaAcimaM2.toLocaleString("pt-BR")} m²: verificar exigência de fruição pública e destinação de área ao Município.`,
    );
  }
  if (p.vigenciaCondicionada) {
    alertas.push(
      "Zona de eixo previsto: os parâmetros só valem após a entrada em operação do transporte. Confirmar cronograma antes de precificar pelo CA 4.",
    );
  }
  if (p.cotaParteMaximaM2 != null) {
    const minUnidades = Math.ceil(areaTerreno / p.cotaParteMaximaM2);
    alertas.push(
      `Cota-parte máxima de ${p.cotaParteMaximaM2} m²/unidade: no mínimo ${minUnidades} unidades para aproveitar o potencial.`,
    );
  }
  if (p.observacao) alertas.push(p.observacao);

  return alertas;
}
