/**
 * Extração de dados estruturados a partir do texto de um anúncio.
 *
 * Anúncio de terreno não vem em JSON: vem como "Terreno à venda, 1.250 m² por
 * R$ 3.750.000 - Vila Mariana, São Paulo/SP". Estas funções tiram dali a área,
 * o preço e o endereço, no formato numérico brasileiro.
 *
 * Tudo aqui é heurística e pode errar — por isso o resultado da busca carrega
 * um grau de confiança e nunca vira terreno no funil sem alguém confirmar.
 */

import type { ZonaChave } from "@/lib/zeu";
import { detectarRegiao, normalizar } from "./regioes";

/** "1.250,50" -> 1250.5 | "1250" -> 1250 | "2,5" -> 2.5 */
export function numeroBR(texto: string): number | null {
  const limpo = texto.replace(/\s/g, "");
  if (!limpo) return null;

  const temPonto = limpo.includes(".");
  const temVirgula = limpo.includes(",");

  let normalizado: string;
  if (temPonto && temVirgula) {
    // Formato completo: ponto de milhar, vírgula decimal.
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    normalizado = limpo.replace(",", ".");
  } else if (temPonto) {
    // "1.250" é milhar; "1.5" é decimal. Três dígitos após o último ponto
    // indicam separador de milhar.
    const partes = limpo.split(".");
    const ultima = partes[partes.length - 1] ?? "";
    normalizado = ultima.length === 3 ? limpo.replace(/\./g, "") : limpo;
  } else {
    normalizado = limpo;
  }

  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

const RE_AREA =
  /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(?:m²|m2|m\s*²|metros\s+quadrados|mts²)/gi;

/** Área menor que isso não é terreno para incorporação; maior é erro de leitura. */
const AREA_MIN_PLAUSIVEL = 80;
const AREA_MAX_PLAUSIVEL = 200_000;

const PISTAS_TERRENO = ["terreno", "lote", "área total", "area total", "gleba", "área do terreno"];

/**
 * Área do terreno em m².
 *
 * Um anúncio pode citar várias áreas ("terreno 1.000 m², construída 320 m²").
 * A regra: se alguma ocorrência estiver perto da palavra terreno/lote, ela
 * ganha; senão fica a maior área plausível, que num anúncio de terreno é
 * quase sempre a do lote.
 */
export function extrairArea(texto: string): number | null {
  if (!texto) return null;
  const alvo = normalizar(texto);

  const candidatos: Array<{ valor: number; comPista: boolean }> = [];
  for (const achado of texto.matchAll(RE_AREA)) {
    const bruto = achado[1];
    if (!bruto) continue;
    const valor = numeroBR(bruto);
    if (valor == null || valor < AREA_MIN_PLAUSIVEL || valor > AREA_MAX_PLAUSIVEL) continue;

    const inicio = Math.max(0, (achado.index ?? 0) - 40);
    const contexto = normalizar(texto.slice(inicio, (achado.index ?? 0) + 10));
    const comPista = PISTAS_TERRENO.some((p) => contexto.includes(normalizar(p)));
    candidatos.push({ valor, comPista });
  }

  if (!candidatos.length) return null;

  const comPista = candidatos.filter((c) => c.comPista);
  const pool = comPista.length ? comPista : candidatos;
  // Ignora "área construída" quando o texto claramente separa as duas.
  const somenteTerreno = alvo.includes("area construida") && comPista.length ? comPista : pool;

  return Math.max(...somenteTerreno.map((c) => c.valor));
}

const RE_PRECO =
  /R\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:[.,]\d+)?)\s*(milh(?:ão|ões)|mi\b|mil\b)?/gi;

/** Preço em reais. Entende "R$ 2,5 milhões" e "R$ 2.500.000". */
export function extrairPreco(texto: string): number | null {
  if (!texto) return null;

  const valores: number[] = [];
  for (const achado of texto.matchAll(RE_PRECO)) {
    const bruto = achado[1];
    if (!bruto) continue;
    let valor = numeroBR(bruto);
    if (valor == null) continue;

    const sufixo = (achado[2] ?? "").toLowerCase();
    if (sufixo.startsWith("milh") || sufixo === "mi") valor *= 1_000_000;
    else if (sufixo === "mil") valor *= 1_000;

    // Terreno em São Paulo abaixo de R$ 100 mil costuma ser preço de aluguel,
    // condomínio ou parcela — não o valor do imóvel.
    if (valor >= 100_000 && valor <= 5_000_000_000) valores.push(valor);
  }

  return valores.length ? Math.max(...valores) : null;
}

const RE_LOGRADOURO =
  /\b(rua|avenida|av\.?|alameda|al\.?|travessa|praça|estrada|rodovia|largo|viela)\s+([A-ZÀ-Ú][\wÀ-ú'.-]*(?:\s+(?:d[aeo]s?|e|[A-ZÀ-Ú][\wÀ-ú'.-]*)){0,5})/i;

export function extrairLogradouro(texto: string): string | null {
  const achado = texto.match(RE_LOGRADOURO);
  if (!achado) return null;
  const via = (achado[1] ?? "").replace(/\bav\.?\b/i, "Avenida").replace(/\bal\.?\b/i, "Alameda");
  const nome = (achado[2] ?? "").trim().replace(/[,;.]$/, "");
  if (nome.length < 3) return null;
  return `${via.charAt(0).toUpperCase()}${via.slice(1).toLowerCase()} ${nome}`.trim();
}

export function extrairBairro(texto: string): string | null {
  return detectarRegiao(texto);
}

/** ZEU citada no próprio texto do anúncio — sinal fraco, mas é sinal. */
export function extrairZonaMencionada(texto: string): string | null {
  const achado = texto.match(/\bZ(?:EU|EM)\s?(?:P)?\s?(?:a)?\b/i);
  if (!achado) return null;
  const bruto = achado[0].replace(/\s/g, "").toUpperCase();
  const mapa: Record<string, string> = {
    ZEU: "ZEU",
    ZEUA: "ZEUa",
    ZEUP: "ZEUP",
    ZEUPA: "ZEUPa",
    ZEM: "ZEM",
    ZEMP: "ZEMP",
  };
  return mapa[bruto] ?? null;
}

/** "ZEUa" / "zeu p" -> chave do enum de zona. */
export function normalizarZonaTexto(bruto: string): ZonaChave | null {
  const limpo = bruto.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const mapa: Record<string, ZonaChave> = {
    ZEU: "ZEU",
    ZEUA: "ZEUa",
    ZEUP: "ZEUP",
    ZEUPA: "ZEUPa",
    ZEM: "ZEM",
    ZEMP: "ZEMP",
  };
  return mapa[limpo] ?? null;
}

export interface DadosExtraidos {
  areaM2: number | null;
  precoBRL: number | null;
  endereco: string | null;
  bairro: string | null;
  zonaTexto: string | null;
}

export function extrairTudo(titulo: string, trecho?: string | null): DadosExtraidos {
  const texto = [titulo, trecho ?? ""].join(" · ");
  return {
    areaM2: extrairArea(texto),
    precoBRL: extrairPreco(texto),
    endereco: extrairLogradouro(texto),
    bairro: extrairBairro(texto),
    zonaTexto: extrairZonaMencionada(texto),
  };
}

/** Domínio limpo, para agrupar e exibir a fonte do anúncio. */
export function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "desconhecido";
  }
}
