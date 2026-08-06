/**
 * Montagem das consultas enviadas ao provedor de busca.
 *
 * Vive fora de `server/busca.ts` porque é lógica pura e merece teste: é aqui
 * que se decide quais regiões realmente entram na busca, e um erro nesta conta
 * some com bairros inteiros sem ninguém perceber.
 */

import { REGIOES, SETORES, type Regiao } from "./regioes";

/** Teto absoluto de consultas por busca, para não torrar a cota do provedor. */
export const MAX_CONSULTAS = 20;

/**
 * Cada jeito de perguntar acha um tipo diferente de anúncio.
 *
 *   bairro       "terreno à venda Vila Mariana" — o bairro inteiro, inclusive
 *                o que está longe do eixo. É a rede mais larga.
 *   estacao      "terreno à venda estação Praça da Árvore" — a ZEU é uma faixa
 *                em torno da estação, e o anúncio de terreno de incorporação
 *                cita a estação porque é o argumento de venda dele. Esta é a
 *                consulta que mira no alvo.
 *   incorporacao "área para incorporação Vila Mariana" — como o vendedor que
 *                já sabe o que tem em mãos anuncia. Costuma ser lote grande,
 *                sem benfeitoria, às vezes sem preço no anúncio.
 */
export const VARIACOES = ["bairro", "estacao", "incorporacao"] as const;
export type Variacao = (typeof VARIACOES)[number];

export const VARIACOES_PADRAO: Variacao[] = ["bairro", "estacao"];

export function ehVariacao(valor: string): valor is Variacao {
  return (VARIACOES as readonly string[]).includes(valor);
}

const PORTAIS_PADRAO = [
  "vivareal.com.br",
  "zapimoveis.com.br",
  "imovelweb.com.br",
  "chavesnamao.com.br",
  "olx.com.br",
  "netimoveis.com",
  "wimoveis.com.br",
  // Terreno de periferia e de espólio aparece muito aqui, e o anúncio costuma
  // ser do próprio dono — sem corretor no meio.
  "mercadolivre.com.br",
];

export interface EntradaConsultas {
  regioes: string[];
  termosExtras: string | null;
  /** Só governa a amostra automática, quando nenhuma região foi marcada. */
  maxConsultas: number;
  /** Vazio = usa o padrão. */
  variacoes?: Variacao[];
}

export function portais(): string[] {
  const bruto = process.env.BUSCA_PORTAIS;
  if (!bruto) return PORTAIS_PADRAO;
  return bruto
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Sem região escolhida, distribui a amostra entre os setores da cidade em vez
 * de pegar os primeiros da lista — senão toda busca sairia enviesada para o
 * Centro, que é o começo do arquivo.
 */
export function amostraDeRegioes(quantidade: number): string[] {
  const porSetor = SETORES.map((setor) => REGIOES.filter((r) => r.setor === setor));
  const saida: string[] = [];
  let indice = 0;

  while (saida.length < quantidade) {
    let adicionou = false;
    for (const grupo of porSetor) {
      const regiao = grupo[indice];
      if (regiao) {
        saida.push(regiao.nome);
        adicionou = true;
        if (saida.length >= quantidade) break;
      }
    }
    if (!adicionou) break;
    indice += 1;
  }
  return saida;
}

/**
 * Região marcada a dedo é intenção explícita: todas entram, até o teto.
 * `maxConsultas` só limita a amostra automática — antes ele cortava também a
 * seleção manual, e quem marcava dez bairros recebia resultado de seis.
 */
export function regioesDaBusca(entrada: EntradaConsultas): string[] {
  if (entrada.regioes.length) return entrada.regioes.slice(0, MAX_CONSULTAS);
  return amostraDeRegioes(Math.max(1, Math.min(entrada.maxConsultas, MAX_CONSULTAS)));
}

/** Regiões marcadas que não couberam no teto. */
export function regioesDescartadas(entrada: EntradaConsultas): string[] {
  if (entrada.regioes.length <= MAX_CONSULTAS) return [];
  return entrada.regioes.slice(MAX_CONSULTAS);
}

/**
 * Remove o grupo `(site:a OR site:b ...)` do fim da consulta.
 *
 * Serve de plano B: o grupo de operadores é a parte mais exótica da consulta e
 * a primeira candidata a ser recusada por um provedor. Sem ele a busca fica
 * mais aberta, mas continua trazendo anúncio — melhor que voltar de mãos
 * vazias.
 */
export function semFiltroDeSites(consulta: string): string {
  return consulta.replace(/\s*\(\s*site:[^)]*\)\s*$/i, "").trim();
}

