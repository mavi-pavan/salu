import { describe, expect, it } from "vitest";

import { paraUtm23S } from "./projecao";
import type { Anel } from "./poligono";
import type { ZonaChave } from "@/lib/zeu";
import {
  afinarAnel,
  caberNoOrcamento,
  caixaEmMetros,
  contarVertices,
  caixaValida,
  estiloDaZona,
  grandeDemais,
  tocaACidade,
  toleranciaDaCaixa,
  toleranciaParaCaber,
  MAX_LADO_GRAUS,
} from "./zonas-mapa";

describe("área pedida ao GeoSampa", () => {
  const paulista = { sul: -23.567, oeste: -46.663, norte: -23.556, leste: -46.648 };

  it("recusa caixa invertida, vazia ou com número que não é número", () => {
    expect(caixaValida(paulista)).toBe(true);
    // Norte abaixo do sul: quem montou a URL trocou os campos.
    expect(caixaValida({ ...paulista, norte: -23.6 })).toBe(false);
    // Caixa de área zero não tem o que devolver.
    expect(caixaValida({ ...paulista, leste: paulista.oeste })).toBe(false);
    expect(caixaValida({ ...paulista, sul: NaN })).toBe(false);
  });

  it("barra pedido grande demais, que é como a rota vira proxy do estado inteiro", () => {
    expect(grandeDemais(paulista)).toBe(false);
    expect(grandeDemais({ sul: -90, oeste: -180, norte: 90, leste: 180 })).toBe(true);
    expect(
      grandeDemais({ ...paulista, norte: paulista.sul + MAX_LADO_GRAUS + 0.001 }),
    ).toBe(true);
  });

  it("aceita a tela que só encosta na cidade e recusa a que passa longe", () => {
    expect(tocaACidade(paulista)).toBe(true);
    // Divisa com Guarulhos: metade da tela é outra cidade, mas metade é São Paulo.
    expect(tocaACidade({ sul: -23.45, oeste: -46.5, norte: -23.4, leste: -46.4 })).toBe(true);
    // Campinas.
    expect(tocaACidade({ sul: -22.95, oeste: -47.1, norte: -22.85, leste: -47 })).toBe(false);
  });

  it("envolve os quatro cantos ao converter para metros, não só dois", () => {
    // Os meridianos convergem: a borda norte de um retângulo em graus é mais
    // estreita que a sul. Se a conversão usasse só os cantos sudoeste e
    // nordeste, o canto sudeste ficaria de fora — e o polígono que aparece ali
    // na tela sumiria da consulta.
    const caixa = caixaEmMetros(paulista);
    const cantos = [
      paraUtm23S(paulista.sul, paulista.oeste),
      paraUtm23S(paulista.sul, paulista.leste),
      paraUtm23S(paulista.norte, paulista.oeste),
      paraUtm23S(paulista.norte, paulista.leste),
    ];

    for (const canto of cantos) {
      expect(canto.x).toBeGreaterThanOrEqual(caixa.minX);
      expect(canto.x).toBeLessThanOrEqual(caixa.maxX);
      expect(canto.y).toBeGreaterThanOrEqual(caixa.minY);
      expect(canto.y).toBeLessThanOrEqual(caixa.maxY);
    }
  });

  it("dá uma caixa do tamanho da tela, em metros", () => {
    // ~0,015° de longitude em -23,5° ≈ 1,5 km; ~0,011° de latitude ≈ 1,2 km.
    const caixa = caixaEmMetros(paulista);
    expect(caixa.maxX - caixa.minX).toBeGreaterThan(1_400);
    expect(caixa.maxX - caixa.minX).toBeLessThan(1_600);
    expect(caixa.maxY - caixa.minY).toBeGreaterThan(1_150);
    expect(caixa.maxY - caixa.minY).toBeLessThan(1_300);
  });

  it("escala a tolerância com a área, sem descer abaixo do metro", () => {
    const larga = toleranciaDaCaixa({ minX: 0, minY: 0, maxX: 10_000, maxY: 10_000 });
    const dobro = toleranciaDaCaixa({ minX: 0, minY: 0, maxX: 20_000, maxY: 20_000 });

    // Dobrou a área na tela, dobrou quantos metros cabem num pixel — e é em
    // pixel que a simplificação precisa ser imperceptível.
    expect(dobro).toBeCloseTo(larga * 2, 6);
    // Numa tela de uns 2.000 px, a tolerância fica na ordem do pixel: alguns
    // metros num quarteirão, nunca dezenas.
    expect(larga).toBeGreaterThan(2);
    expect(larga).toBeLessThan(12);
    // Tela apertada: o piso segura, senão afinar deixaria de compensar o custo.
    expect(toleranciaDaCaixa({ minX: 0, minY: 0, maxX: 500, maxY: 500 })).toBe(1);
  });
});

describe("orçamento de vértices da resposta", () => {
  it("não mexe na tolerância quando a resposta já cabe", () => {
    expect(toleranciaParaCaber(4, 10_000, 80_000)).toBe(4);
    expect(toleranciaParaCaber(4, 80_000, 80_000)).toBe(4);
  });

  it("afina mais quando o cadastro do trecho é denso demais", () => {
    // Três vezes o orçamento pede três vezes a tolerância: a contagem de
    // vértices cai aproximadamente na razão dela.
    expect(toleranciaParaCaber(4, 240_000, 80_000)).toBeCloseTo(12);
  });

  it("nunca afina menos do que a escala já pedia", () => {
    // Uma resposta pequena não pode relaxar a simplificação e devolver mais
    // detalhe do que cabe num pixel — seria peso sem imagem.
    for (const vertices of [0, 1, 1_000, 79_999]) {
      expect(toleranciaParaCaber(8, vertices, 80_000)).toBe(8);
    }
  });

  it("não divide por zero quando não há orçamento", () => {
    expect(toleranciaParaCaber(4, 100_000, 0)).toBe(4);
  });
});

