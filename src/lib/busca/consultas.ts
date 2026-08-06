/**
 * Montagem das consultas enviadas ao provedor de busca.
 *
 * Vive fora de `server/busca.ts` porque é lógica pura e merece teste: é aqui
 * que se decide quais regiões realmente entram na busca, e um erro nesta conta
 * some com bairros inteiros sem ninguém perceber.
 */

import { REGIOES, SETORES } from "./regioes";

/** Teto absoluto de consultas por busca, para não torrar a cota do provedor. */
export const MAX_CONSULTAS = 20;

const PORTAIS_PADRAO = [
  "vivareal.com.br",
  "zapimoveis.com.br",
  "imovelweb.com.br",
  "chavesnamao.com.br",
  "olx.com.br",
  "netimoveis.com",
  "wimoveis.com.br",
];

export interface EntradaConsultas {
  regioes: string[];
  termosExtras: string | null;
  /** Só governa a amostra automática, quando nenhuma região foi marcada. */
  maxConsultas: number;
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

export function montarConsultas(entrada: EntradaConsultas): string[] {
  const lista = portais().slice(0, MAX_SITES_NA_CONSULTA);
  const filtroSite = lista.length ? `(${lista.map((p) => `site:${p}`).join(" OR ")})` : "";

  return regioesDaBusca(entrada).map((regiao) =>
    ["terreno à venda", regiao, "São Paulo", "m²", entrada.termosExtras ?? "", filtroSite]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}
