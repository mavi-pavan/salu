/**
 * Consulta ao WFS do GeoSampa — a camada oficial de zoneamento da Prefeitura.
 *
 * É isto que transforma "bairro de eixo" em "este lote está em ZEU mesmo".
 * O serviço é público, aberto e não pede chave; o app pergunta uma coordenada
 * por vez e recebe o polígono de zona que a contém.
 *
 * Decisões que não são óbvias, e o motivo de cada uma:
 *
 * 1. A consulta usa `bbox` em vez de `CQL_FILTER=INTERSECTS(...)`. O filtro CQL
 *    exigiria saber o nome da coluna de geometria da camada (`the_geom`, `geom`,
 *    `shape`... varia); o `bbox` é aplicado pelo GeoServer na geometria padrão,
 *    sem precisar nomeá-la. Um nome errado ali devolveria erro ou, pior, zero
 *    feição — indistinguível de "não é ZEU".
 *
 * 2. Tudo acontece em EPSG:31983 (SIRGAS 2000 / UTM 23S), o CRS nativo das
 *    camadas. Ver src/lib/geo/projecao.ts para o porquê.
 *
 * 3. A caixa tem alguns metros de lado, não é um ponto. Feição de zoneamento é
 *    desenhada sobre a quadra; a coordenada vem do Nominatim com incerteza de
 *    dezenas de metros. Pedir a caixa e depois testar ponto-em-polígono
 *    localmente dá a resposta exata quando o ponto está dentro e ainda permite
 *    tratar com honestidade o caso de divisa.
 *
 * 4. Erro nunca vira "não é ZEU". Falha de rede, camada renomeada ou resposta
 *    inesperada devolvem `indisponivel` com o motivo, que sobe até a tela da
 *    busca. Zona não confirmada é sempre "a verificar", nunca "descartado".
 */

import {
  calcularBbox,
  dentroDaBbox,
  extrairPoligonos,
  pontoEmAlgum,
  type GeometriaGeoJSON,
  type Poligono,
} from "./poligono";
import { dentroDeSaoPaulo, paraUtm23S } from "./projecao";

/**
 * Camada padrão: "Perímetro de Zonas – Lei 18.177/24 (mapa 1)", que é a LPUOS
 * vigente — exatamente a lei que o app calcula. Se a Prefeitura republicar a
 * camada com outro nome, `GEOSAMPA_WFS_CAMADA` troca sem alterar código; o
 * nome atual sai do GetCapabilities do serviço.
 */
const CAMADA_PADRAO = "geoportal:perimetro_zona_lei_18177_24";
const ENDPOINT_PADRAO = "https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs";

/** Meia-aresta da caixa consultada, em metros. */
const RAIO_M = 3;
const TIMEOUT_MS = 15_000;
/** Numa caixa de 6 m só cabem poucas quadras; o teto é contra resposta anômala. */
const MAX_FEICOES = 12;

export function camadaConfigurada(): string {
  return (process.env.GEOSAMPA_WFS_CAMADA ?? CAMADA_PADRAO).trim() || CAMADA_PADRAO;
}

export function endpointConfigurado(): string {
  return (process.env.GEOSAMPA_WFS_URL ?? ENDPOINT_PADRAO).trim() || ENDPOINT_PADRAO;
}

/** O WFS é o padrão; `GEOSAMPA_WFS="off"` desliga sem mexer no resto. */
export function geoSampaAtivo(): boolean {
  const valor = (process.env.GEOSAMPA_WFS ?? "").trim().toLowerCase();
  return valor !== "off" && valor !== "0" && valor !== "false";
}

