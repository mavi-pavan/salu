/**
 * Provedores de busca na web.
 *
 * Portais de imóvel não publicam API aberta e bloqueiam raspagem direta. O
 * caminho que funciona (e que não viola termos de uso) é consultar um provedor
 * de busca, ler título e trecho que ele devolve e trabalhar em cima disso.
 *
 * Qualquer um dos três serviços abaixo resolve — todos têm cota gratuita.
 * Basta colocar UMA chave no .env que o app detecta sozinho:
 *
 *   SERPER_API_KEY   (serper.dev — resultados do Google, 2.500 buscas grátis)
 *   BRAVE_API_KEY    (api.search.brave.com — 2.000 buscas/mês grátis)
 *   TAVILY_API_KEY   (tavily.com — 1.000 buscas/mês grátis)
 *
 * Sem nenhuma chave, o app usa o provedor "demo": dados fictícios, marcados
 * como tal na interface, só para conhecer o fluxo antes de assinar algo.
 */

export interface ItemWeb {
  titulo: string;
  url: string;
  trecho: string | null;
}

export type ProvedorNome = "serper" | "brave" | "tavily" | "demo";

const TIMEOUT_MS = 15_000;

export function provedorConfigurado(): ProvedorNome {
  const escolhido = (process.env.BUSCA_PROVEDOR ?? "auto").toLowerCase();
  if (escolhido === "serper" || escolhido === "brave" || escolhido === "tavily" || escolhido === "demo") {
    return escolhido;
  }
  if (process.env.SERPER_API_KEY) return "serper";
  if (process.env.BRAVE_API_KEY) return "brave";
  if (process.env.TAVILY_API_KEY) return "tavily";
  return "demo";
}

export function ehDemo(): boolean {
  return provedorConfigurado() === "demo";
}

/**
 * Chave colada de painel costuma vir com espaço ou quebra de linha grudada, e
 * header inválido vira erro genérico difícil de rastrear.
 */
function chave(nome: string): string {
  return (process.env[nome] ?? "").trim();
}

/**
 * "Serper respondeu 400" não diz nada a quem precisa consertar. O corpo da
 * resposta quase sempre nomeia o parâmetro recusado — então ele vai junto.
 */
async function erroDaResposta(provedor: string, resposta: Response): Promise<Error> {
  let detalhe = "";
  try {
    const texto = (await resposta.text()).trim();
    if (texto) detalhe = ` — ${texto.slice(0, 300)}`;
  } catch {
    // corpo ilegível: o status já basta
  }
  return new Error(`${provedor} respondeu ${resposta.status}${detalhe}`);
}

export async function buscarNaWeb(consulta: string, limite = 20): Promise<ItemWeb[]> {
  switch (provedorConfigurado()) {
    case "serper":
      return viaSerper(consulta, limite);
    case "brave":
      return viaBrave(consulta, limite);
    case "tavily":
      return viaTavily(consulta, limite);
    default:
      return viaDemo(consulta, limite);
  }
}

// ---------------------------------------------------------------------------

async function viaSerper(consulta: string, limite: number): Promise<ItemWeb[]> {
  const resposta = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": chave("SERPER_API_KEY"),
      "Content-Type": "application/json",
    },
    // `num` só aceita alguns degraus (10, 20, 30...); 20 é o que usamos.
    body: JSON.stringify({ q: consulta, gl: "br", hl: "pt-br", num: Math.min(limite, 100) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!resposta.ok) throw await erroDaResposta("Serper", resposta);
  const dados = (await resposta.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (dados.organic ?? [])
    .filter((i) => i.link && i.title)
    .map((i) => ({ titulo: i.title as string, url: i.link as string, trecho: i.snippet ?? null }));
}

async function viaBrave(consulta: string, limite: number): Promise<ItemWeb[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", consulta);
  url.searchParams.set("country", "br");
  url.searchParams.set("search_lang", "pt");
  url.searchParams.set("count", String(Math.min(limite, 20)));

  const resposta = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": chave("BRAVE_API_KEY"),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!resposta.ok) throw await erroDaResposta("Brave", resposta);
  const dados = (await resposta.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };

  return (dados.web?.results ?? [])
    .filter((i) => i.url && i.title)
    .map((i) => ({
      titulo: i.title as string,
      url: i.url as string,
      trecho: i.description?.replace(/<[^>]+>/g, "") ?? null,
    }));
}

async function viaTavily(consulta: string, limite: number): Promise<ItemWeb[]> {
  const resposta = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${chave("TAVILY_API_KEY")}`,
    },
    body: JSON.stringify({
      query: consulta,
      max_results: Math.min(limite, 20),
      search_depth: "basic",
      country: "brazil",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!resposta.ok) throw await erroDaResposta("Tavily", resposta);
  const dados = (await resposta.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (dados.results ?? [])
    .filter((i) => i.url && i.title)
    .map((i) => ({ titulo: i.title as string, url: i.url as string, trecho: i.content ?? null }));
}

// ---------------------------------------------------------------------------
// Demo: dados fictícios para navegar o fluxo sem chave de API.
// URLs terminam em .invalid (reservado pela RFC 2606) para deixar claro que
// não são anúncios reais.
// ---------------------------------------------------------------------------

const MODELOS_DEMO = [
  { area: 1250, preco: 4_200_000, via: "Rua Doutor Mário Vicente" },
  { area: 820, preco: 3_100_000, via: "Avenida Bosque da Saúde" },
  { area: 2400, preco: 9_800_000, via: "Rua Vergueiro" },
  { area: 640, preco: 2_450_000, via: "Rua Luís Góis" },
  { area: 3100, preco: 13_500_000, via: "Avenida Jabaquara" },
  { area: 1580, preco: 6_300_000, via: "Rua Domingos de Morais" },
  { area: 480, preco: 1_900_000, via: "Rua Coronel Lisboa" },
  { area: 5200, preco: 21_000_000, via: "Avenida Ricardo Jafet" },
];

async function viaDemo(consulta: string, limite: number): Promise<ItemWeb[]> {
  const bairro = consulta.match(/terreno à venda ([^,(]+?) São Paulo/i)?.[1]?.trim() ?? "São Paulo";

  return MODELOS_DEMO.slice(0, Math.min(limite, MODELOS_DEMO.length)).map((m, i) => ({
    titulo: `Terreno à venda, ${m.area.toLocaleString("pt-BR")} m² por R$ ${m.preco.toLocaleString("pt-BR")} - ${bairro}, São Paulo/SP`,
    url: `https://exemplo-portal.invalid/terreno/${encodeURIComponent(bairro.toLowerCase().replace(/\s+/g, "-"))}-${i + 1}`,
    trecho: `[DADO DE DEMONSTRAÇÃO] Terreno em ${m.via}, ${bairro}. Área de ${m.area.toLocaleString("pt-BR")} m², plano, com frente para a via principal. Excelente para incorporação.`,
  }));
}
