import "server-only";

import { prisma } from "@/lib/prisma";
import { buscarNaWeb, ehDemo, provedorConfigurado, type ItemWeb } from "@/lib/busca/provedores";
import { dominio, extrairTudo, normalizarZonaTexto } from "@/lib/busca/extrair";
import { normalizar } from "@/lib/busca/regioes";
import {
  MAX_CONSULTAS,
  montarConsultas,
  portais,
  regioesDescartadas,
} from "@/lib/busca/consultas";
import { consultaDeEndereco, geocodificar } from "@/lib/geo/geocodificar";
import { resolverZona, zoneamentoConfigurado } from "@/lib/geo/zoneamento";
import { coeficientes, type ZonaChave } from "@/lib/zeu";

export interface ParametrosBusca {
  zonas: ZonaChave[];
  areaMin: number | null;
  areaMax: number | null;
  precoMax: number | null;
  regioes: string[];
  termosExtras: string | null;
  /** Descarta anúncio sem área detectada. */
  exigirArea: boolean;
  /** Descarta anúncio cuja zona não pôde ser confirmada. */
  exigirZonaConfirmada: boolean;
  maxConsultas: number;
}

const RESULTADOS_POR_CONSULTA = 20;
const LIMITE_GEOCODE = Number(process.env.BUSCA_MAX_GEOCODE ?? 25);
const PALAVRAS_RELEVANTES = ["terreno", "lote", "gleba", "área para", "area para"];