/** Retângulo em metros, no CRS nativo da camada. */
export interface CaixaUtm {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function urlDaCaixa(caixa: CaixaUtm, quantas: number): string {
  const url = new URL(endpointConfigurado());
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", camadaConfigurada());
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("srsName", "EPSG:31983");
  url.searchParams.set("count", String(quantas));
  url.searchParams.set(
    "bbox",
    [
      caixa.minX.toFixed(2),
      caixa.minY.toFixed(2),
      caixa.maxX.toFixed(2),
      caixa.maxY.toFixed(2),
      "EPSG:31983",
    ].join(","),
  );
  return url.toString();
}

export function urlConsulta(x: number, y: number, raio = RAIO_M): string {
  return urlDaCaixa(
    { minX: x - raio, minY: y - raio, maxX: x + raio, maxY: y + raio },
    MAX_FEICOES,
  );
}

/** A mesma consulta, para a área visível do mapa em vez de um ponto. */
export function urlDaArea(caixa: CaixaUtm, quantas: number): string {
  return urlDaCaixa(caixa, quantas);
}

// ---------------------------------------------------------------------------
// Leitura da resposta
// ---------------------------------------------------------------------------

/**
 * Nomes de coluna já vistos em camadas de zoneamento da Prefeitura. A ordem
 * importa: o primeiro que existir e tiver valor ganha.
 */
const CAMPOS_PROVAVEIS = [
  "zl_zona",
  "zona",
  "sigla_zona",
  "zona_sigla",
  "sigla",
  "tx_zona",
  "zn_sigla",
  "nm_zona",
  "tp_zona",
  "cd_zona",
];

/**
 * "ZEU", "ZEUa", "ZEIS-1", "ZEPAM"... — o suficiente para reconhecer uma sigla
 * de zona sem depender do nome da coluna, que muda de camada para camada.
 */
const PARECE_SIGLA = /^Z[A-Za-z]{1,6}(\s*[-–]\s*\d{1,2}[a-z]?)?$/;

export function pareceSiglaDeZona(valor: string): boolean {
  return PARECE_SIGLA.test(valor.trim());
}

/**
 * Descobre a sigla da zona nas propriedades da feição.
 *
 * Tenta a coluna configurada, depois os nomes conhecidos e, por último,
 * varre todas as propriedades atrás de um valor com cara de sigla. A varredura
 * existe porque o nome da coluna é a única coisa do serviço que não dá para
 * verificar daqui — e errar nela deixaria a camada carregada e inútil.
 */
export function siglaDaFeature(propriedades: Record<string, unknown> | null | undefined): string | null {
  if (!propriedades) return null;

  const texto = (chave: string): string | null => {
    const valor = propriedades[chave];
    if (typeof valor !== "string") return null;
    const limpo = valor.trim();
    return limpo.length > 0 && limpo.length <= 40 ? limpo : null;
  };

  const configurado = process.env.ZONEAMENTO_CAMPO?.trim();
  if (configurado) {
    const valor = texto(configurado);
    if (valor) return valor;
  }

  for (const campo of CAMPOS_PROVAVEIS) {
    const valor = texto(campo);
    if (valor) return valor;
  }

  for (const chave of Object.keys(propriedades)) {
    const valor = texto(chave);
    if (valor && pareceSiglaDeZona(valor)) return valor;
  }

  return null;
}

export interface FeatureBruta {
  properties?: Record<string, unknown> | null;
  geometry?: GeometriaGeoJSON | null;
}

export type ResultadoGeoSampa =
  | { estado: "encontrada"; bruto: string }
  | { estado: "fora" }
  | { estado: "indisponivel"; motivo: string };

/**
 * Escolhe, entre as feições da caixa, a que realmente contém o ponto.
 *
 * Quando nenhuma contém mas só veio uma, aceita: o ponto está a menos de
 * `RAIO_M` metros dela e a coordenada do anúncio não tem essa precisão.
 * Quando nenhuma contém e vieram várias, o ponto está sobre uma divisa de
 * zonas — aí "não sei" é a resposta correta.
 */
export function zonaDaColecao(dados: unknown, x: number, y: number): ResultadoGeoSampa {
  const colecao = dados as { features?: FeatureBruta[] } | null;
  const feicoes = colecao?.features;
  if (!Array.isArray(feicoes)) {
    return { estado: "indisponivel", motivo: "resposta do GeoSampa sem lista de feições" };
  }

  const candidatas: Array<{ bruto: string; poligonos: Poligono[] }> = [];

  for (const feicao of feicoes) {
    const bruto = siglaDaFeature(feicao.properties);
    if (!bruto) continue;
    const poligonos = extrairPoligonos(feicao.geometry);
    if (!poligonos.length) continue;
    candidatas.push({ bruto, poligonos });
  }

  if (!candidatas.length) return { estado: "fora" };

  for (const candidata of candidatas) {
    const bbox = calcularBbox(candidata.poligonos);
    if (!dentroDaBbox(x, y, bbox)) continue;
    if (pontoEmAlgum(x, y, candidata.poligonos)) {
      return { estado: "encontrada", bruto: candidata.bruto };
    }
  }

  const unica = candidatas.length === 1 ? candidatas[0] : null;
  return unica ? { estado: "encontrada", bruto: unica.bruto } : { estado: "fora" };
}

// ---------------------------------------------------------------------------
// Rede
// ---------------------------------------------------------------------------

/**
 * Cache em memória por coordenada arredondada ao metro.
 *
 * Uma busca geocodifica até 25 endereços; repetir a mesma busca ou dois
 * anúncios do mesmo prédio não devem virar requisição nova. Só entra resposta
 * conclusiva — falha é sempre retentada.
 *
 * A camada e o endereço do serviço entram na chave: trocar a camada tem que
 * mudar a resposta, e uma entrada guardada pela camada antiga responderia pela
 * nova sem ninguém perceber.
 */
const cache = new Map<string, ResultadoGeoSampa>();
const CACHE_MAX = 5_000;

function guardar(chave: string, valor: ResultadoGeoSampa): ResultadoGeoSampa {
  if (cache.size >= CACHE_MAX) {
    const maisAntiga = cache.keys().next().value;
    if (maisAntiga !== undefined) cache.delete(maisAntiga);
  }
  cache.set(chave, valor);
  return valor;
}

/** Erro de rede vira motivo legível — inclusive o corpo, que costuma nomear a causa. */
async function motivoDaResposta(resposta: Response): Promise<string> {
  let detalhe = "";
  try {
    const texto = (await resposta.text()).trim();
    if (texto) detalhe = ` — ${texto.replace(/\s+/g, " ").slice(0, 300)}`;
  } catch {
    // corpo ilegível: o status já basta
  }
  return `GeoSampa respondeu ${resposta.status}${detalhe}`;
}

export type Recebido =
  | { ok: true; dados: unknown }
  | { ok: false; motivo: string };

/**
 * Uma requisição ao WFS, com todos os jeitos conhecidos de dar errado tratados
 * como erro explícito.
 *
 * O mais traiçoeiro está no fim: o GeoServer responde erro em XML com status
 * 200 quando a camada ou um parâmetro não existem. Sem o ramo do JSON inválido,
 * isso viraria "nenhuma feição" — e o app afirmaria com todas as letras que o
 * lote não está em zona nenhuma.
 */
async function pedirAoGeoSampa(url: string, timeoutMs = TIMEOUT_MS): Promise<Recebido> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (erro) {
    const causa = erro instanceof Error ? erro.message : String(erro);
    return { ok: false, motivo: `não foi possível falar com o GeoSampa: ${causa}` };
  }

