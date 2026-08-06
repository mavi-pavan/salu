import { describe, expect, it } from "vitest";

import { REGIOES, SETORES } from "./regioes";
import {
  amostraDeRegioes,
  MAX_CONSULTAS,
  montarConsultas,
  regioesDaBusca,
  regioesDescartadas,
  semFiltroDeSites,
  VARIACOES_PADRAO,
  type Variacao,
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

  it("cobre toda região marcada, uma consulta por variação escolhida", () => {
    const marcadas = ["Vila Mariana", "Saúde", "Tatuapé"];

    // Só bairro: uma consulta cada.
    expect(montarConsultas({ ...base, regioes: marcadas, variacoes: ["bairro"] })).toHaveLength(3);

    // Com estações entram mais consultas, e nenhuma região fica de fora.
    const comEstacoes = montarConsultas({ ...base, regioes: marcadas });
    expect(comEstacoes.length).toBeGreaterThan(3);
    for (const nome of marcadas) {
      expect(comEstacoes.some((c) => c.includes(nome))).toBe(true);
    }
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

describe("variações da consulta", () => {
  const so = (v: Variacao) => ({ ...base, variacoes: [v] });

  it("por bairro procura o bairro inteiro", () => {
    const consultas = montarConsultas({ ...so("bairro"), regioes: ["Vila Mariana"] });
    expect(consultas).toHaveLength(1);
    expect(consultas[0]).toContain("terreno à venda Vila Mariana");
  });

  it("por estação gera uma consulta para cada estação da região", () => {
    // É a consulta que mira na ZEU: a zona é uma faixa em torno da estação,
    // não o bairro inteiro.
    const consultas = montarConsultas({ ...so("estacao"), regioes: ["Vila Mariana"] });
    const estacoes = REGIOES.find((r) => r.nome === "Vila Mariana")!.estacoes;

    expect(consultas).toHaveLength(estacoes.length);
    for (const estacao of estacoes) {
      expect(consultas.some((c) => c.includes(`estação ${estacao}`))).toBe(true);
    }
  });

  it("por incorporação usa o vocabulário de quem vende para incorporador", () => {
    const [consulta] = montarConsultas({ ...so("incorporacao"), regioes: ["Saúde"] });
    expect(consulta).toContain("área para incorporação Saúde");
  });

  it("soma as variações escolhidas", () => {
    const regiao = REGIOES.find((r) => r.nome === "Moema")!;
    const consultas = montarConsultas({
      ...base,
      regioes: ["Moema"],
      variacoes: ["bairro", "estacao", "incorporacao"],
    });
    expect(consultas).toHaveLength(2 + regiao.estacoes.length);
  });

  it("sem variação escolhida, usa o padrão", () => {
    const comPadrao = montarConsultas({ ...base, regioes: ["Moema"], variacoes: [] });
    const explicito = montarConsultas({ ...base, regioes: ["Moema"], variacoes: VARIACOES_PADRAO });
    expect(comPadrao).toEqual(explicito);
  });

  it("toda região tem pelo menos uma estação para procurar", () => {
    for (const regiao of REGIOES) {
      expect(regiao.estacoes.length, `${regiao.nome} sem estação`).toBeGreaterThan(0);
    }
  });
});

describe("repartição da cota entre regiões", () => {
  it("dá uma consulta a cada região antes de dar a segunda a alguém", () => {
    // O que isto trava: as estações da primeira região comendo as vinte
    // consultas e as outras dezenove ficando sem nenhuma.
    const marcadas = REGIOES.slice(0, MAX_CONSULTAS).map((r) => r.nome);
    const consultas = montarConsultas({
      ...base,
      regioes: marcadas,
      variacoes: ["bairro", "estacao"],
    });

    expect(consultas).toHaveLength(MAX_CONSULTAS);
    for (const nome of marcadas) {
      expect(consultas.some((c) => c.includes(nome)), `${nome} ficou sem consulta`).toBe(true);
    }
  });

  it("respeita o teto absoluto mesmo com muitas estações", () => {
    const marcadas = REGIOES.slice(0, 15).map((r) => r.nome);
    const consultas = montarConsultas({
      ...base,
      regioes: marcadas,
      variacoes: ["bairro", "estacao", "incorporacao"],
    });
    expect(consultas.length).toBeLessThanOrEqual(MAX_CONSULTAS);
  });

  it("na amostra automática, maxConsultas é orçamento de consultas, não de regiões", () => {
    // Seis variações por região transformariam "6 consultas" em dezoito.
    const consultas = montarConsultas({
      ...base,
      maxConsultas: 6,
      variacoes: ["bairro", "estacao", "incorporacao"],
    });
    expect(consultas).toHaveLength(6);
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

describe("plano B sem filtro de portais", () => {
  it("remove o grupo site: do fim da consulta", () => {
    const [consulta] = montarConsultas({ ...base, regioes: ["Moema"] });
    const simples = semFiltroDeSites(consulta!);

    expect(consulta).toContain("site:");
    expect(simples).not.toContain("site:");
    expect(simples).toContain("Moema");
    expect(simples).toContain("terreno à venda");
  });

  it("não mexe em consulta que já não tem filtro", () => {
    const simples = "terreno à venda Moema São Paulo m²";
    expect(semFiltroDeSites(simples)).toBe(simples);
  });

  it("não deixa espaço sobrando na ponta", () => {
    const [consulta] = montarConsultas({ ...base, regioes: ["Lapa"] });
    const simples = semFiltroDeSites(consulta!);
    expect(simples).toBe(simples.trim());
  });

  it("é idempotente", () => {
    // A busca depende disso: quando o provedor recusa operadores, ela passa a
    // enviar a versão simples direto e usa a diferença entre as duas para saber
    // que não há mais o que tentar. Se aplicar duas vezes mudasse o texto, cada
    // consulta viraria uma tentativa perdida a mais.
    const [consulta] = montarConsultas({ ...base, regioes: ["Lapa"] });
    const uma = semFiltroDeSites(consulta!);
    expect(semFiltroDeSites(uma)).toBe(uma);
  });
});
