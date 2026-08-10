import "server-only";

import { prisma } from "@/lib/prisma";
import { buscarNaWeb, ehDemo, provedorConfigurado, type ItemWeb } from "@/lib/busca/provedores";
import { dominio, extrairTudo, normalizarZonaTexto } from "@/lib/busca/extrair";
import { classificarPagina, ehTipoQueNaoInteressa } from "@/lib/busca/paginas";
import { ordenarPorPrioridade } from "@/lib/busca/ordenacao";
import { normalizar } from "@/lib/busca/regioes";
import {
  MAX_CONSULTAS,
  montarConsultas,
  portais,
  regioesDescartadas,
  semFiltroDeSites,
  type Variacao,
} from "@/lib/busca/consultas";
import { consultaDeEndereco, geocodificar } from "@/lib/geo/geocodificar";
import { fonteZoneamento, resolverZona, type ResultadoZona } from "@/lib/geo/zoneamento";
import { coeficientes, type ZonaChave } from "@/lib/zeu";
import { calcularViabilidade, type Premissas } from "@/lib/viabilidade";

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
  /** Como perguntar: por bairro, por estação do eixo, por termo de incorporação. */
  variacoes: Variacao[];
}

/**
 * Resultados pedidos por consulta.
 *
 * Vale subir quando faltar anúncio individual: as páginas de listagem do
 * portal são as que o Google põe no topo, e os anúncios de um lote só
 * aparecem mais fundo. Configurável porque provedor cobra por consulta e o
 * custo de pedir mais fundo depende do plano de cada um.
 */
const RESULTADOS_POR_CONSULTA = Math.min(
  Math.max(Number(process.env.BUSCA_RESULTADOS_POR_CONSULTA ?? 20) || 20, 10),
  100,
);
const LIMITE_GEOCODE = Number(process.env.BUSCA_MAX_GEOCODE ?? 25);
const PALAVRAS_RELEVANTES = ["terreno", "lote", "gleba", "área para", "area para"];

/**
 * Consultas simultâneas ao zoneamento.
 *
 * A geocodificação é serializada por obrigação (o Nominatim pede 1 req/s), mas
 * o zoneamento não tem essa restrição — deixar as duas em série somaria uns
 * 15 s a cada busca e encostaria no limite de tempo da função na Vercel. Seis
 * é folgado para o serviço da Prefeitura e corta a espera para quase nada.
 */
const CONCORRENCIA_ZONA = 6;

/** Origem da zona, espelhando o enum OrigemZona do banco. */
type OrigemZonaChave = "GEOSAMPA" | "GEOJSON" | "TEXTO" | "PRESUMIDA" | "DESCONHECIDA";

