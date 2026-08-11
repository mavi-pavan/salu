/**
 * As zonas desenhadas no mapa: formato, geometria e cores. Sem rede.
 *
 * Este arquivo é o contrato entre quem busca os polígonos (servidor) e quem os
 * desenha (navegador), por isso não importa nada de nenhum dos dois lados — e
 * por isso as contas que decidem o que é pedido e o que é simplificado moram
 * aqui, onde dá para testá-las sem subir servidor nem abrir navegador.
 *
 * Por que o app desenha em vez de pedir a imagem pronta: o serviço de imagem
 * (WMS) da Prefeitura não respondeu em nenhum dos endereços plausíveis, e o
 * sintoma no navegador é mudo — as imagens simplesmente não aparecem. O serviço
 * de dados (WFS) é o mesmo que já confirma a zona de cada anúncio e está
 * comprovadamente de pé. Baixar o polígono e traçá-lo custa alguns kilobytes a
 * mais por arraste e, em troca, usa o único caminho que se sabe que funciona.
 */

import type { CaixaUtm } from "./geosampa";
import type { Anel } from "./poligono";
import { LIMITES_SAO_PAULO, paraUtm23S } from "./projecao";
import { ehZonaEixo, type ZonaChave } from "@/lib/zeu";

/**
 * Um contorno fechado pronto para o Leaflet: `[latitude, longitude]`, que é a
 * ordem do Leaflet — e o oposto da ordem do GeoJSON. A conversão acontece uma
 * vez só, no servidor, para não sobrar nenhuma chance de trocar os eixos aqui.
 */
export type AnelLatLng = Array<[number, number]>;

export interface ZonaDesenhavel {
  id: string;
  /** Sigla como a camada devolveu, ex.: "ZEU", "ZEIS-2". */
  sigla: string;
  zona: ZonaChave;
  /** Primeiro anel é o contorno externo; os demais são buracos. */
  aneis: AnelLatLng[];
}

export type RespostaZonas =
  | { estado: "ok"; zonas: ZonaDesenhavel[]; truncado: boolean }
  /** Área grande demais para valer a pena baixar polígono. */
  | { estado: "longe" }
  | { estado: "fora_da_cidade" }
  | { estado: "indisponivel"; motivo: string };

/** Retângulo em grau decimal, como o mapa entende a área visível. */
export interface CaixaGraus {
  sul: number;
  oeste: number;
  norte: number;
  leste: number;
}

/**
 * Abaixo deste zoom o app não pede nada.
 *
 * Não é limite de desempenho do navegador, é de utilidade: o zoneamento de São
 * Paulo tem dezenas de milhares de polígonos, e uma cidade inteira na tela
 * viraria uma mancha sem leitura nenhuma — além de um download de megabytes a
 * cada arraste. A partir daqui a tela mostra alguns bairros e cada mancha tem
 * significado.
 */
export const ZOOM_MINIMO = 14;

/**
 * Teto de feições por requisição.
 *
 * Alto de propósito. O risco aqui não é o peso da resposta — que comprime bem e
 * é afinada antes de sair —, é o recorte: uma zona que ficou de fora do teto
 * some do mapa, e um lote em cima dela parece não estar em zona nenhuma. Uma
 * tela no zoom mínimo cobre cerca de 100 km² de São Paulo, e o zoneamento da
 * cidade inteira tem ordem de dezena de milhar de polígonos — este número
 * precisa cobrir isso com folga. Quando ainda assim não couber, o botão diz
 * "parcial" em vez de fingir que está tudo ali.
 */
export const MAX_ZONAS = 2_500;

/**
 * Teto do lado da caixa aceita, em graus (~55 km).
 *
 * Não é a regra de uso — o mapa não pede nada abaixo do zoom mínimo, e nesse
 * zoom nem a tela mais larga chega perto disto. É o limite de quem chama a rota
 * direto: sem ele, um `?norte=90&sul=-90` viraria um pedido do estado inteiro ao
 * servidor da Prefeitura em nome do app.
 */
export const MAX_LADO_GRAUS = 0.5;

/** Fatia da largura pedida usada como tolerância — cerca de um pixel na tela. */
const FATIA_TOLERANCIA = 1_600;
/** Piso da tolerância, em metros: abaixo disto não compensa afinar. */
const TOLERANCIA_MINIMA_M = 1;

