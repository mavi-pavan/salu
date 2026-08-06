/**
 * Resolve a zona de uma coordenada contra a camada oficial de zoneamento.
 *
 * Há duas fontes possíveis, nesta ordem:
 *
 *   1. GeoJSON local, quando `ZONEAMENTO_GEOJSON` estiver apontado para um
 *      arquivo ou URL. É o modo offline: mais rápido, sem depender de
 *      serviço externo, mas congela no dia em que o arquivo foi gerado.
 *   2. WFS do GeoSampa (padrão, nada a configurar). Consulta a camada da
 *      Prefeitura a cada coordenada, sempre na versão vigente.
 *
 * O GeoJSON tem precedência justamente porque é explícito: se alguém se deu ao
 * trabalho de apontar um arquivo, é esse que deve valer.
 *
 * Nada aqui devolve zona errada por omissão: quando a fonte falha, o resultado
 * é `indisponivel` com o motivo, e a busca marca o anúncio como "a verificar"
 * em vez de afirmar que não é ZEU.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { ZONAS, type ZonaChave } from "@/lib/zeu";
import { geoSampaAtivo, camadaConfigurada, zonaNoGeoSampa } from "./geosampa";
import {
  calcularBbox,
  dentroDaBbox,
  extrairPoligonos,
  pontoEmAlgum,
  type Bbox,
  type Poligono,
} from "./poligono";

interface FeatureZona {
  zona: ZonaChave;
  bruto: string;
  poligonos: Poligono[];
  bbox: Bbox;
}

interface GeoJSONFeature {
  type: string;
  properties?: Record<string, unknown> | null;
  geometry?: { type: string; coordinates: unknown } | null;
}

const CAMPOS_CANDIDATOS = ["zl_zona", "zona", "ZONA", "sigla", "SIGLA", "tx_zona", "zn_sigla"];

let cache: FeatureZona[] | null = null;
let carregando: Promise<FeatureZona[]> | null = null;

// ---------------------------------------------------------------------------
// Fonte em uso
// ---------------------------------------------------------------------------

export type FonteZona = "GEOSAMPA" | "GEOJSON";

export interface DescricaoFonte {
  ativo: boolean;
  chave: "geojson" | "geosampa" | "nenhuma";
  /** Texto curto para etiqueta e ajuda de formulário. */
  rotulo: string;
  /** Camada consultada no GeoSampa, quando é essa a fonte. */
  camada: string | null;
  /** Arquivo/URL do GeoJSON local, quando é essa a fonte. */
  arquivo: string | null;
}

export function fonteZoneamento(): DescricaoFonte {
  if (process.env.ZONEAMENTO_GEOJSON) {
    return {
      ativo: true,
      chave: "geojson",
      rotulo: "camada local (GeoJSON)",
      camada: null,
      arquivo: process.env.ZONEAMENTO_GEOJSON,
    };
  }
  if (geoSampaAtivo()) {
    return {
      ativo: true,
      chave: "geosampa",
      rotulo: "GeoSampa (camada oficial, ao vivo)",
      camada: camadaConfigurada(),
      arquivo: null,
    };
  }
  return {
    ativo: false,
    chave: "nenhuma",
    rotulo: "nenhuma",
    camada: null,
    arquivo: null,
  };
}

/** Mantido para quem só precisa do sim/não. */
export function zoneamentoConfigurado(): boolean {
  return fonteZoneamento().ativo;
}

// ---------------------------------------------------------------------------
// Sigla -> enum
// ---------------------------------------------------------------------------

