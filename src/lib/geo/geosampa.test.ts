import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  camadaConfigurada,
  geoSampaAtivo,
  pareceSiglaDeZona,
  siglaDaFeature,
  urlConsulta,
  zonaDaColecao,
} from "./geosampa";
import { paraUtm23S } from "./projecao";

/** Estas variáveis mudam de teste para teste; o valor de fora é restaurado. */
const CHAVES = [
  "GEOSAMPA_WFS",
  "GEOSAMPA_WFS_CAMADA",
  "GEOSAMPA_WFS_URL",
  "ZONEAMENTO_CAMPO",
] as const;

const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const chave of CHAVES) {
    original[chave] = process.env[chave];
    delete process.env[chave];
  }
});

afterEach(() => {
  for (const chave of CHAVES) {
    const valor = original[chave];
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
});

/** Quadrado de 20 m em torno de um ponto, em coordenadas UTM. */
function quadradoEmTorno(x: number, y: number, lado = 20) {
  const m = lado / 2;
  return {
    type: "Polygon",
    coordinates: [
      [
        [x - m, y - m],
        [x + m, y - m],
        [x + m, y + m],
        [x - m, y + m],
        [x - m, y - m],
      ],
    ],
  };
}

describe("URL da consulta", () => {
  const { x, y } = paraUtm23S(-23.5505, -46.6333);
  const consulta = () => new URL(urlConsulta(x, y));

  it("pede GetFeature em JSON da camada de zoneamento vigente", () => {
    const url = consulta();
    expect(url.searchParams.get("service")).toBe("WFS");
    expect(url.searchParams.get("request")).toBe("GetFeature");
    expect(url.searchParams.get("outputFormat")).toBe("application/json");
    expect(url.searchParams.get("typeNames")).toBe("geoportal:perimetro_zona_lei_18177_24");
  });

  it("usa typeNames (WFS 2.0), não typeName", () => {
    // O serviço anuncia 2.0.0; mandar o parâmetro da 1.1 devolve erro.
    const url = consulta();
    expect(url.searchParams.get("version")).toBe("2.0.0");
    expect(url.searchParams.get("typeName")).toBeNull();
  });

  it("declara o CRS nativo na caixa e na saída", () => {
    // Esta é a linha que impede o erro silencioso de ordem de eixos: sem
    // EPSG:31983 explícito, o filtro casaria com nada e o app concluiria que
    // nenhum lote é ZEU.
    const url = consulta();
    expect(url.searchParams.get("srsName")).toBe("EPSG:31983");
    expect(url.searchParams.get("bbox")).toMatch(/,EPSG:31983$/);
  });

  it("monta uma caixa pequena e centrada no ponto", () => {
    const [minX, minY, maxX, maxY] = consulta()
      .searchParams.get("bbox")!
      .split(",")
      .slice(0, 4)
      .map(Number) as [number, number, number, number];

    expect((minX + maxX) / 2).toBeCloseTo(x, 1);
    expect((minY + maxY) / 2).toBeCloseTo(y, 1);
    expect(maxX - minX).toBeLessThanOrEqual(10);
    expect(maxY - minY).toBeGreaterThan(0);
  });

  it("aceita camada e endpoint trocados por variável de ambiente", () => {
    process.env.GEOSAMPA_WFS_CAMADA = "geoportal:zoneamento_2016_map1";
    process.env.GEOSAMPA_WFS_URL = "https://exemplo.invalid/geoserver/wfs";

    const outra = new URL(urlConsulta(x, y));
    expect(outra.host).toBe("exemplo.invalid");
    expect(outra.searchParams.get("typeNames")).toBe("geoportal:zoneamento_2016_map1");
  });

  it("ignora variável vazia e volta ao padrão", () => {
    process.env.GEOSAMPA_WFS_CAMADA = "   ";
    expect(camadaConfigurada()).toBe("geoportal:perimetro_zona_lei_18177_24");
  });
});

describe("chave de desligamento", () => {
  it("vem ligado por padrão", () => {
    delete process.env.GEOSAMPA_WFS;
    expect(geoSampaAtivo()).toBe(true);
  });

  it("desliga com off, 0 ou false", () => {
    for (const valor of ["off", "OFF", "0", "false"]) {
      process.env.GEOSAMPA_WFS = valor;
      expect(geoSampaAtivo()).toBe(false);
    }
  });
});

describe("sigla da feição", () => {
  it("reconhece siglas de zona", () => {
    expect(pareceSiglaDeZona("ZEU")).toBe(true);
    expect(pareceSiglaDeZona("ZEUa")).toBe(true);
    expect(pareceSiglaDeZona("ZEIS-1")).toBe(true);
    expect(pareceSiglaDeZona("ZEPAM")).toBe(true);
    expect(pareceSiglaDeZona("Rua Vergueiro")).toBe(false);
    expect(pareceSiglaDeZona("2024-01-01")).toBe(false);
  });

  it("prefere a coluna configurada", () => {
    process.env.ZONEAMENTO_CAMPO = "tx_minha_zona";
    expect(siglaDaFeature({ tx_minha_zona: "ZEUa", zona: "ZM" })).toBe("ZEUa");
  });

  it("usa os nomes conhecidos quando não há coluna configurada", () => {
    delete process.env.ZONEAMENTO_CAMPO;
    expect(siglaDaFeature({ zl_zona: "ZEU", outra: "coisa" })).toBe("ZEU");
    expect(siglaDaFeature({ sigla_zona: "ZEM" })).toBe("ZEM");
  });

  it("varre as propriedades quando o nome da coluna é desconhecido", () => {
    // O nome da coluna é a única coisa do serviço impossível de conferir sem
    // rede — então a varredura é o que impede a camada de virar inútil.
    delete process.env.ZONEAMENTO_CAMPO;
    expect(
      siglaDaFeature({ gid: 12, nm_distrito: "Saúde", cd_qualquer_coisa: "ZEUP", area: 4210.5 }),
    ).toBe("ZEUP");
  });

  it("devolve null quando não há nada com cara de zona", () => {
    delete process.env.ZONEAMENTO_CAMPO;
    expect(siglaDaFeature({ gid: 1, nm_distrito: "Saúde" })).toBeNull();
    expect(siglaDaFeature(null)).toBeNull();
    expect(siglaDaFeature({})).toBeNull();
  });
});

describe("leitura da coleção devolvida", () => {
  const x = 333_000;
  const y = 7_394_000;

  it("escolhe a feição que contém o ponto, não a primeira da lista", () => {
    const dados = {
      features: [
        { properties: { zl_zona: "ZM" }, geometry: quadradoEmTorno(x + 100, y) },
        { properties: { zl_zona: "ZEU" }, geometry: quadradoEmTorno(x, y) },
      ],
    };
    expect(zonaDaColecao(dados, x, y)).toEqual({ estado: "encontrada", bruto: "ZEU" });
  });

  it("aceita a única vizinha quando o ponto está a poucos metros dela", () => {
    // A coordenada vem do Nominatim com dezenas de metros de incerteza; exigir
    // precisão de centímetro devolveria "a verificar" para tudo.
    const dados = {
      features: [{ properties: { zl_zona: "ZEU" }, geometry: quadradoEmTorno(x + 12, y) }],
    };
    expect(zonaDaColecao(dados, x, y)).toEqual({ estado: "encontrada", bruto: "ZEU" });
  });

  it("não escolhe no chute quando há mais de uma zona por perto", () => {
    const dados = {
      features: [
        { properties: { zl_zona: "ZEU" }, geometry: quadradoEmTorno(x + 40, y) },
        { properties: { zl_zona: "ZM" }, geometry: quadradoEmTorno(x - 40, y) },
      ],
    };
    expect(zonaDaColecao(dados, x, y)).toEqual({ estado: "fora" });
  });

  it("coleção vazia é 'fora', não erro", () => {
    expect(zonaDaColecao({ features: [] }, x, y)).toEqual({ estado: "fora" });
  });

  it("resposta sem lista de feições é indisponível, nunca 'fora'", () => {
    // Este é o ramo que evita o pior erro possível: tratar falha do serviço
    // como prova de que o lote não é ZEU.
    expect(zonaDaColecao({ erro: "camada inexistente" }, x, y)).toMatchObject({
      estado: "indisponivel",
    });
    expect(zonaDaColecao(null, x, y)).toMatchObject({ estado: "indisponivel" });
  });

  it("ignora feição sem geometria ou sem sigla", () => {
    const dados = {
      features: [
        { properties: { zl_zona: "ZEU" }, geometry: null },
        { properties: { gid: 3 }, geometry: quadradoEmTorno(x, y) },
      ],
    };
    expect(zonaDaColecao(dados, x, y)).toEqual({ estado: "fora" });
  });
});
