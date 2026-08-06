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
import { detectarRegiao, normalizar, REGIOES } from "./regioes";

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

/**
 * Terreno anunciado pelas medidas da frente e do fundo: "10x30", "12,5 x 40 m".
 * É formato comum e, sem ele, o anúncio inteiro era descartado por não ter
 * área — mesmo trazendo a área escrita de outro jeito.
 */
const RE_DIMENSOES = /(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?)?\s*[x×]\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?)?\b/gi;

/** Gleba costuma ser anunciada em hectare, e 1 ha = 10.000 m². */
const RE_HECTARES = /(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(?:ha\b|hectares?\b)/gi;

/** Área menor que isso não é terreno para incorporação; maior é erro de leitura. */
const AREA_MIN_PLAUSIVEL = 80;
const AREA_MAX_PLAUSIVEL = 200_000;

/** Frente ou fundo fora desta faixa não é medida de lote urbano. */
const LADO_MIN_M = 3;
const LADO_MAX_M = 500;

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

  if (candidatos.length) {
    const comPista = candidatos.filter((c) => c.comPista);
    const pool = comPista.length ? comPista : candidatos;
    // Ignora "área construída" quando o texto claramente separa as duas.
    const somenteTerreno = alvo.includes("area construida") && comPista.length ? comPista : pool;

    return Math.max(...somenteTerreno.map((c) => c.valor));
  }

  // Sem área escrita em m², o anúncio ainda pode trazê-la de outro jeito.
  return areaPorDimensoes(texto) ?? areaPorHectares(texto);
}

/** "10x30" -> 300 m². Só aceita medidas que existem em lote urbano. */
export function areaPorDimensoes(texto: string): number | null {
  const areas: number[] = [];
  for (const achado of texto.matchAll(RE_DIMENSOES)) {
    const frente = numeroBR(achado[1] ?? "");
    const fundo = numeroBR(achado[2] ?? "");
    if (frente == null || fundo == null) continue;
    if (frente < LADO_MIN_M || frente > LADO_MAX_M) continue;
    if (fundo < LADO_MIN_M || fundo > LADO_MAX_M) continue;

    const area = frente * fundo;
    if (area >= AREA_MIN_PLAUSIVEL && area <= AREA_MAX_PLAUSIVEL) areas.push(area);
  }
  return areas.length ? Math.max(...areas) : null;
}