/** Ignora query string e barra final: o mesmo anúncio chega com utm diferente. */
function chaveDeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function pareceAnuncioDeTerreno(item: ItemWeb): boolean {
  const texto = normalizar(`${item.titulo} ${item.trecho ?? ""}`);
  return PALAVRAS_RELEVANTES.some((p) => texto.includes(normalizar(p)));
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

export interface ResumoBusca {
  buscaId: string;
  totalBruto: number;
  totalAceito: number;
  erro: string | null;
  demo: boolean;
}

export async function executarBusca(
  params: ParametrosBusca,
  usuarioId: string,
): Promise<ResumoBusca> {
  const consultas = montarConsultas(params);
  const brutos: ItemWeb[] = [];
  let erro: string | null = null;

  const cortadas = regioesDescartadas(params);
  if (cortadas.length) {
    erro = `Você marcou ${params.regioes.length} regiões e o limite por busca é ${MAX_CONSULTAS}. Ficaram de fora: ${cortadas.join(", ")}. Rode uma segunda busca com elas.`;
  }

  for (const consulta of consultas) {
    try {
      brutos.push(...(await buscarNaWeb(consulta, RESULTADOS_POR_CONSULTA)));
    } catch (falha) {
      // Cota estourada ou chave inválida: para de insistir e conta o que já veio.
      erro = falha instanceof Error ? falha.message : "Falha na busca";
      break;
    }
  }

  const vistos = new Set<string>();
  const unicos = brutos.filter((item) => {
    if (!pareceAnuncioDeTerreno(item)) return false;
    const chave = chaveDeUrl(item.url);
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const aceitos: Array<{
    titulo: string;
    url: string;
    fonte: string;
    trecho: string | null;
    areaM2: number | null;
    precoBRL: number | null;
    endereco: string | null;
    bairro: string | null;
    latitude: number | null;
    longitude: number | null;
    zonaDetectada: ZonaChave | null;
    origemZona: "GEOJSON" | "TEXTO" | "PRESUMIDA" | "DESCONHECIDA";
    confianca: number;
  }> = [];

  let geocodificados = 0;
  let geocodificadosComSucesso = 0;

  for (const item of unicos) {
    const dados = extrairTudo(item.titulo, item.trecho);

    if (!passaArea(dados.areaM2, params)) continue;
    if (!passaPreco(dados.precoBRL, params)) continue;

    let latitude: number | null = null;
    let longitude: number | null = null;
    let zonaDetectada: ZonaChave | null = null;
    let origemZona: "GEOJSON" | "TEXTO" | "PRESUMIDA" | "DESCONHECIDA" = "DESCONHECIDA";

    const consultaGeo = consultaDeEndereco({ endereco: dados.endereco, bairro: dados.bairro });
    if (consultaGeo && geocodificados < LIMITE_GEOCODE) {
      geocodificados += 1;
      const ponto = await geocodificar(consultaGeo);
      if (ponto) {
        geocodificadosComSucesso += 1;
        latitude = ponto.latitude;
        longitude = ponto.longitude;
        const resolvida = await resolverZona(ponto.latitude, ponto.longitude);
        if (resolvida) {
          zonaDetectada = resolvida.zona;
          origemZona = "GEOJSON";
        }
      }
    }

    if (!zonaDetectada && dados.zonaTexto) {
      zonaDetectada = normalizarZonaTexto(dados.zonaTexto);
      if (zonaDetectada) origemZona = "TEXTO";
    }
    if (!zonaDetectada && dados.bairro) {
      origemZona = "PRESUMIDA";
    }

    if (!passaZona(zonaDetectada, origemZona, params)) continue;

    aceitos.push({
      titulo: item.titulo.slice(0, 300),
      url: item.url,
      fonte: dominio(item.url),
      trecho: item.trecho?.slice(0, 600) ?? null,
      areaM2: dados.areaM2,
      precoBRL: dados.precoBRL,
      endereco: dados.endereco,
      bairro: dados.bairro,
      latitude,
      longitude,
      zonaDetectada,
      origemZona,
      confianca: calcularConfianca(dados.areaM2, dados.precoBRL, origemZona),
    });
  }

  // Geocodificação silenciosamente quebrada é o pior cenário: tudo vira
  // "a verificar" e ninguém entende por quê. Se nenhuma tentativa deu certo,
  // isso aparece junto do resultado.
  if (!erro && geocodificados > 0 && geocodificadosComSucesso === 0) {
    erro =
      "Nenhum endereço pôde ser geocodificado — as zonas não foram confirmadas. Verifique NOMINATIM_USER_AGENT (o Nominatim recusa requisições sem contato identificado).";
  }

  const busca = await prisma.busca.create({
    data: {
      criadoPorId: usuarioId,
      zonas: params.zonas,
      areaMin: params.areaMin,
      areaMax: params.areaMax,
      precoMax: params.precoMax,
      regioes: params.regioes,
      termosExtras: params.termosExtras,
      provedor: provedorConfigurado(),
      consultas,
      totalBruto: brutos.length,
      totalAceito: aceitos.length,
      erro,
      resultados: { create: aceitos },
    },
    select: { id: true },
  });

  return {
    buscaId: busca.id,
    totalBruto: brutos.length,
    totalAceito: aceitos.length,
    erro,
    demo: ehDemo(),
  };
}

function passaArea(area: number | null, params: ParametrosBusca): boolean {
  if (area == null) return !params.exigirArea;
  if (params.areaMin != null && area < params.areaMin) return false;
  if (params.areaMax != null && area > params.areaMax) return false;
  return true;
}

function passaPreco(preco: number | null, params: ParametrosBusca): boolean {
  if (preco == null) return true;
  if (params.precoMax != null && preco > params.precoMax) return false;
  return true;
}

function passaZona(
  zona: ZonaChave | null,
  origem: "GEOJSON" | "TEXTO" | "PRESUMIDA" | "DESCONHECIDA",
  params: ParametrosBusca,
): boolean {
  if (!params.zonas.length) return true;

  if (zona) return params.zonas.includes(zona);
  // Sem zona confirmada, o anúncio só entra se o usuário aceitar candidatos
  // a confirmar — que é o padrão quando não há camada de zoneamento carregada.
  return !params.exigirZonaConfirmada;
}

function calcularConfianca(
  area: number | null,
  preco: number | null,
  origem: "GEOJSON" | "TEXTO" | "PRESUMIDA" | "DESCONHECIDA",
): number {
  const pesoZona = { GEOJSON: 0.35, TEXTO: 0.2, PRESUMIDA: 0.08, DESCONHECIDA: 0 }[origem];
  const valor = (area != null ? 0.45 : 0) + (preco != null ? 0.2 : 0) + pesoZona;
  return Math.round(valor * 100) / 100;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function obterBusca(id: string) {
  return prisma.busca.findUnique({
    where: { id },
    include: {
      criadoPor: { select: { name: true, email: true } },
      resultados: { orderBy: [{ confianca: "desc" }, { createdAt: "asc" }] },
    },
  });
}

export async function listarBuscas(limite = 20) {
  return prisma.busca.findMany({
    orderBy: { createdAt: "desc" },
    take: limite,
    include: {
      criadoPor: { select: { name: true, email: true } },
      _count: { select: { resultados: true } },
    },
  });
}

export type BuscaDetalhada = NonNullable<Awaited<ReturnType<typeof obterBusca>>>;
export type ResultadoDetalhado = BuscaDetalhada["resultados"][number];

/**
 * R$ por m² de potencial construtivo — a métrica que permite comparar
 * anúncios de tamanhos diferentes já na tela de resultados.
 */
export function precoPorPotencialDoResultado(r: {
  precoBRL: number | null;
  areaM2: number | null;
  zonaDetectada: string | null;
}): number | null {
  if (!r.precoBRL || !r.areaM2 || r.areaM2 <= 0) return null;
  const zona = (r.zonaDetectada as ZonaChave | null) ?? "ZEU";
  const { caMaximo } = coeficientes(zona);
  const potencial = r.areaM2 * caMaximo;
  return potencial > 0 ? Math.round((r.precoBRL / potencial) * 100) / 100 : null;
}

export function estadoDaBusca() {
  return {
    provedor: provedorConfigurado(),
    demo: ehDemo(),
    zoneamento: zoneamentoConfigurado(),
    portais: portais(),
  };
}