// ---------------------------------------------------------------------------
// A área pedida
// ---------------------------------------------------------------------------

export function caixaValida(c: CaixaGraus): boolean {
  return (
    Number.isFinite(c.sul) &&
    Number.isFinite(c.oeste) &&
    Number.isFinite(c.norte) &&
    Number.isFinite(c.leste) &&
    c.norte > c.sul &&
    c.leste > c.oeste
  );
}

export function grandeDemais(c: CaixaGraus): boolean {
  return c.norte - c.sul > MAX_LADO_GRAUS || c.leste - c.oeste > MAX_LADO_GRAUS;
}

/** A área visível chega a cruzar o município? Fora dele não há o que pedir. */
export function tocaACidade(c: CaixaGraus): boolean {
  return (
    c.norte >= LIMITES_SAO_PAULO.latMin &&
    c.sul <= LIMITES_SAO_PAULO.latMax &&
    c.leste >= LIMITES_SAO_PAULO.lngMin &&
    c.oeste <= LIMITES_SAO_PAULO.lngMax
  );
}

/**
 * A caixa em graus vira caixa em metros pelos quatro cantos, não por dois.
 *
 * Um retângulo em latitude/longitude não é um retângulo em UTM: os meridianos
 * convergem, então a borda norte fica mais estreita que a sul. Projetar só dois
 * cantos deixaria de fora fatias triangulares nas laterais — e polígonos
 * visíveis na tela sumiriam da consulta. Pegando o extremo dos quatro cantos, a
 * caixa em metros contém a área visível inteira.
 */
export function caixaEmMetros(c: CaixaGraus): CaixaUtm {
  const cantos = [
    paraUtm23S(c.sul, c.oeste),
    paraUtm23S(c.sul, c.leste),
    paraUtm23S(c.norte, c.oeste),
    paraUtm23S(c.norte, c.leste),
  ];

  return {
    minX: Math.min(...cantos.map((p) => p.x)),
    minY: Math.min(...cantos.map((p) => p.y)),
    maxX: Math.max(...cantos.map((p) => p.x)),
    maxY: Math.max(...cantos.map((p) => p.y)),
  };
}

export function toleranciaDaCaixa(caixa: CaixaUtm): number {
  return Math.max(TOLERANCIA_MINIMA_M, (caixa.maxX - caixa.minX) / FATIA_TOLERANCIA);
}

/**
 * Teto de vértices numa resposta.
 *
 * Uma tela cabe cerca de um milhão de pixels, e o traço de uma zona só precisa
 * de vértice na resolução do pixel — 40 mil dá um a cada 25 pixels de tela, o
 * que é indistinguível de mais. Cada vértice custa uns 25 bytes no JSON, então
 * isto também segura a resposta perto de 1 MB antes de comprimir, que é o que
 * se pode mandar para um celular no meio de uma busca.
 */
export const MAX_VERTICES = 40_000;

/**
 * Quanto afinar a mais para a resposta caber no orçamento de vértices.
 *
 * Existe porque o tamanho da resposta depende de quão detalhado é o cadastro no
 * trecho pedido — coisa que varia entre bairros e que não dá para saber antes de
 * consultar. Sem este ajuste, uma região de cadastro denso mandaria megabytes
 * para o navegador do meu sogro no meio de uma busca.
 *
 * A contagem de vértices cai aproximadamente na razão da tolerância, então
 * multiplicar pela razão do excesso acerta em uma passada. Nunca afina menos do
 * que já estava: a tolerância só cresce.
 */
export function toleranciaParaCaber(
  tolerancia: number,
  vertices: number,
  orcamento = MAX_VERTICES,
): number {
  if (vertices <= orcamento || orcamento <= 0) return tolerancia;
  return tolerancia * (vertices / orcamento);
}

export function contarVertices(zonas: Array<{ aneis: AnelLatLng[] }>): number {
  return zonas.reduce((soma, z) => soma + z.aneis.reduce((s, anel) => s + anel.length, 0), 0);
}

