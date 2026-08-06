import { describe, expect, it } from "vitest";

import {
  calcularScore,
  faixaScore,
  normalizarPesos,
  PESOS_PADRAO,
  precoPorPotencial,
  type EntradaScore,
} from "./scoring";

const COMPLETO: EntradaScore = {
  zona: "ZEU",
  areaTerreno: 2000,
  testada: 35,
  precoPedido: 6_000_000,
  distanciaEstacaoM: 250,
  topografia: "PLANA",
  ocupacao: "VAZIO",
  situacaoDocumental: "REGULAR",
  motivacaoVendedor: "ALTA",
};

describe("dados faltantes", () => {
  it("não penaliza critério sem dado — ele sai da média", () => {
    const semPreco = calcularScore({ ...COMPLETO, precoPedido: null });
    const criterio = semPreco.criterios.find((c) => c.chave === "preco_potencial");

    expect(criterio?.nota).toBeNull();
    expect(criterio?.contribuicao).toBe(0);
    // Se virasse zero, o total desabaria; aqui ele continua alto.
    expect(semPreco.total).toBeGreaterThan(80);
  });

  it("reflete a falta de dados na cobertura", () => {
    expect(calcularScore(COMPLETO).cobertura).toBe(100);

    const magro = calcularScore({ zona: "A_VERIFICAR", areaTerreno: 1000 });
    // Só área e restrições têm dado: 15 + 15 de 100 de peso.
    expect(magro.cobertura).toBe(30);
  });

  it("mantém o total entre 0 e 100 mesmo sem nenhum dado opcional", () => {
    const vazio = calcularScore({ zona: "A_VERIFICAR", areaTerreno: 0 });
    expect(vazio.total).toBeGreaterThanOrEqual(0);
    expect(vazio.total).toBeLessThanOrEqual(100);
  });
});

describe("critérios", () => {
  it("premia terreno bem posicionado e barato", () => {
    const resultado = calcularScore(COMPLETO);
    expect(resultado.total).toBeGreaterThan(85);
    expect(faixaScore(resultado.total).faixa).toBe("excelente");
  });

  it("derruba a nota de restrições conforme as penalidades se acumulam", () => {
    const limpo = calcularScore(COMPLETO);
    const comProblemas = calcularScore({
      ...COMPLETO,
      areaContaminada: true,
      melhoramentoViario: true,
    });

    const notaLimpa = limpo.criterios.find((c) => c.chave === "restricoes")?.nota;
    const notaSuja = comProblemas.criterios.find((c) => c.chave === "restricoes")?.nota;

    expect(notaLimpa).toBe(10);
    // 10 - 6 (contaminação) - 4 (melhoramento viário) = 0
    expect(notaSuja).toBe(0);
    expect(comProblemas.total).toBeLessThan(limpo.total);
  });

  it("penaliza testada curta", () => {
    const estreito = calcularScore({ ...COMPLETO, testada: 9 });
    const largo = calcularScore({ ...COMPLETO, testada: 50 });
    expect(estreito.total).toBeLessThan(largo.total);
  });

  it("piora a nota conforme o terreno se afasta do transporte", () => {
    const notas = [200, 600, 1200, 3000].map(
      (d) =>
        calcularScore({ ...COMPLETO, distanciaEstacaoM: d }).criterios.find(
          (c) => c.chave === "distancia_estacao",
        )?.nota ?? 0,
    );
    // Monotonicamente decrescente.
    expect(notas).toEqual([...notas].sort((a, b) => b - a));
  });

  it("usa o CA da zona no preço por potencial", () => {
    // 6.000.000 / (2000 x 4) = 750/m²
    expect(precoPorPotencial(COMPLETO)).toBeCloseTo(750, 2);
    // Em ZC o CA máximo é 2 -> o mesmo preço dobra por m² de potencial.
    expect(precoPorPotencial({ ...COMPLETO, zona: "ZC" })).toBeCloseTo(1500, 2);
  });
});

describe("alertas", () => {
  it("marca tombamento como bloqueio", () => {
    const alertas = calcularScore({ ...COMPLETO, tombado: true }).alertas;
    expect(alertas.some((a) => a.nivel === "bloqueio" && /tombado/i.test(a.texto))).toBe(true);
  });

  it("bloqueia zona que não comporta o produto", () => {
    const alertas = calcularScore({ ...COMPLETO, zona: "ZR" }).alertas;
    expect(alertas.some((a) => a.nivel === "bloqueio")).toBe(true);
  });

  it("avisa sobre eixo previsto e sobre zona não confirmada", () => {
    expect(
      calcularScore({ ...COMPLETO, zona: "ZEUP" }).alertas.some((a) =>
        /previsto/i.test(a.texto),
      ),
    ).toBe(true);

    expect(
      calcularScore({ ...COMPLETO, zona: "A_VERIFICAR" }).alertas.some((a) =>
        /GeoSampa/i.test(a.texto),
      ),
    ).toBe(true);
  });

  it("lembra da fruição pública em lote grande", () => {
    const alertas = calcularScore({ ...COMPLETO, areaTerreno: 6000 }).alertas;
    expect(alertas.some((a) => /fruição pública/i.test(a.texto))).toBe(true);
  });
});

describe("pesos", () => {
  it("muda o resultado quando o peso muda", () => {
    const barato = { ...COMPLETO, precoPedido: 2_000_000 };
    const padrao = calcularScore(barato, PESOS_PADRAO);
    const soPreco = calcularScore(barato, {
      ...PESOS_PADRAO,
      preco_potencial: 100,
    });
    expect(soPreco.total).not.toBeCloseTo(padrao.total, 5);
  });

  it("ignora peso zero sem quebrar a média", () => {
    const semPeso = calcularScore(COMPLETO, { ...PESOS_PADRAO, preco_potencial: 0 });
    expect(Number.isFinite(semPeso.total)).toBe(true);
    expect(semPeso.criterios.find((c) => c.chave === "preco_potencial")?.contribuicao).toBe(0);
  });

  it("normaliza pesos inválidos para o padrão", () => {
    const pesos = normalizarPesos({ area: 25, testada: -5, zona: "abc", inexistente: 99 });
    expect(pesos.area).toBe(25);
    expect(pesos.testada).toBe(PESOS_PADRAO.testada);
    expect(pesos.zona).toBe(PESOS_PADRAO.zona);
  });
});

describe("faixaScore", () => {
  it("classifica nas quatro faixas", () => {
    expect(faixaScore(92).faixa).toBe("excelente");
    expect(faixaScore(70).faixa).toBe("bom");
    expect(faixaScore(50).faixa).toBe("medio");
    expect(faixaScore(20).faixa).toBe("fraco");
  });
});