const MAPA_ZONAS: Record<string, ZonaChave> = {
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

function chaveDe(texto: string): ZonaChave | null {
  const limpo = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();

  if (!limpo) return null;
  const direto = MAPA_ZONAS[limpo];
  if (direto) return direto;
  if (limpo.startsWith("ZEIS")) return "ZEIS";
  if (limpo.startsWith("ZC")) return "ZC";
  if (limpo.startsWith("ZM")) return "ZM";
  if (limpo.startsWith("ZR")) return "ZR";
  return (ZONAS as readonly string[]).includes(limpo) ? (limpo as ZonaChave) : null;
}

/**
 * "ZEU (a)", "zeu-p", "ZEIS-2" -> chave do enum.
 *
 * A segunda passada existe porque nem toda camada guarda só a sigla: há
 * atributo que traz "ZEU - Zona Eixo de Estruturação da Transformação Urbana"
 * inteiro, e aí só a primeira palavra interessa.
 */
export function normalizarZona(bruto: string): ZonaChave {
  const primeiraPalavra = bruto.trim().split(/[\s,;/|]+/)[0] ?? "";
  return chaveDe(bruto) ?? chaveDe(primeiraPalavra) ?? "OUTRA";
}

// ---------------------------------------------------------------------------
// GeoJSON local
// ---------------------------------------------------------------------------

async function lerFonte(fonte: string): Promise<string> {
  if (/^https?:\/\//i.test(fonte)) {
    const resposta = await fetch(fonte, { signal: AbortSignal.timeout(30_000) });
    if (!resposta.ok) throw new Error(`Zoneamento: HTTP ${resposta.status}`);
    return resposta.text();
  }
  return readFile(path.resolve(process.cwd(), fonte), "utf8");
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
      campoConfigurado ?? CAMPOS_CANDIDATOS.find((c) => typeof props[c] === "string" && props[c]);
    if (!campo) continue;

    const bruto = String(props[campo] ?? "").trim();
    if (!bruto) continue;

    const poligonos = extrairPoligonos(feature.geometry);
    if (!poligonos.length) continue;

    saida.push({
      zona: normalizarZona(bruto),
      bruto,
      poligonos,
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

// ---------------------------------------------------------------------------
// Resolução
// ---------------------------------------------------------------------------

export type ResultadoZona =
  | { estado: "encontrada"; zona: ZonaChave; bruto: string; fonte: FonteZona }
  /** Consultado com sucesso e o ponto não caiu em nenhum polígono da camada. */
  | { estado: "fora"; fonte: FonteZona }
  /** Não deu para consultar. Nunca deve ser lido como "não é ZEU". */
  | { estado: "indisponivel"; motivo: string };

export async function resolverZona(latitude: number, longitude: number): Promise<ResultadoZona> {
  if (process.env.ZONEAMENTO_GEOJSON) {
    const features = await camada();
    if (!features.length) {
      return {
        estado: "indisponivel",
        motivo: `a camada de ZONEAMENTO_GEOJSON (${process.env.ZONEAMENTO_GEOJSON}) não trouxe nenhum polígono utilizável`,
      };
    }

    for (const feature of features) {
      if (!dentroDaBbox(longitude, latitude, feature.bbox)) continue;
      if (pontoEmAlgum(longitude, latitude, feature.poligonos)) {
        return { estado: "encontrada", zona: feature.zona, bruto: feature.bruto, fonte: "GEOJSON" };
      }
    }
    return { estado: "fora", fonte: "GEOJSON" };
  }

  const resposta = await zonaNoGeoSampa(latitude, longitude);
  if (resposta.estado === "encontrada") {
    return {
      estado: "encontrada",
      zona: normalizarZona(resposta.bruto),
      bruto: resposta.bruto,
      fonte: "GEOSAMPA",
    };
  }
  if (resposta.estado === "fora") return { estado: "fora", fonte: "GEOSAMPA" };
  return resposta;
}

/** Link direto do GeoSampa, para conferência manual. */
export function linkGeoSampa(latitude?: number | null, longitude?: number | null): string {
  const base = "https://geosampa.prefeitura.sp.gov.br/PaginasPublicas/_SBC.aspx";
  if (latitude == null || longitude == null) return base;
  return `${base}?lat=${latitude}&lng=${longitude}`;
}