/**
 * Quantos `site:` cabem numa consulta.
 *
 * O Serper recusa (400) o grupo com os sete portais da lista — provavelmente
 * pelo tamanho. Quatro é o meio-termo: cobre os portais que concentram anúncio
 * de terreno em São Paulo sem esticar a consulta. Se ainda assim for recusado,
 * `semFiltroDeSites` entra e a busca roda aberta.
 */
export const MAX_SITES_NA_CONSULTA = 4;

function regiaoPorNome(nome: string): Regiao | undefined {
  return REGIOES.find((r) => r.nome === nome);
}

/**
 * As consultas de uma região, na ordem em que merecem a cota.
 *
 * O bairro vem primeiro por ser a rede mais larga; as estações depois, uma a
 * uma. Assim, quando a cota aperta, o que se perde são estações da segunda
 * volta — nunca a cobertura básica de uma região que o usuário marcou.
 */
function consultasDaRegiao(nome: string, variacoes: Variacao[]): string[] {
  const saida: string[] = [];
  if (variacoes.includes("bairro")) saida.push(`terreno à venda ${nome} São Paulo`);
  if (variacoes.includes("incorporacao")) {
    saida.push(`área para incorporação ${nome} São Paulo`);
  }
  if (variacoes.includes("estacao")) {
    for (const estacao of regiaoPorNome(nome)?.estacoes ?? []) {
      saida.push(`terreno à venda estação ${estacao} São Paulo`);
    }
  }
  return saida;
}

/**
 * Distribui a cota em rodadas, uma região por vez.
 *
 * Sem isto, a primeira região marcada consumiria as vinte consultas com suas
 * estações e as outras dezenove ficariam sem nenhuma — quem marcou dez bairros
 * receberia resultado de um.
 */
function porRodadas(porRegiao: string[][], teto: number): string[] {
  const saida: string[] = [];
  for (let volta = 0; saida.length < teto; volta += 1) {
    let adicionou = false;
    for (const lista of porRegiao) {
      const consulta = lista[volta];
      if (!consulta) continue;
      saida.push(consulta);
      adicionou = true;
      if (saida.length >= teto) break;
    }
    if (!adicionou) break;
  }
  return saida;
}

export function montarConsultas(entrada: EntradaConsultas): string[] {
  const lista = portais().slice(0, MAX_SITES_NA_CONSULTA);
  const filtroSite = lista.length ? `(${lista.map((p) => `site:${p}`).join(" OR ")})` : "";
  const variacoes = entrada.variacoes?.length ? entrada.variacoes : VARIACOES_PADRAO;

  const porRegiao = regioesDaBusca(entrada).map((nome) => consultasDaRegiao(nome, variacoes));

  // Sem região marcada, `maxConsultas` é o orçamento total pedido pelo usuário
  // — e ele fala de consultas, não de regiões. Com regiões marcadas, todas
  // entram e o teto é o absoluto.
  const teto = entrada.regioes.length
    ? MAX_CONSULTAS
    : Math.max(1, Math.min(entrada.maxConsultas, MAX_CONSULTAS));

  return porRodadas(porRegiao, teto).map((base) =>
    [base, "m²", entrada.termosExtras ?? "", filtroSite]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** Quantas consultas a busca vai disparar com esses filtros. */
export function totalDeConsultas(entrada: EntradaConsultas): number {
  return montarConsultas(entrada).length;
}
