import { describe, expect, it } from "vitest";

import { dentroDeSaoPaulo, paraUtm23S } from "./projecao";

/**
 * Não há tabela de referência oficial aqui dentro, então os testes checam
 * invariantes que uma fórmula errada não consegue satisfazer por acaso:
 * o meridiano central, a escala em metros e a caixa conhecida da cidade.
 * Erro grosseiro (fuso trocado, radiano/grau, hemisfério) aparece em todos.
 */
describe("projeção para EPSG:31983", () => {
  it("coloca o meridiano central do fuso 23 exatamente no falso leste", () => {
    // Por definição do UTM: em -45° de longitude, x = 500.000 m.
    expect(paraUtm23S(-23.5, -45).x).toBeCloseTo(500_000, 3);
    expect(paraUtm23S(-20, -45).x).toBeCloseTo(500_000, 3);
  });

  it("aplica o falso norte do hemisfério sul", () => {
    // Logo abaixo do equador, y é quase o deslocamento inteiro de 10.000 km...
    const equador = paraUtm23S(-0.001, -45).y;
    expect(equador).toBeLessThan(10_000_000);
    expect(equador).toBeGreaterThan(9_999_800);

    // ...e vai caindo conforme se desce até São Paulo.
    const cidade = paraUtm23S(-23.55, -45).y;
    expect(cidade).toBeLessThan(equador);
    expect(cidade).toBeGreaterThan(7_000_000);
  });

  it("bate com uma implementação independente da mesma projeção", () => {
    // Valores conferidos contra a série de Krüger em n (Karney/OSGB), que é
    // uma formulação diferente da série de Redfearn usada aqui. As duas
    // concordam na décima de milímetro em toda a cidade; um erro de fórmula,
    // de constante do elipsoide ou de fuso separaria as duas em metros.
    const referencia: Array<[number, number, number, number]> = [
      [-23.5505, -46.6333, 333_287.9151, 7_394_588.3186], // Sé
      [-23.4356, -46.7397, 322_271.3115, 7_407_184.7507], // Perus
      [-23.9608, -46.7, 327_021.7116, 7_349_071.0722], // Marsilac
      [-23.5613, -46.373, 359_872.1915, 7_393_671.0531], // São Mateus
    ];

    for (const [lat, lng, x, y] of referencia) {
      const ponto = paraUtm23S(lat, lng);
      expect(ponto.x).toBeCloseTo(x, 2);
      expect(ponto.y).toBeCloseTo(y, 2);
    }
  });

  it("põe o centro de São Paulo dentro da caixa da cidade em UTM", () => {
    // Praça da Sé. A cidade vai de ~314 km a ~366 km em x e de ~7.346 km a
    // ~7.414 km em y no EPSG:31983 — se a projeção errar, cai longe disto.
    const { x, y } = paraUtm23S(-23.5505, -46.6333);

    expect(x).toBeGreaterThan(314_000);
    expect(x).toBeLessThan(366_000);
    expect(y).toBeGreaterThan(7_346_000);
    expect(y).toBeLessThan(7_414_000);
  });

  it("mantém a escala em metros no eixo norte-sul", () => {
    // 0,01° de latitude ≈ 1.106 m no elipsoide; o UTM encolhe por k0 e cresce
    // com a distância ao meridiano central — a soma fica dentro de 5 m.
    const a = paraUtm23S(-23.56, -46.63);
    const b = paraUtm23S(-23.55, -46.63);

    expect(b.y - a.y).toBeGreaterThan(1_100);
    expect(b.y - a.y).toBeLessThan(1_112);
  });

  it("mantém a escala em metros no eixo leste-oeste", () => {
    // 0,01° de longitude em -23,55° ≈ 1.021 m.
    const a = paraUtm23S(-23.55, -46.64);
    const b = paraUtm23S(-23.55, -46.63);

    expect(b.x - a.x).toBeGreaterThan(1_016);
    expect(b.x - a.x).toBeLessThan(1_026);
  });

  it("cresce para leste e para o norte, nunca ao contrário", () => {
    const oeste = paraUtm23S(-23.55, -46.8);
    const leste = paraUtm23S(-23.55, -46.4);
    const sul = paraUtm23S(-23.9, -46.6);
    const norte = paraUtm23S(-23.4, -46.6);

    expect(leste.x).toBeGreaterThan(oeste.x);
    expect(norte.y).toBeGreaterThan(sul.y);
  });
});

describe("recorte do município", () => {
  it("aceita coordenadas da cidade, das pontas ao centro", () => {
    expect(dentroDeSaoPaulo(-23.5505, -46.6333)).toBe(true); // Sé
    expect(dentroDeSaoPaulo(-23.6273, -46.6415)).toBe(true); // Jabaquara
    expect(dentroDeSaoPaulo(-23.96, -46.7)).toBe(true); // Marsilac, extremo sul
    expect(dentroDeSaoPaulo(-23.36, -46.63)).toBe(true); // Cantareira, extremo norte
    expect(dentroDeSaoPaulo(-23.62, -46.38)).toBe(true); // Iguatemi, extremo leste
    expect(dentroDeSaoPaulo(-23.55, -46.79)).toBe(true); // Raposo Tavares, extremo oeste
  });

  it("recusa coordenada que caiu longe demais", () => {
    // Geocodificar "Alphaville" ou "Jardim São Paulo" leva para fora da cidade
    // com frequência — e consultar o GeoSampa nesses pontos é desperdício.
    expect(dentroDeSaoPaulo(-23.5107, -46.8761)).toBe(false); // Barueri
    expect(dentroDeSaoPaulo(-23.9608, -46.3336)).toBe(false); // Santos
    expect(dentroDeSaoPaulo(-22.9, -43.2)).toBe(false); // Rio de Janeiro
  });
});
