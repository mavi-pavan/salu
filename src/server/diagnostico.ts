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

async function testarWms(): Promise<DiagnosticoWms> {
  const wms = zoneamentoWms();
  const url = new URL(wms.url);
  url.searchParams.set("service", "WMS");
  url.searchParams.set("request", "GetCapabilities");
  url.searchParams.set("version", "1.1.1");

  const base = { url: wms.url, camada: wms.camada };

  let resposta: Response;
  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(20_000) });
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
      detalhe: `HTTP ${resposta.status} — ${texto.replace(/\s+/g, " ").slice(0, 200)}`,
    };
  }

  // O nome vem com o prefixo do workspace; no capabilities ele pode aparecer
  // com ou sem, então basta a parte depois dos dois pontos.
  const semPrefixo = wms.camada.split(":").pop() ?? wms.camada;
  const publicada = texto.includes(semPrefixo);

  return {
    ...base,
    ok: publicada,
    camadaPublicada: publicada,
    detalhe: publicada
      ? `serviço respondeu e publica a camada (${Math.round(texto.length / 1024)} KB de capabilities)`
      : `serviço respondeu, mas não lista a camada ${wms.camada} entre as publicadas`,
  };
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
  const wms = await testarWms();

  return {
    fonte: fonteZoneamento(),
    endpoint: endpointConfigurado(),
    camada: camadaConfigurada(),
    exemploUrl: urlConsulta(x, y),
    linhas,
    ok: linhas.some((l) => l.resultado.estado === "encontrada"),
    wms,
  };
}
