import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Geocodificação via Nominatim (OpenStreetMap).
 *
 * A política de uso do Nominatim pede no máximo 1 requisição por segundo e um
 * User-Agent identificável. As duas coisas estão respeitadas aqui: a fila
 * serializa as chamadas e o cache em banco evita repetir endereço já
 * consultado — inclusive os que não foram encontrados, que são os que mais
 * tentariam de novo.
 *
 * Precisando de volume ou precisão maior, troque por Google Geocoding ou
 * Mapbox: basta reimplementar `consultarProvedor`.
 */

const INTERVALO_MS = 1_100;

/**
 * O Nominatim responde 403 para quem não se identifica com um contato real.
 * Configure NOMINATIM_USER_AGENT com algo como
 * "salu/1.0 (voce@exemplo.com)" — sem isso, a geocodificação
 * simplesmente não funciona e todas as zonas ficam "a verificar".
 */
const USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? "salu/1.0 (contato-nao-configurado)";

export interface Coordenada {
  latitude: number;
  longitude: number;
  enderecoNormalizado: string | null;
}

let ultimaChamada = 0;
let fila: Promise<unknown> = Promise.resolve();

/** Serializa as chamadas e garante o intervalo mínimo entre elas. */
function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const espera = INTERVALO_MS - (Date.now() - ultimaChamada);
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimaChamada = Date.now();
    return tarefa();
  });
  // A fila não pode quebrar por causa de uma falha isolada.
  fila = proxima.catch(() => undefined);
  return proxima;
}

async function consultarProvedor(consulta: string): Promise<Coordenada | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", consulta);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  const resposta = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
    signal: AbortSignal.timeout(12_000),
  });

  if (!resposta.ok) throw new Error(`Nominatim respondeu ${resposta.status}`);

  const dados = (await resposta.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;

  const primeiro = dados[0];
  if (!primeiro?.lat || !primeiro?.lon) return null;

  const latitude = Number(primeiro.lat);
  const longitude = Number(primeiro.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude, enderecoNormalizado: primeiro.display_name ?? null };
}

export interface RespostaGeocodificacao {
  ponto: Coordenada | null;
  /**
   * Verdadeiro quando a resposta saiu do banco, sem tocar a rede.
   *
   * Quem chama precisa saber: consulta em cache custa milissegundos, consulta
   * nova custa 1,1 s de fila. Gastar a mesma cota nas duas fazia a segunda
   * busca da mesma região confirmar tão poucas zonas quanto a primeira.
   */
  doCache: boolean;
}

export async function geocodificar(consultaBruta: string): Promise<RespostaGeocodificacao> {
  const consulta = consultaBruta.trim().replace(/\s+/g, " ").slice(0, 300);
  if (consulta.length < 6) return { ponto: null, doCache: true };

  const emCache = await prisma.geocodificacao.findUnique({ where: { consulta } });
  if (emCache) {
    const ponto =
      emCache.latitude != null && emCache.longitude != null
        ? {
            latitude: emCache.latitude,
            longitude: emCache.longitude,
            enderecoNormalizado: emCache.enderecoNormalizado,
          }
        : null;
    return { ponto, doCache: true };
  }

  let resultado: Coordenada | null = null;
  try {
    resultado = await enfileirar(() => consultarProvedor(consulta));
  } catch (erro) {
    console.error("Geocodificação falhou:", erro);
    return { ponto: null, doCache: false }; // falha de rede não vira cache negativo
  }

  await prisma.geocodificacao
    .create({
      data: {
        consulta,
        latitude: resultado?.latitude ?? null,
        longitude: resultado?.longitude ?? null,
        enderecoNormalizado: resultado?.enderecoNormalizado ?? null,
      },
    })
    .catch(() => undefined);

  return { ponto: resultado, doCache: false };
}

/**
 * Monta a string de busca a partir do que foi possível extrair do anúncio.
 *
 * A precisão daqui decide se a zona vai ser confirmada ou não, e as opções não
 * são equivalentes:
 *
 *   rua + número  -> cai no lote. É o que permite afirmar a zona.
 *   CEP           -> cai na face da quadra. Quase tão bom, e independe de o
 *                    geocodificador conhecer a numeração da rua.
 *   só a rua      -> cai no meio dela. Numa via longa como a Domingos de
 *                    Morais, o meio pode estar em zona diferente das pontas.
 *   só o bairro   -> cai no centroide. Serve para situar, não para confirmar.
 *
 * Por isso o número e o CEP entram juntos quando existem: um corrige o outro
 * quando o geocodificador não conhece a numeração.
 */
export function consultaDeEndereco(partes: {
  endereco?: string | null;
  numero?: string | null;
  cep?: string | null;
  bairro?: string | null;
  cidade?: string;
}): string | null {
  // Sem logradouro, CEP nem bairro, sobra "São Paulo" — isso não diz nada.
  if (!partes.endereco && !partes.bairro && !partes.cep) return null;

  const logradouro =
    partes.endereco && partes.numero
      ? `${partes.endereco}, ${partes.numero}`
      : (partes.endereco ?? null);

  const pedacos = [
    logradouro,
    partes.bairro,
    partes.cidade ?? "São Paulo",
    "SP",
    partes.cep,
    "Brasil",
  ]
    .filter(Boolean)
    .map((p) => String(p).trim());

  return pedacos.join(", ");
}

/** Quanto se pode confiar na coordenada, dado o que o anúncio trazia. */
export type PrecisaoEndereco = "lote" | "quadra" | "via" | "bairro";

export function precisaoDoEndereco(partes: {
  endereco?: string | null;
  numero?: string | null;
  cep?: string | null;
  bairro?: string | null;
}): PrecisaoEndereco {
  if (partes.endereco && partes.numero) return "lote";
  if (partes.cep) return "quadra";
  if (partes.endereco) return "via";
  return "bairro";
}
