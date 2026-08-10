import { describe, expect, it } from "vitest";

import {
  areaPorDimensoes,
  dominio,
  extrairArea,
  extrairBairro,
  extrairCep,
  extrairDistanciaEstacaoM,
  extrairEstacao,
  extrairLogradouro,
  extrairNumero,
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

describe("área escrita de outro jeito", () => {
  it("lê as medidas de frente e fundo", () => {
    // Sem isto, o anúncio inteiro era descartado por "não ter área".
    expect(extrairArea("Terreno 10x30 na Vila Mariana")).toBe(300);
    expect(extrairArea("Terreno 12,5 x 40 m, plano")).toBe(500);
    expect(extrairArea("Ótimo lote 20m x 50m para incorporação")).toBe(1000);
  });

  it("prefere a área declarada em m² às medidas", () => {
    // "10x30" pode ser a testada de um dos lotes; a área escrita é a do todo.
    expect(extrairArea("Terreno de 1.200 m², sendo 10x30 a frente")).toBe(1200);
  });

  it("converte hectare de gleba", () => {
    expect(extrairArea("Gleba de 1,2 ha em Parelheiros")).toBe(12_000);
    expect(extrairArea("Área de 2 hectares")).toBe(20_000);
  });

  it("ignora medida que não é de lote urbano", () => {
    expect(areaPorDimensoes("apartamento 2x1 com 2 vagas")).toBeNull();
    expect(areaPorDimensoes("terreno 1000x900")).toBeNull();
  });
});

describe("estação e distância", () => {
  it("acha a estação citada", () => {
    expect(extrairEstacao("Terreno a 200m do Metrô Praça da Árvore")).toBe("Praça da Árvore");
    expect(extrairEstacao("Ótima área, estação Ana Rosa a poucos passos")).toBe("Ana Rosa");
  });

  it("prefere o nome mais longo quando um contém o outro", () => {
    expect(extrairEstacao("Terreno perto da estação Santa Cruz")).toBe("Santa Cruz");
  });

  it("aceita estação fora da lista curada", () => {
    expect(extrairEstacao("Terreno ao lado do Metrô Barra Funda")).toBeTruthy();
  });

  it("não inventa estação onde não há", () => {
    expect(extrairEstacao("Terreno plano com muro em toda a volta")).toBeNull();
  });

  it("lê a distância em metros e em quilômetros", () => {
    expect(extrairDistanciaEstacaoM("Terreno a 250m do metrô")).toBe(250);
    expect(extrairDistanciaEstacaoM("A 1,2 km da estação da CPTM")).toBe(1200);
    expect(extrairDistanciaEstacaoM("400 metros do metrô Saúde")).toBe(400);
  });

  it("descarta distância implausível", () => {
    expect(extrairDistanciaEstacaoM("a 15 km do metrô")).toBeNull();
    expect(extrairDistanciaEstacaoM("a 5 m do metrô")).toBeNull();
  });

  it("não converte tempo de caminhada em distância", () => {
    // Viraria metro só arbitrando velocidade — precisão que o anúncio não tem.
    expect(extrairDistanciaEstacaoM("a 5 minutos a pé do metrô")).toBeNull();
  });

  it("não confunde metragem do lote com distância", () => {
    expect(extrairDistanciaEstacaoM("Terreno de 300 m² na Vila Mariana")).toBeNull();
  });
});

describe("estação: nome de bairro não é estação", () => {
  it("não reporta estação quando o anúncio só cita o bairro", () => {
    // Saúde, Lapa, Moema, Penha e Brás são bairro E estação. Sem palavra de
    // transporte no texto, o anúncio não citou estação nenhuma.
    expect(extrairEstacao("Terreno à venda na Saúde, 800 m², plano")).toBeNull();
    expect(extrairEstacao("Ótimo lote na Lapa com muro")).toBeNull();
    expect(extrairEstacao("Área em Moema para incorporação")).toBeNull();
  });

  it("reporta quando o transporte aparece no texto", () => {
    expect(extrairEstacao("Terreno na Saúde, a 300m do metrô")).toBe("Saúde");
    expect(extrairEstacao("Lote na Lapa, perto da estação da CPTM")).toBe("Lapa");
  });
});

describe("palavra de transporte", () => {
  it('não acha "trem" dentro de outra palavra', () => {
    expect(extrairEstacao("Terreno em extremo bom estado na Saúde")).toBeNull();
    expect(extrairEstacao("Lote tremendamente bem localizado na Lapa")).toBeNull();
  });
});

describe("número e CEP: o que decide a precisão da coordenada", () => {
  it("extrai o número do logradouro", () => {
    // Geocodificar só a rua devolve o meio dela; numa via longa, o meio pode
    // estar em zona diferente do lote.
    expect(extrairNumero("Terreno na Rua Domingos de Morais, 1842")).toBe("1842");
    expect(extrairNumero("Av. Jabaquara, 2210 - Saúde")).toBe("2210");
    expect(extrairNumero("Rua Vergueiro nº 987, Vila Mariana")).toBe("987");
  });

  it("não confunde metragem com número de porta", () => {
    expect(extrairNumero("Terreno na Rua Vergueiro, 1.250 m² de área")).toBeNull();
    expect(extrairNumero("Rua Luís Góis, 800 mil de entrada")).toBeNull();
  });

  it("devolve null quando o anúncio não dá o número", () => {
    expect(extrairNumero("Terreno na Rua Domingos de Morais, Vila Mariana")).toBeNull();
    expect(extrairNumero("Terreno na Vila Mariana")).toBeNull();
  });

  it("extrai CEP da capital, com ou sem hífen", () => {
    expect(extrairCep("Terreno na Vila Mariana, CEP 04101-300")).toBe("04101-300");
    expect(extrairCep("Endereço: 01310100")).toBe("01310-100");
  });

  it("ignora número de oito dígitos que não é CEP da capital", () => {
    // Telefone, código de anúncio e CEP de outra cidade caem aqui.
    expect(extrairCep("Contato 11987654321")).toBeNull();
    expect(extrairCep("CEP 90210-000")).toBeNull();
  });
});

describe("caixa do texto no logradouro", () => {
  it("aceita as três formas em que o anúncio escreve a via", () => {
    expect(extrairLogradouro("TERRENO NA RUA DOMINGOS DE MORAIS, 1842")).toContain("DOMINGOS");
    expect(extrairLogradouro("Terreno na Praça da República, 123")).toBe("Praça da República");
    expect(extrairNumero("TERRENO NA RUA DOMINGOS DE MORAIS, 1842")).toBe("1842");
  });

  it("exige nome próprio, mesmo perdendo anúncio todo em minúscula", () => {
    // Decisão consciente: aceitar nome em minúscula faria "rua tranquila e
    // arborizada" virar logradouro, que seria geocodificado e confirmaria uma
    // zona errada com toda a confiança. Perder o anúncio é o erro mais barato.
    expect(extrairLogradouro("terreno na rua vergueiro, 987")).toBeNull();
    expect(extrairLogradouro("terreno em rua tranquila e arborizada")).toBeNull();
  });

  it("não lê o começo do CEP como número de porta", () => {
    // "Praça da Árvore. CEP 04043-100" era lido como logradouro + número 04043.
    const texto = "Rua Luís Góis, próximo ao metrô Praça da Árvore. CEP 04043-100.";
    expect(extrairNumero(texto)).toBeNull();
    expect(extrairCep(texto)).toBe("04043-100");
  });
});