  if (!resposta.ok) return { ok: false, motivo: await motivoDaResposta(resposta) };

  const texto = await resposta.text();
  try {
    return { ok: true, dados: JSON.parse(texto) };
  } catch {
    return {
      ok: false,
      motivo: `resposta do GeoSampa não é JSON — ${texto.replace(/\s+/g, " ").slice(0, 300)}`,
    };
  }
}

export async function zonaNoGeoSampa(
  latitude: number,
  longitude: number,
): Promise<ResultadoGeoSampa> {
  if (!geoSampaAtivo()) {
    return { estado: "indisponivel", motivo: "consulta ao GeoSampa desativada (GEOSAMPA_WFS=off)" };
  }
  if (!dentroDeSaoPaulo(latitude, longitude)) return { estado: "fora" };

  const { x, y } = paraUtm23S(latitude, longitude);
  const chave = `${endpointConfigurado()}|${camadaConfigurada()}|${x.toFixed(0)}:${y.toFixed(0)}`;
  const emCache = cache.get(chave);
  if (emCache) return emCache;

  const recebido = await pedirAoGeoSampa(urlConsulta(x, y));
  if (!recebido.ok) return { estado: "indisponivel", motivo: recebido.motivo };

  const resultado = zonaDaColecao(recebido.dados, x, y);
  if (resultado.estado === "indisponivel") return resultado;
  return guardar(chave, resultado);
}

export type FeicoesDaArea =
  | { estado: "ok"; feicoes: FeatureBruta[] }
  | { estado: "indisponivel"; motivo: string };

/**
 * As feições de zoneamento que tocam um retângulo — o que o mapa precisa para
 * desenhar a área visível.
 *
 * Sem cache: ao contrário da consulta por ponto, cada caixa é diferente da
 * anterior (o mapa se move continuamente), então guardar só ocuparia memória.
 * O timeout é mais curto porque aqui alguém está olhando a tela esperando.
 */
export async function feicoesNaArea(caixa: CaixaUtm, quantas: number): Promise<FeicoesDaArea> {
  if (!geoSampaAtivo()) {
    return { estado: "indisponivel", motivo: "consulta ao GeoSampa desativada (GEOSAMPA_WFS=off)" };
  }

  const recebido = await pedirAoGeoSampa(urlDaArea(caixa, quantas), 12_000);
  if (!recebido.ok) return { estado: "indisponivel", motivo: recebido.motivo };

  const colecao = recebido.dados as { features?: FeatureBruta[] } | null;
  if (!Array.isArray(colecao?.features)) {
    return { estado: "indisponivel", motivo: "resposta do GeoSampa sem lista de feições" };
  }
  return { estado: "ok", feicoes: colecao.features };
}