/** Aplica `tarefa` a todos os itens, mas com no máximo `limite` em voo. */
async function emLotes<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<R>,
): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += limite) {
    saida.push(...(await Promise.all(itens.slice(i, i + limite).map(tarefa))));
  }
  return saida;
}

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

  // Uma busca pode dar errado em mais de um lugar ao mesmo tempo, e guardar só
  // o primeiro problema esconde os outros: foi assim que uma falha de
  // zoneamento ficou invisível atrás de um aviso sobre o filtro de portais.
  //
  // Mas nem tudo aqui é da mesma natureza, e misturar as duas coisas fazia toda
  // busca abrir com uma caixa de alerta — o que treina qualquer pessoa a não
  // ler nenhuma. `problemas` é o que impediu a busca de entregar o que foi
  // pedido; `notas` é o relato de como ela rodou.
  const problemas: string[] = [];
  const notas: string[] = [];

  const cortadas = regioesDescartadas(params);
  if (cortadas.length) {
    problemas.push(
      `Você marcou ${params.regioes.length} regiões e o limite por busca é ${MAX_CONSULTAS}. Ficaram de fora: ${cortadas.join(", ")}. Rode uma segunda busca com elas.`,
    );
  }

  let motivoDaRecusa: string | null = null;
  /**
   * Recusa do filtro de portais é definitiva, não sorte: o plano gratuito do
   * Serper simplesmente não aceita operadores. Insistir a cada região gastaria
   * duas chamadas por consulta — uma que morre com 400 e outra que funciona.
   */
  let operadoresRecusados = false;
  /** O que foi realmente enviado, que nem sempre é o que foi montado. */
  const consultasEfetivas: string[] = [];

  for (const consulta of consultas) {
    const alvo = operadoresRecusados ? semFiltroDeSites(consulta) : consulta;
    consultasEfetivas.push(alvo);

    try {
      brutos.push(...(await buscarNaWeb(alvo, RESULTADOS_POR_CONSULTA)));
    } catch (falha) {
      const motivo = falha instanceof Error ? falha.message : "Falha na busca";

      // O grupo `(site:... OR site:...)` é a parte mais exótica da consulta e a
      // primeira a ser recusada por um provedor. Antes de desistir, tenta sem
      // ele: busca mais aberta ainda é melhor que resultado nenhum.
      const alternativa = semFiltroDeSites(alvo);
      if (alternativa !== alvo) {
        try {
          brutos.push(...(await buscarNaWeb(alternativa, RESULTADOS_POR_CONSULTA)));
          motivoDaRecusa ??= motivo;
          operadoresRecusados = true;
          consultasEfetivas[consultasEfetivas.length - 1] = alternativa;
          continue;
        } catch {
          // segue para o erro original, que é o mais informativo
        }
      }

      // Cota estourada ou chave inválida: para de insistir e conta o que já veio.
      problemas.push(`A busca parou antes de rodar todas as consultas. ${motivo}`);
      break;
    }
  }

  if (motivoDaRecusa) {
    // O motivo cru vai junto de propósito: sem ele, "o provedor recusou" não
    // dá para consertar — o corpo da resposta é que diz qual parâmetro caiu.
    const planoGratuito = /not allowed for free accounts/i.test(motivoDaRecusa);
    notas.push(
      planoGratuito
        ? `O plano gratuito do Serper não aceita operadores de busca, então o filtro de portais foi desligado nesta e nas consultas seguintes. Os resultados podem incluir páginas que não são anúncio — elas vêm marcadas como "fora dos portais" na lista. Para filtrar por portal de verdade: use o Tavily (que restringe domínios sem operador) ou um plano pago do Serper. Resposta do provedor: ${motivoDaRecusa}`
        : `O provedor recusou a consulta com filtro de portais, então a busca rodou sem ele e os resultados podem incluir páginas que não são anúncio. Resposta do provedor: ${motivoDaRecusa}`,
    );
  }

  const vistos = new Set<string>();
  let descartadosListagem = 0;

  const unicos = brutos.filter((item) => {
    if (!pareceAnuncioDeTerreno(item)) return false;

    // Apartamento que cita "terreno do condomínio de 5.000 m²" passava no
    // filtro de palavra-chave e ainda trazia uma área grande junto — parecia
    // um ótimo candidato e não era terreno nenhum.
    if (ehTipoQueNaoInteressa(item.titulo)) return false;

    // Página de busca do portal ("1.234 terrenos à venda") não é candidato:
    // não tem área, preço nem endereço, e o que ela lista muda toda hora.
    if (classificarPagina(item.titulo, item.url) === "listagem") {
      descartadosListagem += 1;
      return false;
    }

    const chave = chaveDeUrl(item.url);
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  // --- Passo 1: filtros baratos e geocodificação (serializada por política do
  // Nominatim, então é o trecho mais lento da busca). ---
  const candidatos: Array<{
    item: ItemWeb;
    dados: ReturnType<typeof extrairTudo>;
    latitude: number | null;
    longitude: number | null;
  }> = [];

  let consultasDeRede = 0;
  let geocodificados = 0;
  let geocodificadosComSucesso = 0;
  let descartadosArea = 0;

  // Primeiro separa quem passa nos filtros baratos, depois ordena. O buscador
  // devolve os mesmos anúncios em ordem diferente a cada execução, e com a
  // ordem dele o orçamento de geocodificação caía em um subconjunto diferente
  // a cada busca — o que fazia os MESMOS filtros devolverem resultados
  // diferentes, sem nada ter mudado no mundo.
  const triados: Array<{ item: ItemWeb; dados: ReturnType<typeof extrairTudo> }> = [];
  for (const item of unicos) {
    const dados = extrairTudo(item.titulo, item.trecho);

    if (!passaArea(dados.areaM2, params)) {
      if (dados.areaM2 == null) descartadosArea += 1;
      continue;
    }
    if (!passaPreco(dados.precoBRL, params)) continue;
    triados.push({ item, dados });
  }

  // Ordem total e determinística — ver src/lib/busca/ordenacao.ts para o
  // sintoma que isto resolve.
  const emOrdem = ordenarPorPrioridade(
    triados.map((t) => ({
      ...t,
      areaM2: t.dados.areaM2,
      precoBRL: t.dados.precoBRL,
      chave: chaveDeUrl(t.item.url),
    })),
  );

  for (const { item, dados } of emOrdem) {
    let latitude: number | null = null;
    let longitude: number | null = null;

    const consultaGeo = consultaDeEndereco({
      endereco: dados.endereco,
      numero: dados.numero,
      cep: dados.cep,
      bairro: dados.bairro,
    });
    if (consultaGeo && consultasDeRede < LIMITE_GEOCODE) {
      const { ponto, doCache } = await geocodificar(consultaGeo);
      // Só chamada de rede consome o orçamento: o limite existe por causa do
      // 1,1 s de fila do Nominatim, e leitura de cache não paga esse preço.
      // Contando as duas, repetir uma busca confirmava tão poucas zonas quanto
      // a primeira, mesmo com tudo já em cache.
      if (!doCache) consultasDeRede += 1;
      geocodificados += 1;
      if (ponto) {
        geocodificadosComSucesso += 1;
        latitude = ponto.latitude;
        longitude = ponto.longitude;
      }
    }

    candidatos.push({ item, dados, latitude, longitude });
  }

  // --- Passo 2: zona de cada coordenada, em paralelo. ---
  const zonasResolvidas = await emLotes(candidatos, CONCORRENCIA_ZONA, async (c) =>
    c.latitude != null && c.longitude != null
      ? await resolverZona(c.latitude, c.longitude)
      : null,
  );

  // --- Passo 3: filtro de zona e montagem do resultado. ---
  const aceitos: Array<{
    titulo: string;
    url: string;
    fonte: string;
    trecho: string | null;
    areaM2: number | null;
    precoBRL: number | null;
    endereco: string | null;
    numero: string | null;
    cep: string | null;
    bairro: string | null;
    latitude: number | null;
    longitude: number | null;
    estacaoProxima: string | null;
    distanciaEstacaoM: number | null;
    zonaDetectada: ZonaChave | null;
    origemZona: OrigemZonaChave;
    confianca: number;
    chaveUrl: string;
    novo: boolean;
  }> = [];

  let descartadosZona = 0;
  const zonasReprovadas = new Map<string, number>();
  let falhasZoneamento = 0;
  let motivoZoneamento: string | null = null;

  for (const [indice, c] of candidatos.entries()) {
    const { item, dados } = c;
    const resolvida: ResultadoZona | null = zonasResolvidas[indice] ?? null;

    let zonaDetectada: ZonaChave | null = null;
    let origemZona: OrigemZonaChave = "DESCONHECIDA";

    if (resolvida?.estado === "encontrada") {
      zonaDetectada = resolvida.zona;
      origemZona = resolvida.fonte;
    } else if (resolvida?.estado === "indisponivel") {
      falhasZoneamento += 1;
      motivoZoneamento ??= resolvida.motivo;
    }

    if (!zonaDetectada && dados.zonaTexto) {
      zonaDetectada = normalizarZonaTexto(dados.zonaTexto);
      if (zonaDetectada) origemZona = "TEXTO";
    }
    if (!zonaDetectada && dados.bairro) {
      origemZona = "PRESUMIDA";
    }

    if (!passaZona(zonaDetectada, params)) {
      // Reprovado pela camada oficial é informação, não silêncio: sem esta
      // contagem, uma busca que acha 40 lotes e descarta 38 por não serem ZEU
      // aparece na tela como "nenhum anúncio passou no filtro". E a sigla crua
      // vai junto, porque é ela que diz se o zoneamento acertou.
      if (origemZona === "GEOSAMPA" || origemZona === "GEOJSON") {
        descartadosZona += 1;
        if (resolvida?.estado === "encontrada") {
          const sigla = resolvida.bruto.trim() || "(vazio)";
          zonasReprovadas.set(sigla, (zonasReprovadas.get(sigla) ?? 0) + 1);
        }
      }
      continue;
    }

    aceitos.push({
      titulo: item.titulo.slice(0, 300),
      url: item.url,
      fonte: dominio(item.url),
      trecho: item.trecho?.slice(0, 600) ?? null,
      areaM2: dados.areaM2,
      precoBRL: dados.precoBRL,
      endereco: dados.endereco,
      numero: dados.numero,
      cep: dados.cep,
      bairro: dados.bairro,
      latitude: c.latitude,
      longitude: c.longitude,
      estacaoProxima: dados.estacao,
      distanciaEstacaoM: dados.distanciaEstacaoM,
      zonaDetectada,
      origemZona,
      confianca: calcularConfianca(dados.areaM2, dados.precoBRL, origemZona),
      chaveUrl: chaveDeUrl(item.url),
      novo: true, // ajustado abaixo, contra o histórico
    });
  }

  // Novidade só faz sentido contra o que já foi visto: rodar a mesma busca
  // toda semana e reler os mesmos vinte anúncios é o que faz alguém desistir
  // da rotina. A consulta acontece antes de gravar esta busca, senão os
  // próprios resultados dela se marcariam como repetidos.
  if (aceitos.length) {
    const jaVistos = await prisma.resultadoBusca.findMany({
      where: { chaveUrl: { in: aceitos.map((a) => a.chaveUrl) } },
      select: { chaveUrl: true },
      distinct: ["chaveUrl"],
    });
    const conhecidas = new Set(jaVistos.map((r) => r.chaveUrl));
    for (const aceito of aceitos) {
      aceito.novo = !conhecidas.has(aceito.chaveUrl);
    }
  }

  // Geocodificação silenciosamente quebrada é o pior cenário: tudo vira
  // "a verificar" e ninguém entende por quê. Se nenhuma tentativa deu certo,
  // isso aparece junto do resultado.
  if (geocodificados > 0 && geocodificadosComSucesso === 0) {
    problemas.push(
      "Nenhum endereço pôde ser geocodificado — as zonas não foram confirmadas. Verifique NOMINATIM_USER_AGENT (o Nominatim recusa requisições sem contato identificado).",
    );
  } else if (geocodificadosComSucesso < geocodificados) {
    // Explica a métrica "zona confirmada" baixa sem obrigar ninguém a deduzir:
    // anúncio cujo endereço não é localizável nunca chega ao zoneamento.
    notas.push(
      `Dos ${geocodificados} anúncios com endereço no texto, ${geocodificadosComSucesso} foram localizados no mapa — só esses chegam a ser cruzados com o zoneamento. Os demais ou não trazem endereço específico o bastante, ou o serviço de geocodificação não respondeu.`,
    );
  }

  // O mesmo vale para o zoneamento: se a camada não respondeu, ninguém pode
  // concluir que os lotes não são ZEU — eles ficaram sem conferência.
  if (motivoZoneamento) {
    const zonasConfirmadas = aceitos.filter(
      (a) => a.origemZona === "GEOSAMPA" || a.origemZona === "GEOJSON",
    ).length;
    const texto = `A camada de zoneamento não respondeu em ${falhasZoneamento} consulta(s); essas zonas ficaram "a verificar". Motivo: ${motivoZoneamento}`;
    // Falhar em algumas consultas é contratempo; falhar em todas significa que
    // o filtro de zona não funcionou nesta busca, e isso muda o que a lista
    // quer dizer.
    if (zonasConfirmadas === 0 && descartadosZona === 0) problemas.push(texto);
    else notas.push(texto);
  }

  const erro = problemas.length ? problemas.join(" ") : null;

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
      consultas: consultasEfetivas,
      totalBruto: brutos.length,
      totalAceito: aceitos.length,
      descartadosListagem,
      descartadosArea,
      descartadosZona,
      // Ordenado do mais frequente para o menos: "ZM (3), ZC (2)".
      zonasReprovadas: [...zonasReprovadas.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([sigla, quantas]) => `${sigla} (${quantas})`),
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

function passaZona(zona: ZonaChave | null, params: ParametrosBusca): boolean {
  if (!params.zonas.length) return true;

  if (zona) return params.zonas.includes(zona);
  // Sem zona confirmada, o anúncio só entra se o usuário aceitar candidatos
  // a confirmar — que é o padrão quando não há camada de zoneamento carregada.
  return !params.exigirZonaConfirmada;
}

function calcularConfianca(
  area: number | null,
  preco: number | null,
  origem: OrigemZonaChave,
): number {
  const pesoZona = {
    GEOSAMPA: 0.35,
    GEOJSON: 0.35,
    TEXTO: 0.2,
    PRESUMIDA: 0.08,
    DESCONHECIDA: 0,
  }[origem];
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
      // Novidade primeiro: é o que interessa em quem repete a busca semana
      // após semana.
      resultados: { orderBy: [{ novo: "desc" }, { confianca: "desc" }, { createdAt: "asc" }] },
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
 * O veredito que interessa a quem prospecta: o preço pedido cabe na conta?
 *
 * Reaproveita a mesma viabilidade da ficha do terreno, com as premissas
 * configuradas — nada de segunda fórmula que diverge da primeira. O que sai é
 * a folga entre o preço máximo que fecha a margem alvo e o que o vendedor
 * pede. Folga positiva é oportunidade; negativa é quanto seria preciso
 * negociar.
 *
 * Sem zona confirmada, não há conta: os coeficientes mudam tudo, e chutar ZEU
 * transformaria um lote de ZM num falso achado.
 */
export type Veredito =
  | { estado: "ok"; folga: number; folgaPct: number; precoMaximo: number; zona: ZonaChave }
  /**
   * Os custos de obra e venda sozinhos já comem o VGV: nenhum preço de terreno,
   * nem de graça, fecha a margem. Isso é notícia sobre as premissas, não sobre
   * o anúncio — e precisa ser dito com essas palavras, porque um traço na
   * coluna seria lido como "faltou dado".
   */
  | { estado: "premissas_inviaveis"; zona: ZonaChave }
  | { estado: "sem_dados" };

export function vereditoDoResultado(
  r: { precoBRL: number | null; areaM2: number | null; zonaDetectada: string | null },
  premissas: Premissas,
): Veredito {
  if (!r.precoBRL || !r.areaM2 || r.areaM2 <= 0 || !r.zonaDetectada) return { estado: "sem_dados" };

  const zona = r.zonaDetectada as ZonaChave;
  const conta = calcularViabilidade(
    { zona, areaTerreno: r.areaM2, precoPedido: r.precoBRL },
    premissas,
  );

  if (!Number.isFinite(conta.precoMaximoTerreno) || conta.precoMaximoTerreno <= 0) {
    return { estado: "premissas_inviaveis", zona };
  }
  if (conta.folga == null) return { estado: "sem_dados" };

  return {
    estado: "ok",
    folga: conta.folga,
    folgaPct: (conta.folga / r.precoBRL) * 100,
    precoMaximo: conta.precoMaximoTerreno,
    zona,
  };
}

/**
 * O que o mapa precisa saber de cada anúncio.
 *
 * Vai tudo mastigado do servidor porque o mapa é componente cliente e não
 * alcança nem o Prisma nem as funções de viabilidade — e porque a conta tem
 * que ser a mesma da lista e da ficha, não uma terceira.
 */
export interface PontoResultado {
  id: string;
  titulo: string;
  url: string;
  fonte: string;
  latitude: number;
  longitude: number;
  areaM2: number | null;
  precoBRL: number | null;
  precoPorPotencial: number | null;
  bairro: string | null;
  estacaoProxima: string | null;
  distanciaEstacaoM: number | null;
  zona: string | null;
  origemZona: string;
  novo: boolean;
  veredito: { cabe: boolean; rotulo: string } | null;
}

export function pontosDoMapa(
  resultados: ResultadoDetalhado[],
  premissas: Premissas,
): PontoResultado[] {
  return resultados
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => {
      const v = vereditoDoResultado(r, premissas);
      return {
        id: r.id,
        titulo: r.titulo,
        url: r.url,
        fonte: r.fonte,
        latitude: r.latitude as number,
        longitude: r.longitude as number,
        areaM2: r.areaM2,
        precoBRL: r.precoBRL,
        precoPorPotencial: precoPorPotencialDoResultado(r),
        bairro: r.bairro,
        estacaoProxima: r.estacaoProxima,
        distanciaEstacaoM: r.distanciaEstacaoM,
        zona: r.zonaDetectada,
        origemZona: r.origemZona,
        novo: r.novo,
        veredito:
          v.estado === "ok"
            ? {
                cabe: v.folga >= 0,
                rotulo:
                  v.folga >= 0
                    ? `cabe na conta, folga de ${Math.round(v.folgaPct)}%`
                    : `${Math.abs(Math.round(v.folgaPct))}% acima do teto`,
              }
            : null,
      };
    });
}

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

/**
 * Quando a consulta roda sem o filtro de portais, entra resultado de todo tipo
 * de site. Saber a procedência muda a leitura: anúncio de portal tem área e
 * preço padronizados; página avulsa costuma ser matéria, blog ou listagem.
 */
export function ehPortalConhecido(fonte: string): boolean {
  const alvo = fonte.toLowerCase();
  return portais().some((p) => alvo === p || alvo.endsWith(`.${p}`));
}

export function estadoDaBusca() {
  return {
    provedor: provedorConfigurado(),
    demo: ehDemo(),
    zoneamento: fonteZoneamento(),
    portais: portais(),
  };
}
