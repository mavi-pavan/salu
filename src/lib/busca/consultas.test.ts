import { describe, expect, it } from "vitest";

import { REGIOES, SETORES } from "./regioes";
import {
  amostraDeRegioes,
  MAX_CONSULTAS,
  montarConsultas,
  regioesDaBusca,
  regioesDescartadas,
} from "./consultas";

const base = { regioes: [] as string[], termosExtras: null, maxConsultas: 6 };

describe("regiões marcadas", () => {
  it("pesquisa todas as marcadas, mesmo passando do limite de consultas", () => {
    // O bug que isto trava: com maxConsultas 6, marcar 10 bairros pesquisava
    // 6 e descartava 4 em silêncio.
    const marcadas = REGIOES.slice(0, 10).map((r) => r.nome);
    const usadas = regioesDaBusca({ ...base, regioes: marcadas, maxConsultas: 6 });

    expect(usadas).toHaveLength(10);
    expect(usadas).toEqual(marcadas);
  });

  it("gera uma consulta por região marcada", () => {
    const marcadas = ["Vila Mariana", "Saúde", "Tatuapé"];
    expect(montarConsultas({ ...base, regioes: marcadas })).toHaveLength(3);
  });

  it("corta no teto absoluto e informa o que ficou de fora", () => {
    const marcadas = REGIOES.slice(0, MAX_CONSULTAS + 3).map((r) => r.nome);

    expect(regioesDaBusca({ ...base, regioes: marcadas })).toHaveLength(MAX_CONSULTAS);
    expect(regioesDescartadas({ ...base, regioes: marcadas })).toEqual(marcadas.slice(MAX_CONSULTAS));
  });

  it("não reporta descarte quando cabe tudo", () => {
    const marcadas = ["Pinheiros", "Lapa"];
    expect(regioesDescartadas({ ...base, regioes: marcadas })).toEqual([]);
  });
});

describe("amostra automática", () => {
  it("só usa maxConsultas quando nenhuma região foi marcada", () => {
    expect(regioesDaBusca({ ...base, maxConsultas: 4 })).toHaveLength(4);
  });

  it("distribui entre os setores em vez de pegar os primeiros da lista", () => {
    const amostra = amostraDeRegioes(5);
    const setores = new Set(
      amostra.map((nome) => REGIOES.find((r) => r.nome === nome)?.setor),
    );
    // Cinco regiões, uma de cada setor.
    expect(setores.size).toBe(SETORES.length);
  });

  it("respeita o teto absoluto", () => {
    expect(regioesDaBusca({ ...base, maxConsultas: 999 })).toHaveLength(MAX_CONSULTAS);
  });

  it("nunca devolve lista vazia", () => {
    expect(regioesDaBusca({ ...base, maxConsultas: 0 }).length).toBeGreaterThan(0);
  });
});

describe("texto da consulta", () => {
  it("inclui a região, a cidade e o filtro de portais", () => {
    const [consulta] = montarConsultas({ ...base, regioes: ["Vila Mariana"] });

    expect(consulta).toContain("terreno à venda");
    expect(consulta).toContain("Vila Mariana");
    expect(consulta).toContain("São Paulo");
    expect(consulta).toContain("site:vivareal.com.br");
  });

  it("acrescenta os termos extras quando informados", () => {
    const [consulta] = montarConsultas({
      ...base,
      regioes: ["Saúde"],
      termosExtras: "esquina",
    });
    expect(consulta).toContain("esquina");
  });

  it("não deixa espaço duplicado quando não há termos extras", () => {
    const [consulta] = montarConsultas({ ...base, regioes: ["Saúde"] });
    expect(consulta).not.toMatch(/\s{2}/);
  });
});
