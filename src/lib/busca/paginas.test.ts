import { describe, expect, it } from "vitest";

import { classificarPagina, temIdDeAnuncio, tituloDeListagem } from "./paginas";

/**
 * Os endereços abaixo seguem o formato real de cada portal. É o que separa
 * "achei um lote" de "achei a página de busca do portal" — a queixa que
 * motivou esta classificação.
 */
const ANUNCIOS: Array<[string, string, string]> = [
  [
    "VivaReal",
    "Terreno à venda, 1.250 m² por R$ 4.200.000 - Vila Mariana, São Paulo/SP",
    "https://www.vivareal.com.br/imovel/terreno-a-venda-vila-mariana-zona-sul-sao-paulo-1250m2-id-2712345678/",
  ],
  [
    "ZAP Imóveis",
    "Terreno à venda, 820 m² - Saúde, São Paulo/SP",
    "https://www.zapimoveis.com.br/imovel/venda-terreno-saude-sao-paulo-sp-820m2-id-2798765432/",
  ],
  [
    "OLX",
    "Terreno 1.000 m² Vila Mariana",
    "https://sp.olx.com.br/sao-paulo-e-regiao/imoveis/terrenos/terreno-1000m2-vila-mariana-1234567890",
  ],
  [
    "Imovelweb",
    "Terreno à venda, 640 m² por R$ 2.450.000",
    "https://www.imovelweb.com.br/propriedades/terreno-a-venda-vila-mariana-640m2-2987654321.html",
  ],
  [
    "Chaves na Mão",
    "Terreno à venda em Moema, São Paulo",
    "https://www.chavesnamao.com.br/imovel/terreno-a-venda-sp-sao-paulo-moema-1000m2/id-1234567/",
  ],
];

const LISTAGENS: Array<[string, string, string]> = [
  [
    "VivaReal por bairro",
    "Terrenos à venda em Vila Mariana, São Paulo | Viva Real",
    "https://www.vivareal.com.br/venda/sp/sao-paulo/zona-sul/vila-mariana/lote-terreno_residencial/",
  ],
  [
    "ZAP por bairro",
    "1.234 Terrenos à venda em São Paulo - SP | ZAP Imóveis",
    "https://www.zapimoveis.com.br/venda/terrenos/sp+sao-paulo+zona-sul+vila-mariana/",
  ],
  [
    "OLX categoria",
    "Terrenos à venda em São Paulo e região | OLX",
    "https://www.olx.com.br/imoveis/terrenos/estado-sp/sao-paulo-e-regiao",
  ],
  [
    "Imovelweb categoria",
    "Terrenos à venda em Vila Mariana, São Paulo",
    "https://www.imovelweb.com.br/terrenos-venda-vila-mariana-sao-paulo.html",
  ],
  [
    "segunda página",
    "Terrenos à venda em São Paulo - Página 2",
    "https://www.vivareal.com.br/venda/sp/sao-paulo/lote-terreno_residencial/?pagina=2",
  ],
  [
    "busca com filtro de preço",
    "Terrenos e Lotes à venda até R$ 5.000.000",
    "https://www.chavesnamao.com.br/terrenos-a-venda/sp-sao-paulo/preco-ate-5000000/",
  ],
];

describe("anúncio individual", () => {
  it.each(ANUNCIOS)("reconhece anúncio do %s", (_portal, titulo, url) => {
    expect(classificarPagina(titulo, url)).toBe("anuncio");
  });

  it("acha o número mesmo quando a URL também tem palavras de listagem", () => {
    // O anúncio do ZAP mora dentro de /imovel/venda-terreno-...; testar as
    // palavras antes do número descartaria anúncio bom.
    const url =
      "https://www.zapimoveis.com.br/imovel/venda-terreno-saude-sao-paulo-sp-820m2-id-2798765432/";
    expect(temIdDeAnuncio(url)).toBe(true);
    expect(classificarPagina("Terreno à venda, 820 m²", url)).toBe("anuncio");
  });

  it("não confunde metragem, ano ou número de página com identificador", () => {
    expect(temIdDeAnuncio("https://portal.com.br/venda/terreno-1000m2-vila-mariana")).toBe(false);
    expect(temIdDeAnuncio("https://portal.com.br/terrenos-venda-2024")).toBe(false);
    expect(temIdDeAnuncio("https://portal.com.br/terrenos/pagina-12")).toBe(false);
  });

  it("não aceita número que é filtro de preço", () => {
    // "preco-ate-5000000" tem sete dígitos e continua sendo tela de busca.
    expect(temIdDeAnuncio("https://portal.com.br/terrenos-a-venda/preco-ate-5000000/")).toBe(false);
  });
});

