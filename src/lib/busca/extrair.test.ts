import { describe, expect, it } from "vitest";

import {
  dominio,
  extrairArea,
  extrairBairro,
  extrairLogradouro,
  extrairPreco,
  extrairTudo,
  extrairZonaMencionada,
  numeroBR,
} from "./extrair";

describe("numeroBR", () => {
  it("entende ponto de milhar e vírgula decimal", () => {
    expect(numeroBR("1.250,50")).toBe(1250.5);
    expect(numeroBR("1.250")).toBe(1250);
    expect(numeroBR("2,5")).toBe(2.5);
    expect(numeroBR("980")).toBe(980);
    expect(numeroBR("12.500.000")).toBe(12_500_000);
  });

  it("trata ponto decimal quando não parece milhar", () => {
    expect(numeroBR("1.5")).toBe(1.5);
  });

  it("devolve null para lixo", () => {
    expect(numeroBR("")).toBeNull();
    expect(numeroBR("abc")).toBeNull();
  });
});

describe("extrairArea", () => {
  it("lê os formatos comuns de anúncio", () => {
    expect(extrairArea("Terreno à venda, 1.250 m² por R$ 3.750.000")).toBe(1250);
    expect(extrairArea("Terreno 820m2 na Vila Mariana")).toBe(820);
    expect(extrairArea("Área de 2.400 metros quadrados")).toBe(2400);
  });

  it("prefere a área do terreno quando o anúncio também cita a construída", () => {
    const texto = "Casa com 320 m² de área construída em terreno de 1.000 m²";
    expect(extrairArea(texto)).toBe(1000);
  });

  it("ignora números fora da faixa plausível", () => {
    expect(extrairArea("Sala de 40 m² no centro")).toBeNull();
    expect(extrairArea("Fazenda de 900.000 m²")).toBeNull();
  });

  it("devolve null quando não há área", () => {
    expect(extrairArea("Terreno em ótima localização, consulte")).toBeNull();
  });
});

describe("extrairPreco", () => {
  it("lê valor cheio e abreviado", () => {
    expect(extrairPreco("por R$ 3.750.000")).toBe(3_750_000);
    expect(extrairPreco("R$ 2,5 milhões")).toBe(2_500_000);
    expect(extrairPreco("R$ 850 mil")).toBe(850_000);
  });

  it("descarta valores pequenos demais para ser o preço do imóvel", () => {
    // Condomínio e IPTU aparecem no mesmo trecho e não podem ser confundidos.
    expect(extrairPreco("R$ 1.200 de condomínio")).toBeNull();
    expect(extrairPreco("R$ 4.500.000 · condomínio R$ 800")).toBe(4_500_000);
  });
});

describe("endereço e bairro", () => {
  it("extrai o logradouro", () => {
    expect(extrairLogradouro("Terreno na Rua Domingos de Morais, 1842")).toBe(
      "Rua Domingos de Morais",
    );
    expect(extrairLogradouro("Av. Jabaquara, 2210 - Saúde")).toContain("Jabaquara");
  });

  it("reconhece bairros de eixo", () => {
    expect(extrairBairro("Terreno à venda na Vila Mariana, São Paulo")).toBe("Vila Mariana");
    expect(extrairBairro("Lote em Tucuruvi")).toBe("Tucuruvi");
  });

  it("prefere o nome mais longo quando há sobreposição", () => {
    expect(extrairBairro("Terreno na Chácara Santo Antônio")).toBe("Chácara Santo Antônio");
  });

  it("devolve null para bairro fora da lista", () => {
    expect(extrairBairro("Terreno em Campinas")).toBeNull();
  });
});

describe("zona citada no anúncio", () => {
  it("reconhece a sigla quando o anunciante informa", () => {
    expect(extrairZonaMencionada("Terreno em ZEU, ótimo para incorporação")).toBe("ZEU");
    expect(extrairZonaMencionada("zoneamento ZEUP")).toBe("ZEUP");
  });

  it("devolve null quando não há menção", () => {
    expect(extrairZonaMencionada("Terreno plano com 1.000 m²")).toBeNull();
  });
});

describe("extrairTudo", () => {
  it("monta o registro completo a partir de título e trecho", () => {
    const dados = extrairTudo(
      "Terreno à venda, 1.480 m² por R$ 5.900.000 - Vila Mariana, São Paulo/SP",
      "Excelente terreno na Rua Domingos de Morais, plano, ideal para incorporação em ZEU.",
    );

    expect(dados.areaM2).toBe(1480);
    expect(dados.precoBRL).toBe(5_900_000);
    expect(dados.bairro).toBe("Vila Mariana");
    expect(dados.endereco).toBe("Rua Domingos de Morais");
    expect(dados.zonaTexto).toBe("ZEU");
  });
});

describe("dominio", () => {
  it("tira o www e devolve só o host", () => {
    expect(dominio("https://www.vivareal.com.br/imovel/123")).toBe("vivareal.com.br");
  });

  it("não quebra com url inválida", () => {
    expect(dominio("nao-e-url")).toBe("desconhecido");
  });
});
