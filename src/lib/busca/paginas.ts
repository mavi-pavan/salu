/**
 * Anúncio de um lote ou página de listagem do portal?
 *
 * O buscador não separa as duas coisas. Perguntar "terreno à venda na Vila
 * Mariana" traz tanto o anúncio de um lote específico quanto a página de
 * resultados do portal — aquela com "1.234 terrenos à venda". A segunda é
 * inútil para prospecção: não tem área, não tem preço, não tem endereço, e o
 * que ela mostra hoje não é o que mostrava ontem.
 *
 * A regra que decide é a URL. Todo portal brasileiro de imóvel dá um número
 * de identificação ao anúncio e o coloca no fim do endereço:
 *
 *   .../imovel/terreno-a-venda-vila-mariana-1000m2-id-2712345678/   <- anúncio
 *   .../venda/sp/sao-paulo/vila-mariana/lote-terreno_residencial/   <- listagem
 *
 * A ordem dos testes importa: o número vem primeiro porque é o sinal mais
 * confiável, e porque a URL de um anúncio quase sempre contém também as
 * palavras da listagem ("venda", "imoveis"). Testar as palavras antes
 * descartaria anúncio bom.
 */

export type TipoPagina = "anuncio" | "listagem" | "indefinido";

/**
 * Número de identificação no fim do caminho: `-id-2712345678`, `/1234567890`,
 * `-2987654321.html`. Seis dígitos é o piso — abaixo disso costuma ser área,
 * ano ou número de página.
 */
const RE_ID = /(?:^|[-_/])(?:id[-_]?)?\d{6,}(?=$|[-_./])/;

/**
 * Filtro de busca também tem número grande no fim ("preco-ate-1000000"), e é
 * exatamente uma página de listagem. Estas palavras desqualificam o número.
 */
const RE_FILTRO = /(pagina|page|preco|valor|ordem|order|filtro|desde|ate|min|max|cep|quarto)/i;

/**
 * Títulos de página de resultado. Só o título entra aqui: o trecho costuma
 * trazer "veja outros 320 terrenos" mesmo em anúncio individual.
 *
 * O discriminante é o plural. Anúncio de lote se chama "Terreno à venda,
 * 1.250 m² por R$ 3.750.000"; a listagem se chama "Terrenos à venda em Vila
 * Mariana" ou "1.234 terrenos à venda".
 */
const TITULOS_DE_LISTAGEM = [
  /\b\d{1,3}(?:\.\d{3})*\s+(?:terrenos|lotes|im[oó]veis|[aá]reas|an[uú]ncios|resultados|op[cç][oõ]es)\b/i,
  // Sem `\b` antes de "à venda": acento não é caractere de palavra em regex
  // JavaScript, então a fronteira nunca casaria e "Terrenos à venda" passaria.
  /\b(?:terrenos|lotes|im[oó]veis|glebas|ch[aá]caras)\b[^|]{0,40}?(?:[àa]\s+venda|para\s+(?:venda|comprar|vender))/i,
  /\bp[aá]gina\s*\d+\b/i,
  /\bresultados?\s+(?:da|de)\s+(?:busca|pesquisa)\b/i,
];

/**
 * Segmentos que, sozinhos, já identificam a raiz de uma busca no portal.
 *
 * "venda", "comprar" e "aluguel" ficaram de fora de propósito, mesmo sendo
 * comuns em página de listagem: eles são igualmente comuns em URL de anúncio
 * individual (`/imovel/venda-terreno-...`), e derrubá-los por essa palavra
 * jogava anúncio bom fora. Quem separa esses casos é o título no plural, que
 * é evidência muito mais firme — e, na falta dela, o resultado fica
 * indefinido e é mantido.
 */
const SEGMENTOS_DE_LISTAGEM = new Set([
  "terrenos",
  "lotes",
  "imoveis",
  "busca",
  "buscar",
  "pesquisa",
  "search",
  "resultado",
  "resultados",
  "listagem",
]);

