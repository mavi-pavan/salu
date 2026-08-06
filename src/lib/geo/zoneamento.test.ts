import { describe, expect, it } from "vitest";

import { linkGeoSampa, normalizarZona } from "./zoneamento";

/**
 * A sigla vem do GeoSampa como a Prefeitura escreveu na camada — e isso muda
 * de camada para camada. Errar aqui é grave nos dois sentidos: deixar passar
 * um lote que não é ZEU, ou descartar um que é.
 */
describe("sigla da camada -> zona do app", () => {
  it("reconhece as zonas de eixo", () => {
    expect(normalizarZona("ZEU")).toBe("ZEU");
    expect(normalizarZona("ZEUa")).toBe("ZEUa");
    expect(normalizarZona("ZEUP")).toBe("ZEUP");
    expect(normalizarZona("ZEUPa")).toBe("ZEUPa");
    expect(normalizarZona("ZEM")).toBe("ZEM");
    expect(normalizarZona("ZEMP")).toBe("ZEMP");
  });

  it("ignora caixa, acento e pontuação", () => {
    expect(normalizarZona("zeu")).toBe("ZEU");
    expect(normalizarZona("ZEU (a)")).toBe("ZEUa");
    expect(normalizarZona("zeu-p")).toBe("ZEUP");
    expect(normalizarZona(" ZEU ")).toBe("ZEU");
  });

  it("agrupa as famílias numeradas", () => {
    expect(normalizarZona("ZEIS-1")).toBe("ZEIS");
    expect(normalizarZona("ZEIS 2")).toBe("ZEIS");
    expect(normalizarZona("ZM-3")).toBe("ZM");
    expect(normalizarZona("ZC-2")).toBe("ZC");
    expect(normalizarZona("ZR-1")).toBe("ZR");
  });

  it("lê o atributo que traz a sigla junto do nome por extenso", () => {
    // Há camada que guarda "ZEU - Zona Eixo de Estruturação..." num campo só.
    expect(normalizarZona("ZEU - Zona Eixo de Estruturação da Transformação Urbana")).toBe("ZEU");
    expect(normalizarZona("ZEUa, setor a")).toBe("ZEUa");
  });

  it("devolve OUTRA para zona que o app não modela — e nunca ZEU por engano", () => {
    expect(normalizarZona("ZEPAM")).toBe("OUTRA");
    expect(normalizarZona("ZPI-1")).toBe("OUTRA");
    expect(normalizarZona("")).toBe("OUTRA");
    expect(normalizarZona("sem informação")).toBe("OUTRA");
  });
});

describe("link de conferência", () => {
  it("leva ao GeoSampa com a coordenada quando ela existe", () => {
    expect(linkGeoSampa(-23.55, -46.63)).toContain("lat=-23.55");
    expect(linkGeoSampa(-23.55, -46.63)).toContain("lng=-46.63");
  });

  it("cai no portal sem parâmetros quando não há coordenada", () => {
    expect(linkGeoSampa(null, null)).not.toContain("lat=");
    expect(linkGeoSampa()).toMatch(/^https:\/\/geosampa\./);
  });
});
