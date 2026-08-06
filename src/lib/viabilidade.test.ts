import { describe, expect, it } from "vitest";

import {
  calcularViabilidade,
  precoMaximoParaMargem,
  PREMISSAS_PADRAO,
  normalizarPremissas,
  type EntradaViabilidade,
} from "./viabilidade";

const BASE: EntradaViabilidade = {
  zona: "ZEU",
  areaTerreno: 1000,
  precoPedido: 4_000_000,
  valorVenalM2: 2_500,
};

describe("potencial construtivo", () => {
  it("aplica o CA da zona quando o terreno não sobrescreve", () => {
    const v = calcularViabilidade(BASE);
    // ZEU: CA básico 1, máximo 4.
    expect(v.caBasico).toBe(1);
    expect(v.caMaximo).toBe(4);
    expect(v.origemCA).toBe("zona");
    expect(v.areaComputavel).toBe(4000);
    expect(v.areaBasica).toBe(1000);
    expect(v.areaAdicional).toBe(3000);
  });

  it("respeita o CA informado no terreno (certidão de zoneamento)", () => {
    const v = calcularViabilidade({ ...BASE, caMaximo: 2.5 });
    expect(v.caMaximo).toBe(2.5);
    expect(v.origemCA).toBe("terreno");
    expect(v.areaComputavel).toBe(2500);
  });

  it("deriva área privativa e unidades a partir das premissas", () => {
    const v = calcularViabilidade(BASE);
    expect(v.areaPrivativa).toBeCloseTo(4000 * PREMISSAS_PADRAO.eficienciaPrivativa, 2);
    expect(v.unidadesEstimadas).toBe(
      Math.floor(v.areaPrivativa / PREMISSAS_PADRAO.areaMediaUnidadeM2),
    );
  });

  it("calcula o mínimo de unidades pela cota-parte da ZEU", () => {
    // ZEU: cota-parte máxima de 20 m² por unidade -> 1000/20 = 50 unidades.
    expect(calcularViabilidade(BASE).unidadesMinimasCotaParte).toBe(50);
  });

  it("não quebra com área zero", () => {
    const v = calcularViabilidade({ ...BASE, areaTerreno: 0 });
    expect(v.vgv).toBe(0);
    expect(v.precoMaximoTerreno).toBe(0);
    expect(Number.isFinite(v.margemPct)).toBe(true);
  });
});

describe("outorga onerosa", () => {
  it("segue Ct = (At/Ac) x V x Fs x Fp sobre a área adicional", () => {
    const v = calcularViabilidade(BASE);
    // (1000/4000) x 2500 x 1 x 1 = 625 por m² adicional; 3000 m² adicionais.
    expect(v.outorgaPorM2Adicional).toBeCloseTo(625, 2);
    expect(v.outorga).toBeCloseTo(625 * 3000, 2);
    expect(v.outorgaEstimadaPeloPedido).toBe(false);
  });

  it("zera quando o CA máximo é igual ao básico (não há potencial adicional)", () => {
    const v = calcularViabilidade({ ...BASE, caBasico: 1, caMaximo: 1 });
    expect(v.areaAdicional).toBe(0);
    expect(v.outorga).toBe(0);
  });

  it("responde aos fatores social e de planejamento", () => {
    const cheia = calcularViabilidade(BASE);
    const comFatores = calcularViabilidade(BASE, {
      ...PREMISSAS_PADRAO,
      fatorSocial: 0.5,
      fatorPlanejamento: 0.8,
    });
    expect(comFatores.outorga).toBeCloseTo(cheia.outorga * 0.5 * 0.8, 2);
  });

  it("avisa quando precisou usar o preço pedido como valor de terreno", () => {
    const v = calcularViabilidade({ ...BASE, valorVenalM2: null });
    expect(v.outorgaEstimadaPeloPedido).toBe(true);
    // V = 4.000.000 / 1000 = 4.000/m² -> Ct = (1/4) x 4000 = 1.000/m²
    expect(v.outorgaPorM2Adicional).toBeCloseTo(1000, 2);
  });
});

describe("preço máximo para a margem alvo", () => {
  it("devolve exatamente a margem alvo quando usado como preço de compra", () => {
    const maximo = precoMaximoParaMargem(BASE);
    const v = calcularViabilidade({ ...BASE, precoPedido: maximo });
    expect(v.margemPct).toBeCloseTo(PREMISSAS_PADRAO.margemAlvoPct * 100, 1);
  });

  it("fecha a conta também quando a outorga depende do próprio preço", () => {
    // Sem valor venal, a outorga vira função de P — o cálculo tem que resolver
    // a equação, não simplesmente subtrair uma constante.
    const entrada = { ...BASE, valorVenalM2: null };
    const maximo = precoMaximoParaMargem(entrada);
    const v = calcularViabilidade({ ...entrada, precoPedido: maximo });
    expect(v.margemPct).toBeCloseTo(PREMISSAS_PADRAO.margemAlvoPct * 100, 1);
  });

  it("exige preço menor quando a margem alvo sobe", () => {
    const margem20 = precoMaximoParaMargem(BASE, { ...PREMISSAS_PADRAO, margemAlvoPct: 0.2 });
    const margem30 = precoMaximoParaMargem(BASE, { ...PREMISSAS_PADRAO, margemAlvoPct: 0.3 });
    expect(margem30).toBeLessThan(margem20);
  });

  it("nunca devolve preço negativo em terreno inviável", () => {
    const maximo = precoMaximoParaMargem(BASE, { ...PREMISSAS_PADRAO, precoVendaM2: 1_000 });
    expect(maximo).toBe(0);
  });

  it("produz ordem de grandeza de mercado para um lote padrão de eixo", () => {
    // Guarda contra descalibração das premissas: se alguém mexer nos padrões e
    // o preço máximo sair fora dessa faixa, a conta deixou de refletir o que
    // se pratica em ZEU e o app passa a dar conselho ruim.
    const porM2 = precoMaximoParaMargem(BASE) / BASE.areaTerreno;
    expect(porM2).toBeGreaterThan(1_500);
    expect(porM2).toBeLessThan(8_000);
  });

  it("calcula a folga entre o preço pedido e o máximo", () => {
    const v = calcularViabilidade(BASE);
    expect(v.folga).toBeCloseTo(v.precoMaximoTerreno - 4_000_000, 2);
  });
});

describe("normalizarPremissas", () => {
  it("preenche o que faltar com o padrão", () => {
    const p = normalizarPremissas({ precoVendaM2: 15000 });
    expect(p.precoVendaM2).toBe(15000);
    expect(p.custoObraM2).toBe(PREMISSAS_PADRAO.custoObraM2);
  });

  it("ignora valores inválidos", () => {
    const p = normalizarPremissas({ precoVendaM2: "abc", itbiPct: -1 });
    expect(p.precoVendaM2).toBe(PREMISSAS_PADRAO.precoVendaM2);
    expect(p.itbiPct).toBe(PREMISSAS_PADRAO.itbiPct);
  });

  it("aceita entrada nula", () => {
    expect(normalizarPremissas(null)).toEqual(PREMISSAS_PADRAO);
  });
});