const PREFIXOS_DE_LISTAGEM = ["terrenos-", "lotes-", "imoveis-", "areas-"];

/** Parâmetros que só existem em tela de resultado. */
const PARAMETROS_DE_LISTAGEM = ["pagina", "page", "transacao", "ordem", "order", "filtro", "q"];

/**
 * Subdomínio dedicado a busca. O Mercado Livre serve toda tela de resultado em
 * `lista.mercadolivre.com.br`, e o caminho lá é a própria frase pesquisada
 * ("/terreno-barato-zona-leste-itaquera") — sem número e no singular, o que
 * escapava das outras duas regras.
 */
const SUBDOMINIOS_DE_LISTAGEM = new Set([
  "lista",
  "listas",
  "busca",
  "buscar",
  "search",
  "pesquisa",
  "resultado",
  "resultados",
]);

/**
 * Portais em que TODO anúncio individual carrega um número na URL.
 *
 * Para esses, a ausência do número é prova suficiente: se o endereço é do
 * portal e não tem identificador, não é a página de um imóvel — é a busca
 * dele. A lista é curta de propósito e só tem portal cujo formato de URL foi
 * conferido; incluir um portal que não segue essa regra descartaria anúncio
 * bom em silêncio, que é o erro mais caro deste arquivo.
 */
const PORTAIS_COM_ID_OBRIGATORIO = [
  "vivareal.com.br",
  "zapimoveis.com.br",
  "imovelweb.com.br",
  "wimoveis.com.br",
  "chavesnamao.com.br",
  "olx.com.br",
  "mercadolivre.com.br",
  "mercadolivre.com",
];

function hospedeiro(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function ehPortalComIdObrigatorio(url: URL): boolean {
  const host = hospedeiro(url);
  return PORTAIS_COM_ID_OBRIGATORIO.some((p) => host === p || host.endsWith(`.${p}`));
}

function segmentos(url: URL): string[] {
  return url.pathname
    .split("/")
    .filter(Boolean)
    .map((s) =>
      s
        .toLowerCase()
        .replace(/\.(html?|php|aspx?)$/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    );
}

export function temIdDeAnuncio(url: string): boolean {
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    return false;
  }

  const partes = segmentos(alvo);
  const ultimo = partes[partes.length - 1];
  if (!ultimo) return false;

  // O número tem que estar no fim do caminho. No meio ele costuma ser código
  // de cidade ou de bairro, que a listagem também carrega.
  if (RE_FILTRO.test(ultimo)) return false;
  return RE_ID.test(ultimo);
}

function urlDeListagem(url: string): boolean {
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    return false;
  }

  for (const parametro of alvo.searchParams.keys()) {
    if (PARAMETROS_DE_LISTAGEM.includes(parametro.toLowerCase())) return true;
  }

  const [subdominio] = hospedeiro(alvo).split(".");
  if (subdominio && SUBDOMINIOS_DE_LISTAGEM.has(subdominio)) return true;

  // Portal que numera todo anúncio e veio sem número: é a busca dele.
  if (ehPortalComIdObrigatorio(alvo)) return true;

  const partes = segmentos(alvo);
  // Portal sem caminho nenhum é a home, que também não é anúncio.
  if (!partes.length) return true;

  return partes.some(
    (parte) =>
      SEGMENTOS_DE_LISTAGEM.has(parte) || PREFIXOS_DE_LISTAGEM.some((p) => parte.startsWith(p)),
  );
}

export function tituloDeListagem(titulo: string): boolean {
  return TITULOS_DE_LISTAGEM.some((re) => re.test(titulo));
}

export function classificarPagina(titulo: string, url: string): TipoPagina {
  if (temIdDeAnuncio(url)) return "anuncio";
  if (tituloDeListagem(titulo)) return "listagem";
  if (urlDeListagem(url)) return "listagem";
  return "indefinido";
}
