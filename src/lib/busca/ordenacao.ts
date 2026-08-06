/**
 * Ordem em que os candidatos gastam o orçamento de geocodificação.
 *
 * Existe por causa de um sintoma difícil de aceitar: os mesmos filtros
 * devolviam resultados diferentes a cada busca. A causa era esta ordem.
 *
 * O buscador devolve os mesmos anúncios em sequência diferente de uma execução
 * para outra. Só os primeiros N candidatos são geocodificados (o Nominatim
 * cobra 1,1 s por endereço), e só quem tem coordenada é conferido no
 * zoneamento. Com a ordem do buscador, o subconjunto conferido mudava a cada
 * busca — e como o zoneamento reprova quem está fora da zona pedida, o
 * conjunto final mudava junto. Nada tinha mudado no mundo; tinha mudado o
 * sorteio.
 *
 * A ordem aqui é total e determinística: mesma entrada, mesma saída, em
 * qualquer sequência que ela chegue. E, de quebra, gasta o orçamento com quem
 * tem mais chance de virar negócio, em vez de com quem o buscador listou
 * primeiro.
 */

export interface Ordenavel {
  areaM2: number | null;
  precoBRL: number | null;
  /** Chave estável do anúncio, usada como desempate final. */
  chave: string;
}

/** Anúncio com área e preço vale mais que anúncio com um só, que vale mais que nenhum. */
function completude(item: Ordenavel): number {
  return (item.areaM2 != null ? 2 : 0) + (item.precoBRL ? 1 : 0);
}

export function ordenarPorPrioridade<T extends Ordenavel>(itens: T[]): T[] {
  return [...itens].sort(
    (a, b) =>
      completude(b) - completude(a) ||
      (b.areaM2 ?? 0) - (a.areaM2 ?? 0) ||
      (b.precoBRL ?? 0) - (a.precoBRL ?? 0) ||
      a.chave.localeCompare(b.chave),
  );
}