/**
 * Teto duro do peso da resposta, para quando afinar mais não resolve.
 *
 * Afinar corta vértices até certo ponto: um trecho com milhares de polígonos
 * pequenos continua pesado por mais que se aumente a tolerância, porque cada
 * anel tem um mínimo de quatro pontos que não cede. Aqui a resposta para de
 * crescer de vez — e o que fica de fora é escolhido, não sorteado: o eixo é o
 * assunto da tela e sai por último. Quem foi cortado vira o aviso "parcial" no
 * botão, para ninguém ler mapa incompleto achando que está completo.
 */
export function caberNoOrcamento<T extends { zona: ZonaChave; aneis: AnelLatLng[] }>(
  zonas: T[],
  orcamento = MAX_VERTICES,
): { zonas: T[]; cortadas: number } {
  if (contarVertices(zonas) <= orcamento) return { zonas, cortadas: 0 };

  const porPrioridade = [...zonas].sort(
    (a, b) => Number(ehZonaEixo(b.zona)) - Number(ehZonaEixo(a.zona)),
  );

  const mantidas: T[] = [];
  let soma = 0;
  for (const zona of porPrioridade) {
    const custo = zona.aneis.reduce((s, anel) => s + anel.length, 0);
    // Pula em vez de parar: uma zona grande demais não deve impedir as menores
    // que ainda cabem — e as de eixo já vieram na frente.
    if (soma + custo > orcamento) continue;
    mantidas.push(zona);
    soma += custo;
  }

  return { zonas: mantidas, cortadas: zonas.length - mantidas.length };
}

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

/**
 * Tira os vértices que ficariam a menos de um pixel do anterior.
 *
 * O cadastro da Prefeitura é desenhado em escala de projeto: uma quadra pode ter
 * centenas de pontos, muitos deles a centímetros um do outro. Todos caem no
 * mesmo pixel da tela e, somados pelas feições de um bairro inteiro, viram
 * megabytes trafegados a cada arraste do mapa.
 *
 * Isto afeta só o desenho. A zona de cada anúncio é decidida pela consulta por
 * ponto, que usa o polígono como veio, sem afinar nada.
 */
export function afinarAnel(anel: Anel, toleranciaM: number): Anel {
  if (anel.length <= 4) return anel;

  const saida: Anel = [];
  let ultimo: [number, number] | null = null;

  for (const ponto of anel) {
    if (!ultimo) {
      saida.push(ponto);
      ultimo = ponto;
      continue;
    }
    const dx = ponto[0] - ultimo[0];
    const dy = ponto[1] - ultimo[1];
    if (dx * dx + dy * dy >= toleranciaM * toleranciaM) {
      saida.push(ponto);
      ultimo = ponto;
    }
  }

  // O último ponto de um anel GeoJSON repete o primeiro; ele fecha a figura e
  // não pode ser descartado por proximidade.
  const fim = anel[anel.length - 1];
  const guardado = saida[saida.length - 1];
  if (fim && guardado && (guardado[0] !== fim[0] || guardado[1] !== fim[1])) saida.push(fim);

  // Afinar demais transforma quadra em triângulo. Quando sobra pouco, o
  // original é melhor que uma forma inventada.
  return saida.length >= 4 ? saida : anel;
}

// ---------------------------------------------------------------------------
// Aparência
// ---------------------------------------------------------------------------

export interface EstiloZona {
  cor: string;
  opacidadePreenchimento: number;
  espessura: number;
}

/**
 * Eixo em destaque, o resto em cinza.
 *
 * A tela existe para responder uma pergunta só — "este trecho é de eixo?" — e
 * pintar cada zona de uma cor faria o mapa competir com os círculos dos
 * anúncios, que são o assunto. As demais zonas ficam visíveis apenas o bastante
 * para dar o contorno de onde o eixo termina.
 */
export function estiloDaZona(zona: ZonaChave): EstiloZona {
  if (ehZonaEixo(zona)) {
    return { cor: "#7c3aed", opacidadePreenchimento: 0.22, espessura: 1 };
  }
  if (zona === "ZEIS") {
    return { cor: "#0891b2", opacidadePreenchimento: 0.1, espessura: 0.5 };
  }
  return { cor: "#94a3b8", opacidadePreenchimento: 0.06, espessura: 0.5 };
}
