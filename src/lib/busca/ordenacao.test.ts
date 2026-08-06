import { describe, expect, it } from "vitest";

import { ordenarPorPrioridade, type Ordenavel } from "./ordenacao";

const item = (chave: string, areaM2: number | null, precoBRL: number | null): Ordenavel => ({
  chave,
  areaM2,
  precoBRL,
});

/** Embaralhamento determinístico, para o teste não depender de sorte. */
function embaralhar<T>(itens: T[], semente: number): T[] {
  const saida = [...itens];
  let estado = semente;
  for (let i = saida.length - 1; i > 0; i--) {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    const j = estado % (i + 1);
    [saida[i], saida[j]] = [saida[j]!, saida[i]!];
  }
  return saida;
}

const CANDIDATOS: Ordenavel[] = [
  item("portal.com/a", 1200, 5_000_000),
  item("portal.com/b", 800, null),
  item("portal.com/c", null, 3_000_000),
  item("portal.com/d", 2400, 9_000_000),
  item("portal.com/e", null, null),
  item("portal.com/f", 800, 2_000_000),
  item("portal.com/g", 1200, 4_000_000),
];

describe("ordem de prioridade", () => {
  it("devolve sempre a mesma ordem, venha a lista como vier", () => {
    // Este é o teste que importa: era daqui que vinha "os mesmos filtros
    // devolvem resultados diferentes". O buscador entrega os mesmos anúncios
    // em ordem diferente a cada execução.
    const referencia = ordenarPorPrioridade(CANDIDATOS).map((i) => i.chave);

    for (const semente of [1, 7, 42, 1234, 99999]) {
      const desordenado = embaralhar(CANDIDATOS, semente);
      expect(ordenarPorPrioridade(desordenado).map((i) => i.chave)).toEqual(referencia);
    }
  });

  it("põe quem tem área e preço na frente de quem tem só um", () => {
    const ordem = ordenarPorPrioridade(CANDIDATOS).map((i) => i.chave);
    const completos = ["portal.com/d", "portal.com/a", "portal.com/g", "portal.com/f"];

    expect(ordem.slice(0, 4)).toEqual(completos);
    expect(ordem[ordem.length - 1]).toBe("portal.com/e"); // sem nada, por último
  });

  it("entre iguais, o terreno maior vem primeiro", () => {
    const ordem = ordenarPorPrioridade([
      item("x", 900, 1_000_000),
      item("y", 3000, 1_000_000),
      item("z", 1500, 1_000_000),
    ]).map((i) => i.chave);

    expect(ordem).toEqual(["y", "z", "x"]);
  });

  it("desempata pela chave, para não sobrar aleatoriedade", () => {
    const ordem = ordenarPorPrioridade([
      item("portal.com/z", 1000, 1_000_000),
      item("portal.com/a", 1000, 1_000_000),
    ]).map((i) => i.chave);

    expect(ordem).toEqual(["portal.com/a", "portal.com/z"]);
  });

  it("não altera a lista recebida", () => {
    const original = [...CANDIDATOS];
    ordenarPorPrioridade(CANDIDATOS);
    expect(CANDIDATOS).toEqual(original);
  });
});