export function areaPorHectares(texto: string): number | null {
  const areas: number[] = [];
  for (const achado of texto.matchAll(RE_HECTARES)) {
    const valor = numeroBR(achado[1] ?? "");
    if (valor == null || valor <= 0) continue;
    const area = valor * 10_000;
    if (area >= AREA_MIN_PLAUSIVEL && area <= AREA_MAX_PLAUSIVEL) areas.push(area);
  }
  return areas.length ? Math.max(...areas) : null;
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

/**
 * Distância até a estação, em metros.
 *
 * Entra na pontuação do terreno e é o melhor indício de eixo que um anúncio
 * oferece: a ZEU é desenhada em faixa de algumas centenas de metros em torno
 * da estação, então "a 250 m do metrô" é evidência forte — ainda que não
 * substitua a confirmação no zoneamento.
 *
 * "A cinco minutos a pé" fica de fora de propósito: virar metro exigiria
 * arbitrar uma velocidade de caminhada, e o número sairia com uma precisão
 * que o anúncio não tem.
 */
const RE_DISTANCIA_ESTACAO =
  /(\d{1,3}(?:\.\d{3})?(?:,\d+)?)\s*(m|mts?|metros|km|quil[oô]metros)\b[^.;|]{0,40}?\b(?:d[oa]s?\s+)?(?:metr[ôo]|esta[cç][ãa]o|trem|cptm|monotrilho)/i;

export function extrairDistanciaEstacaoM(texto: string): number | null {
  const achado = texto.match(RE_DISTANCIA_ESTACAO);
  if (!achado) return null;

  const valor = numeroBR(achado[1] ?? "");
  if (valor == null || valor <= 0) return null;

  const unidade = (achado[2] ?? "").toLowerCase();
  const metros = unidade.startsWith("km") || unidade.startsWith("quil") ? valor * 1000 : valor;

  // Acima de 3 km a estação deixou de ser argumento e virou outra coisa no
  // texto; abaixo de 20 m é erro de leitura.
  return metros >= 20 && metros <= 3000 ? Math.round(metros) : null;
}

/**
 * O fim da palavra é um lookahead, não `\b`: "metrô" termina em caractere
 * acentuado, que o `\b` do JavaScript não trata como letra — a fronteira nunca
 * casaria. E sem nenhuma marca de fim, "trem" acharia "extremo".
 */
const RE_TRANSPORTE = /\b(metr[ôo]|esta[cç][ãa]o|cptm|monotrilho|trem)(?![\wÀ-ú])/i;

/** Estações conhecidas, da mais longa para a mais curta: "Santa Cruz" antes de "Santa". */
const ESTACOES_CONHECIDAS = [...new Set(REGIOES.flatMap((r) => r.estacoes))]
  .map((nome) => ({ nome, normalizado: normalizar(nome) }))
  .sort((a, b) => b.normalizado.length - a.normalizado.length);

// A palavra-chave aceita maiúscula e minúscula, mas o nome capturado precisa
// começar com maiúscula: com o flag `i` na expressão inteira, "estação a 200m"
// devolveria "a" como nome de estação.
const RE_ESTACAO_CITADA =
  /\b(?:[Mm]etr[ôo]|[Ee]sta[cç][ãa]o)\s+(?:d[oa]s?\s+)?([A-ZÀ-Ú][\wÀ-ú'.-]*(?:\s+(?:d[aeo]s?|e|[A-ZÀ-Ú][\wÀ-ú'.-]*)){0,3})/;

/**
 * Estação citada no anúncio.
 *
 * Primeiro procura pelas estações que o app conhece — casar com a lista evita
 * pegar "Estação Plaza Shopping" como se fosse metrô. Se nada casar, aceita o
 * nome que vier depois de "metrô"/"estação", que cobre as estações fora da
 * lista curada.
 */
export function extrairEstacao(texto: string): string | null {
  // Sem uma palavra de transporte no texto, não há estação citada — e metade
  // dos nomes de estação em São Paulo são também nomes de bairro. Sem esta
  // guarda, "terreno na Saúde" ganharia uma estação que o anúncio nunca
  // mencionou, em cima de um campo que a ficha do terreno leva a sério.
  if (!RE_TRANSPORTE.test(texto)) return null;

  const alvo = normalizar(texto);
  for (const estacao of ESTACOES_CONHECIDAS) {
    if (alvo.includes(estacao.normalizado)) return estacao.nome;
  }

  const achado = texto.match(RE_ESTACAO_CITADA);
  const nome = achado?.[1]?.trim().replace(/[,;.]$/, "");
  return nome && nome.length >= 3 ? nome : null;
}

export interface DadosExtraidos {
  areaM2: number | null;
  precoBRL: number | null;
  endereco: string | null;
  bairro: string | null;
  zonaTexto: string | null;
  estacao: string | null;
  distanciaEstacaoM: number | null;
}

export function extrairTudo(titulo: string, trecho?: string | null): DadosExtraidos {
  const texto = [titulo, trecho ?? ""].join(" · ");
  return {
    areaM2: extrairArea(texto),
    precoBRL: extrairPreco(texto),
    endereco: extrairLogradouro(texto),
    bairro: extrairBairro(texto),
    zonaTexto: extrairZonaMencionada(texto),
    estacao: extrairEstacao(texto),
    distanciaEstacaoM: extrairDistanciaEstacaoM(texto),
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