describe("teto duro do peso da resposta", () => {
  /** Uma zona com `vertices` pontos, o suficiente para a conta de peso. */
  function zona(chave: ZonaChave, vertices: number, id: string = chave) {
    return {
      id,
      zona: chave,
      aneis: [Array.from({ length: vertices }, () => [0, 0] as [number, number])],
    };
  }

  it("deixa passar sem tocar quando a resposta já cabe", () => {
    const zonas = [zona("ZEU", 100), zona("ZM", 100)];
    const saida = caberNoOrcamento(zonas, 1_000);

    expect(saida.zonas).toBe(zonas);
    expect(saida.cortadas).toBe(0);
  });

  it("corta o que não é eixo antes de cortar o eixo", () => {
    // Cabe uma só: a que sai é a ZM, porque a pergunta da tela é sobre eixo.
    const saida = caberNoOrcamento([zona("ZM", 60), zona("ZEU", 60)], 100);

    expect(saida.zonas.map((z) => z.zona)).toEqual(["ZEU"]);
    expect(saida.cortadas).toBe(1);
  });

  it("mantém todo o eixo que couber antes de aceitar qualquer outra zona", () => {
    const saida = caberNoOrcamento(
      [zona("ZM", 40, "zm1"), zona("ZEU", 40, "zeu1"), zona("ZEM", 40, "zem1")],
      100,
    );

    expect(saida.zonas.map((z) => z.id).sort()).toEqual(["zem1", "zeu1"]);
  });

  it("respeita o orçamento de fato, não por aproximação", () => {
    const zonas = Array.from({ length: 50 }, (_, i) => zona("ZM", 30, `z${i}`));
    const saida = caberNoOrcamento(zonas, 200);

    expect(contarVertices(saida.zonas)).toBeLessThanOrEqual(200);
    expect(saida.cortadas).toBeGreaterThan(0);
  });

  it("não deixa uma zona gigante bloquear as pequenas que ainda cabem", () => {
    // Sem o "pula e continua", a primeira que não coubesse encerraria a conta e
    // a tela ficaria vazia por causa de um único polígono recortado demais.
    const saida = caberNoOrcamento(
      [zona("ZM", 5_000, "gigante"), zona("ZM", 10, "pequena")],
      100,
    );

    expect(saida.zonas.map((z) => z.id)).toEqual(["pequena"]);
  });
});

describe("afinar contorno para desenho", () => {
  /** Quadrado de 100 m com um vértice a cada `passo` metros em cada lado. */
  function quadrado(passo: number): Anel {
    const anel: Anel = [];
    for (let x = 0; x < 100; x += passo) anel.push([x, 0]);
    for (let y = 0; y < 100; y += passo) anel.push([100, y]);
    for (let x = 100; x > 0; x -= passo) anel.push([x, 100]);
    for (let y = 100; y > 0; y -= passo) anel.push([0, y]);
    anel.push([0, 0]);
    return anel;
  }

  it("descarta os vértices que cairiam no mesmo pixel", () => {
    const denso = quadrado(0.5); // 800 pontos para desenhar um quadrado
    const afinado = afinarAnel(denso, 5);

    expect(afinado.length).toBeLessThan(denso.length / 5);
    // O contorno continua sendo o mesmo quadrado.
    for (const [x, y] of afinado) {
      expect(Math.min(x, y, 100 - x, 100 - y)).toBeGreaterThanOrEqual(0);
    }
  });

  it("mantém fechado o anel, que é o que faz dele um polígono", () => {
    const afinado = afinarAnel(quadrado(0.5), 7);
    const primeiro = afinado[0];
    const ultimo = afinado[afinado.length - 1];

    expect(primeiro).toEqual(ultimo);
  });

  it("devolve o original quando afinar viraria um triângulo", () => {
    // Tolerância maior que a figura inteira: sem esta guarda, a quadra sumiria
    // ou viraria uma forma que nunca existiu.
    const anel = quadrado(10);
    expect(afinarAnel(anel, 10_000)).toBe(anel);
  });

  it("não mexe em anel que já é mínimo", () => {
    const triangulo: Anel = [
      [0, 0],
      [10, 0],
      [0, 10],
      [0, 0],
    ];
    expect(afinarAnel(triangulo, 100)).toBe(triangulo);
  });

  it("preserva quinas afastadas mesmo com tolerância alta", () => {
    // Um "L" de lados longos: qualquer tolerância abaixo do lado tem que
    // manter as quinas, senão a forma vira outra coisa.
    const ele: Anel = [
      [0, 0],
      [100, 0],
      [100, 40],
      [40, 40],
      [40, 100],
      [0, 100],
      [0, 0],
    ];
    expect(afinarAnel(ele, 20)).toEqual(ele);
  });
});

describe("cor da zona no mapa", () => {
  it("destaca o eixo e apaga o resto", () => {
    const eixo = estiloDaZona("ZEU");
    const comum = estiloDaZona("ZM");

    expect(eixo.cor).not.toBe(comum.cor);
    expect(eixo.opacidadePreenchimento).toBeGreaterThan(comum.opacidadePreenchimento);
  });

  it("trata toda a família de eixo igual, não só a ZEU", () => {
    const referencia = estiloDaZona("ZEU");
    for (const zona of ["ZEUa", "ZEUP", "ZEUPa", "ZEM", "ZEMP"] as const) {
      expect(estiloDaZona(zona)).toEqual(referencia);
    }
  });
});
