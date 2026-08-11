import "server-only";

import {
  camadaConfigurada,
  endpointConfigurado,
  urlConsulta,
  zoneamentoWms,
} from "@/lib/geo/geosampa";
import { paraUtm23S } from "@/lib/geo/projecao";
import { fonteZoneamento, resolverZona, type ResultadoZona } from "@/lib/geo/zoneamento";

/**
 * Teste de conexão com a camada de zoneamento.
 *
 * Existe porque a integração com o GeoSampa depende de um serviço externo que
 * pode mudar de endereço, de nome de camada ou simplesmente sair do ar — e o
 * sintoma disso numa busca comum é sutil: as zonas aparecem como "a verificar"
 * e a lista fica menor. Aqui a pergunta é direta: pedi isto, veio aquilo.
 *
 * Os pontos são fixos e conhecidos. O que importa não é qual zona sai em cada
 * um (isso depende do perímetro vigente, que muda com a lei), e sim se o
 * serviço respondeu com uma zona.
 */
const PONTOS = [
  { nome: "Av. Paulista, altura do MASP", latitude: -23.5614, longitude: -46.6559 },
  { nome: "Rua Vergueiro, perto do Metrô Santa Cruz", latitude: -23.599, longitude: -46.639 },
  { nome: "Praça da Sé", latitude: -23.5505, longitude: -46.6333 },
] as const;

export interface LinhaDiagnostico {
  nome: string;
  latitude: number;
  longitude: number;
  /** Coordenada já projetada, para conferir contra o GeoSampa se preciso. */
  utm: string;
  resultado: ResultadoZona;
}

/**
 * O serviço que desenha a camada no mapa é outro (WMS) e pode estar em outro
 * endereço que o das consultas de zona (WFS). Quando ele falha, o navegador só
 * deixa de mostrar as imagens — sem status, sem corpo, sem pista. Este teste
 * roda do servidor, onde a resposta inteira está disponível.
 */
export interface DiagnosticoWms {
  url: string;
  camada: string;
  ok: boolean;
  detalhe: string;
  /** A camada aparece na lista de camadas publicadas pelo serviço? */
  camadaPublicada: boolean | null;
}

/**
 * Endereços plausíveis do serviço de imagem, testados em paralelo.
 *
 * O host das consultas se chama `wfs.` e pode não atender WMS; o GeoServer
 * também publica um endpoint global além do por workspace. Em vez de eu
 * adivinhar qual é e mandar alguém testar por tentativa e erro, o app pergunta
 * a todos e diz qual respondeu — foi assim que o nome da camada e o 400 do
 * Serper foram resolvidos.
 */
function candidatosWms(configurado: string): string[] {
  const alternativas = [
    configurado,
    configurado.replace("://wfs.", "://wms."),
    configurado.replace(/\/geoserver\/[^/]+\/wms$/, "/geoserver/wms"),
    configurado.replace("://wfs.", "://wms.").replace(/\/geoserver\/[^/]+\/wms$/, "/geoserver/wms"),
    "https://geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wms",
  ];
  return [...new Set(alternativas)];
}

async function testarUmWms(url: string, camada: string): Promise<DiagnosticoWms> {
  const alvo = new URL(url);
  alvo.searchParams.set("service", "WMS");
  alvo.searchParams.set("request", "GetCapabilities");
  alvo.searchParams.set("version", "1.1.1");

  const base = { url, camada };

  let resposta: Response;
  try {
    resposta = await fetch(alvo, { signal: AbortSignal.timeout(15_000) });
  } catch (erro) {
    const causa = erro instanceof Error ? erro.message : String(erro);
    return { ...base, ok: false, camadaPublicada: null, detalhe: `não respondeu: ${causa}` };
  }

  const texto = await resposta.text().catch(() => "");
  if (!resposta.ok) {
    return {
      ...base,
      ok: false,
      camadaPublicada: null,
      detalhe: `HTTP ${resposta.status} — ${texto.replace(/\s+/g, " ").slice(0, 160)}`,
    };
  }

  // O nome vem com o prefixo do workspace; no capabilities ele pode aparecer
  // com ou sem, então basta a parte depois dos dois pontos.
  const semPrefixo = camada.split(":").pop() ?? camada;
  const publicada = texto.includes(semPrefixo);

  return {
    ...base,
    ok: publicada,
    camadaPublicada: publicada,
    detalhe: publicada
      ? `respondeu e publica a camada (${Math.round(texto.length / 1024)} KB de capabilities)`
      : `respondeu, mas não lista a camada entre as publicadas (${Math.round(texto.length / 1024)} KB)`,
  };
}

async function testarWms(): Promise<{ emUso: DiagnosticoWms; candidatos: DiagnosticoWms[] }> {
  const wms = zoneamentoWms();
  const candidatos = await Promise.all(
    candidatosWms(wms.url).map((url) => testarUmWms(url, wms.camada)),
  );
  const emUso = candidatos[0] as DiagnosticoWms;
  return { emUso, candidatos };
}

export interface Diagnostico {
  fonte: ReturnType<typeof fonteZoneamento>;
  endpoint: string;
  camada: string;
  /** A requisição exata do primeiro ponto, para abrir no navegador. */
  exemploUrl: string;
  linhas: LinhaDiagnostico[];
  /** Verde só quando alguma consulta voltou com zona. */
  ok: boolean;
  /** O serviço que desenha a camada no mapa, testado à parte. */
  wms: DiagnosticoWms;
  /** Endereços alternativos sondados, para achar um que funcione. */
  wmsCandidatos: DiagnosticoWms[];
}

export async function diagnosticoZoneamento(): Promise<Diagnostico> {
  const linhas = await Promise.all(
    PONTOS.map(async (ponto) => {
      const { x, y } = paraUtm23S(ponto.latitude, ponto.longitude);
      return {
        nome: ponto.nome,
        latitude: ponto.latitude,
        longitude: ponto.longitude,
        utm: `${x.toFixed(0)} E, ${y.toFixed(0)} N`,
        resultado: await resolverZona(ponto.latitude, ponto.longitude),
      };
    }),
  );

  const primeiro = PONTOS[0];
  const { x, y } = paraUtm23S(primeiro.latitude, primeiro.longitude);
  const { emUso, candidatos } = await testarWms();

  return {
    fonte: fonteZoneamento(),
    endpoint: endpointConfigurado(),
    camada: camadaConfigurada(),
    exemploUrl: urlConsulta(x, y),
    linhas,
    ok: linhas.some((l) => l.resultado.estado === "encontrada"),
    wms: emUso,
    wmsCandidatos: candidatos,
  };
}