describe("página de listagem", () => {
  it.each(LISTAGENS)("reconhece listagem: %s", (_caso, titulo, url) => {
    expect(classificarPagina(titulo, url)).toBe("listagem");
  });

  it("pega o plural no título", () => {
    expect(tituloDeListagem("Terrenos à venda em Moema")).toBe(true);
    expect(tituloDeListagem("1.234 terrenos à venda em São Paulo")).toBe(true);
    expect(tituloDeListagem("Imóveis para comprar na Zona Sul")).toBe(true);
    expect(tituloDeListagem("Resultados da busca por terreno")).toBe(true);
  });

  it("deixa o singular passar", () => {
    // O título de anúncio é sempre no singular e com número concreto.
    expect(tituloDeListagem("Terreno à venda, 1.250 m² por R$ 4.200.000 - Saúde")).toBe(false);
    expect(tituloDeListagem("Terreno/Área à venda em Pinheiros")).toBe(false);
  });

  it("trata a home do portal como listagem", () => {
    expect(classificarPagina("Viva Real", "https://www.vivareal.com.br/")).toBe("listagem");
  });
});

describe("indefinido", () => {
  it("não descarta página de imobiliária que não segue o padrão dos portais", () => {
    // Sem número e sem cara de busca: pode ser um anúncio de site próprio.
    // Na dúvida o app mantém — descartar em silêncio é pior que mostrar demais.
    expect(
      classificarPagina(
        "Terreno na Vila Mariana com 1.000 m²",
        "https://imobiliariaexemplo.com.br/nossos-imoveis/terreno-vila-mariana",
      ),
    ).toBe("indefinido");
  });

  it("não quebra com URL inválida", () => {
    expect(classificarPagina("Terreno à venda", "não é uma url")).toBe("indefinido");
  });
});

describe("não descartar anúncio bom", () => {
  it('mantém anúncio individual cuja URL tem "venda" no caminho', () => {
    // O erro que isto trava: derrubar por causa da palavra "venda" um anúncio
    // que era exatamente o que a busca procurava.
    const casos = [
      "https://www.lopes.com.br/imovel/venda/sp/sao-paulo/terreno/vila-mariana-terreno",
      "https://imobiliaria.com.br/venda/terreno-vila-mariana",
      "https://portal.com.br/comprar/terreno-na-saude",
    ];
    for (const url of casos) {
      expect(classificarPagina("Terreno à venda, 800 m² na Vila Mariana", url)).not.toBe("listagem");
    }
  });

  it("ainda derruba a listagem quando o título entrega o plural", () => {
    expect(
      classificarPagina(
        "Terrenos à venda em Vila Mariana | Lopes",
        "https://www.lopes.com.br/venda/sp/sao-paulo/terreno",
      ),
    ).toBe("listagem");
  });
});

describe("Mercado Livre", () => {
  it("descarta a tela de busca, que vem no singular e sem número", () => {
    // Endereço real que passou pelo filtro e chegou na tela do usuário. O
    // caminho é a própria frase pesquisada: sem plural no título e sem
    // identificador, as outras duas regras não tinham como pegar.
    expect(
      classificarPagina(
        "Terreno Barato Zona Leste Itaquera | MercadoLivre",
        "https://lista.mercadolivre.com.br/terreno-barato-zona-leste-itaquera",
      ),
    ).toBe("listagem");
  });

  it("descarta a categoria de imóveis", () => {
    expect(
      classificarPagina(
        "Terrenos em Venda | MercadoLivre",
        "https://imoveis.mercadolivre.com.br/terrenos/venda/",
      ),
    ).toBe("listagem");
  });

  it("mantém o anúncio individual, que traz o código MLB", () => {
    expect(
      classificarPagina(
        "Terreno À Venda Cidade Líder / Zona Leste Sp 595m2",
        "https://produto.mercadolivre.com.br/MLB-3456789012-terreno-a-venda-cidade-lider-zona-leste-sp595m2-_JM",
      ),
    ).toBe("anuncio");
  });
});

describe("portal que numera todo anúncio", () => {
  it("sem número na URL, é a busca do portal", () => {
    const buscas = [
      "https://www.vivareal.com.br/venda/sp/sao-paulo/vila-mariana/",
      "https://www.olx.com.br/imoveis/terrenos/estado-sp",
      "https://www.zapimoveis.com.br/terrenos-a-venda/sp+sao-paulo/",
    ];
    for (const url of buscas) {
      expect(classificarPagina("Terreno à venda em São Paulo", url)).toBe("listagem");
    }
  });

  it("não vale para site que não está na lista", () => {
    // Imobiliária pequena não segue o padrão dos grandes: sem número, ainda
    // pode ser um anúncio. Na dúvida, mantém.
    expect(
      classificarPagina(
        "Terreno à venda, 800 m² na Vila Mariana",
        "https://imobiliariaexemplo.com.br/imovel/terreno-vila-mariana",
      ),
    ).toBe("indefinido");
  });
});

describe("subdomínio de busca", () => {
  it("reconhece lista, busca e search", () => {
    for (const host of ["lista.portal.com.br", "busca.portal.com.br", "search.portal.com"]) {
      expect(classificarPagina("Terreno à venda", `https://${host}/terreno-na-saude`)).toBe(
        "listagem",
      );
    }
  });
});
