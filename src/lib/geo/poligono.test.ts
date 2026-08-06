import { describe, expect, it } from "vitest";

import {
  calcularBbox,
  dentroDaBbox,
  extrairPoligonos,
  pontoEmAlgum,
  pontoNoPoligono,
  type Poligono,
} from "./poligono";

/** Quadrado de 10x10 na origem. */
const QUADRADO: Poligono = [
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ],
];

/** Mesmo quadrado com um buraco central de 4x4. */
const COM_BURACO: Poligono = [
  QUADRADO[0]!,
  [
    [3, 3],
    [7, 3],
    [7, 7],
    [3, 7],
    [3, 3],
  ],
];

describe("ponto em polígono", () => {
  it("acerta dentro e fora", () => {
    expect(pontoNoPoligono(5, 5, QUADRADO)).toBe(true);
    expect(pontoNoPoligono(15, 5, QUADRADO)).toBe(false);
    expect(pontoNoPoligono(-1, 5, QUADRADO)).toBe(false);
    expect(pontoNoPoligono(5, 11, QUADRADO)).toBe(false);
  });

  it("respeita buraco", () => {
    // Miolo de quadra excluído da zona: está no contorno mas dentro do buraco.
    expect(pontoNoPoligono(5, 5, COM_BURACO)).toBe(false);
    expect(pontoNoPoligono(1, 1, COM_BURACO)).toBe(true);
  });

  it("varre uma lista de polígonos (MultiPolygon)", () => {
    const outro: Poligono = [
      [
        [20, 20],
        [30, 20],
        [30, 30],
        [20, 30],
        [20, 20],
      ],
    ];
    expect(pontoEmAlgum(25, 25, [QUADRADO, outro])).toBe(true);
    expect(pontoEmAlgum(15, 15, [QUADRADO, outro])).toBe(false);
  });

  it("não quebra com anel degenerado", () => {
    expect(pontoNoPoligono(1, 1, [[]])).toBe(false);
    expect(pontoEmAlgum(1, 1, [])).toBe(false);
  });
});

describe("bbox", () => {
  it("envolve todos os anéis", () => {
    expect(calcularBbox([QUADRADO])).toEqual([0, 0, 10, 10]);
  });

  it("filtra ponto fora antes do teste caro", () => {
    const caixa = calcularBbox([QUADRADO]);
    expect(dentroDaBbox(5, 5, caixa)).toBe(true);
    expect(dentroDaBbox(50, 5, caixa)).toBe(false);
    // A borda conta como dentro: descartar aqui perderia lote de esquina.
    expect(dentroDaBbox(10, 10, caixa)).toBe(true);
  });
});

describe("leitura de geometria GeoJSON", () => {
  it("aceita Polygon e MultiPolygon", () => {
    expect(extrairPoligonos({ type: "Polygon", coordinates: QUADRADO })).toHaveLength(1);
    expect(extrairPoligonos({ type: "MultiPolygon", coordinates: [QUADRADO, QUADRADO] })).toHaveLength(2);
  });

  it("ignora geometria que não é área", () => {
    expect(extrairPoligonos({ type: "Point", coordinates: [1, 2] })).toEqual([]);
    expect(extrairPoligonos({ type: "LineString", coordinates: [] })).toEqual([]);
    expect(extrairPoligonos(null)).toEqual([]);
    expect(extrairPoligonos(undefined)).toEqual([]);
  });
});
