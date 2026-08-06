/**
 * Resolve a zona de uma coordenada contra a camada oficial de zoneamento.
 *
 * O app funciona sem esta camada — nesse caso a zona fica "a verificar" e o
 * link do GeoSampa aparece na tela. Mas com ela, a busca passa a filtrar de
 * verdade por ZEU, em vez de presumir pela região.
 *
 * Como habilitar:
 *   1. Baixe a camada de zoneamento (LPUOS) no GeoSampa e converta para
 *      GeoJSON em EPSG:4326, filtrando só as zonas de eixo — o arquivo
 *      completo da cidade é grande demais para carregar a cada requisição.
 *   2. Salve em data/zoneamento.geojson (ou publique numa URL).
 *   3. Aponte ZONEAMENTO_GEOJSON para o caminho ou a URL.
 *
 * Em produção com muitos polígonos, a alternativa correta é PostGIS com
 * ST_Contains — ver README.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { ZONAS, type ZonaChave } from "@/lib/zeu";

type Posicao = [number, number];
type Anel = Posicao[];

interface FeatureZona {
  zona: ZonaChave;
  bruto: string;
  aneis: Anel[][];
  bbox: [number, number, number, number];
}

interface GeoJSONFeature {
  type: string;
  properties?: Record<string, unknown> | null;
  geometry?: {
    type: string;
    coordinates: unknown;
  } | null;
}

const CAMPOS_CANDIDATOS = ["zl_zona", "zona", "ZONA", "sigla", "SIGLA", "tx_zona", "zn_sigla"];

let cache: FeatureZona[] | null = null;
let carregando: Promise<FeatureZona[]> | null = null;

export function zoneamentoConfigurado(): boolean {
  return Boolean(process.env.ZONEAMENTO_GEOJSON);
}

/** "ZEU (a)", "zeu-p", "ZEIS-2" -> chave do enum. */
export function normalizarZona(bruto: string): ZonaChave {
  const limpo = bruto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();

  const mapa: Record<string, ZonaChave> = {
    ZEU: "ZEU",
    ZEUA: "ZEUa",
    ZEUP: "ZEUP",
    ZEUPA: "ZEUPa",
    ZEM: "ZEM",
    ZEMP: "ZEMP",
    ZC: "ZC",
    ZM: "ZM",
    ZR: "ZR",
  };
  const direto = mapa[limpo];
  if (direto) return direto;
  if (limpo.startsWith("ZEIS")) return "ZEIS";
  if (limpo.startsWith("ZC")) return "ZC";
  if (limpo.startsWith("ZM")) return "ZM";
  if (limpo.startsWith("ZR")) return "ZR";
  return (ZONAS as readonly string[]).includes(limpo) ? (limpo as ZonaChave) : "OUTRA";
}

async function lerFonte(fonte: string): Promise<string> {
  if (/^https?:\/\//i.test(fonte)) {
    const resposta = await fetch(fonte, { signal: AbortSignal.timeout(30_000) });
    if (!resposta.ok) throw new Error(`Zoneamento: HTTP ${resposta.status}`);
    return resposta.text();
  }
  return readFile(path.resolve(process.cwd(), fonte), "utf8");
}

function extrairAneis(geometry: NonNullable<GeoJSONFeature["geometry"]>): Anel[][] {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates as Anel[]];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates as Anel[][];
  }
  return [];
}

function calcularBbox(poligonos: Anel[][]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const poligono of poligonos) {
    for (const anel of poligono) {
      for (const [x, y] of anel) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return [minX, minY, maxX, maxY];
}

async function carregar(): Promise<FeatureZona[]> {
  const fonte = process.env.ZONEAMENTO_GEOJSON;
  if (!fonte) return [];

  const texto = await lerFonte(fonte);
  const dados = JSON.parse(texto) as { features?: GeoJSONFeature[] };
  const campoConfigurado = process.env.ZONEAMENTO_CAMPO;

  const saida: FeatureZona[] = [];
  for (const feature of dados.features ?? []) {
    if (!feature.geometry) continue;
    const props = feature.properties ?? {};

    const campo =
      campoConfigurado ??
      CAMPOS_CANDIDATOS.find((c) => typeof props[c] === "string" && props[c]);
    if (!campo) continue;

    const bruto = String(props[campo] ?? "").trim();
    if (!bruto) continue;

    const poligonos = extrairAneis(feature.geometry);
    if (!poligonos.length) continue;

    saida.push({
      zona: normalizarZona(bruto),
      bruto,
      aneis: poligonos,
      bbox: calcularBbox(poligonos),
    });
  }

  return saida;
}

async function camada(): Promise<FeatureZona[]> {
  if (cache) return cache;
  if (!carregando) {
    carregando = carregar()
      .then((dados) => {
        cache = dados;
        return dados;
      })
      .catch((erro) => {
        console.error("Não foi possível carregar o zoneamento:", erro);
        cache = [];
        return cache;
      })
      .finally(() => {
        carregando = null;
      });
  }
  return carregando;
}

/** Ray casting padrão: conta cruzamentos à direita do ponto. */
function pontoNoAnel(x: number, y: number, anel: Anel): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const atual = anel[i];
    const anterior = anel[j];
    if (!atual || !anterior) continue;

    const [xi, yi] = atual;
    const [xj, yj] = anterior;
    const cruza = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Primeiro anel é o contorno; os demais são buracos. */
function pontoNoPoligono(x: number, y: number, poligono: Anel[]): boolean {
  const [contorno, ...buracos] = poligono;
  if (!contorno || !pontoNoAnel(x, y, contorno)) return false;
  return !buracos.some((buraco) => pontoNoAnel(x, y, buraco));
}

export interface ZonaResolvida {
  zona: ZonaChave;
  bruto: string;
}

export async function resolverZona(
  latitude: number,
  longitude: number,
): Promise<ZonaResolvida | null> {
  const features = await camada();
  if (!features.length) return null;

  for (const feature of features) {
    const [minX, minY, maxX, maxY] = feature.bbox;
    if (longitude < minX || longitude > maxX || latitude < minY || latitude > maxY) continue;

    for (const poligono of feature.aneis) {
      if (pontoNoPoligono(longitude, latitude, poligono)) {
        return { zona: feature.zona, bruto: feature.bruto };
      }
    }
  }
  return null;
}

/** Link direto do GeoSampa, para conferência manual quando não há camada. */
export function linkGeoSampa(latitude?: number | null, longitude?: number | null): string {
  const base = "https://geosampa.prefeitura.sp.gov.br/PaginasPublicas/_SBC.aspx";
  if (latitude == null || longitude == null) return base;
  return `${base}?lat=${latitude}&lng=${longitude}`;
}
