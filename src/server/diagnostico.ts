import "server-only";

import { camadaConfigurada, endpointConfigurado, urlConsulta } from "@/lib/geo/geosampa";
import { paraUtm23S } from "@/lib/geo/projecao";
import { fonteZoneamento, resolverZona, type ResultadoZona } from "@/lib/geo/zoneamento";
import { zonasNaArea, type CaixaGraus } from "@/server/zonas-mapa";
import { ehZonaEixo } from "@/lib/zeu";

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
 * A camada desenhada no mapa, testada pelo mesmo caminho que o navegador usa.
 *
 * Antes este teste sondava um serviço de imagem (WMS) que nunca respondeu em
 * endereço nenhum. Agora o mapa desenha os polígonos ele mesmo, pelo WFS — o
 * mesmo serviço da coluna acima —, então o que faz sentido perguntar é: pedindo
 * a área de um trecho conhecido, voltam polígonos?
 */
export interface DiagnosticoCamadaMapa {
  ok: boolean;
  detalhe: string;
  /** Trecho consultado, para repetir à mão se precisar. */
  area: string;
  poligonos: number;
  deEixo: number;
}

/** Um retângulo em cima da Avenida Paulista: eixo conhecido, área pequena. */
const AREA_TESTE: CaixaGraus = {
  sul: -23.567,
  oeste: -46.663,
  norte: -23.556,
  leste: -46.648,
};

async function testarCamadaDoMapa(): Promise<DiagnosticoCamadaMapa> {
  const area = `${AREA_TESTE.sul}, ${AREA_TESTE.oeste} até ${AREA_TESTE.norte}, ${AREA_TESTE.leste}`;
  const base = { area, poligonos: 0, deEixo: 0 };

  const resposta = await zonasNaArea(AREA_TESTE);

  if (resposta.estado === "indisponivel") {
    return { ...base, ok: false, detalhe: resposta.motivo };
  }
  if (resposta.estado !== "ok") {
    return { ...base, ok: false, detalhe: `a consulta devolveu “${resposta.estado}”` };
  }

  const deEixo = resposta.zonas.filter((z) => ehZonaEixo(z.zona)).length;
  const vertices = resposta.zonas.reduce(
    (soma, z) => soma + z.aneis.reduce((s, anel) => s + anel.length, 0),
    0,
  );

  if (!resposta.zonas.length) {
    return {
      ...base,
      ok: false,
      detalhe: "o serviço respondeu, mas não veio nenhum polígono nesta área",
    };
  }

  return {
    ok: true,
    area,
    poligonos: resposta.zonas.length,
    deEixo,
    detalhe: `${resposta.zonas.length} polígono(s), ${deEixo} de eixo, ${vertices} vértices${
      resposta.truncado ? " (área com mais zonas do que cabe numa consulta)" : ""
    }`,
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
  /** A camada desenhada no mapa, testada à parte. */
  camadaDoMapa: DiagnosticoCamadaMapa;
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
  const camadaDoMapa = await testarCamadaDoMapa();

  return {
    fonte: fonteZoneamento(),
    endpoint: endpointConfigurado(),
    camada: camadaConfigurada(),
    exemploUrl: urlConsulta(x, y),
    linhas,
    ok: linhas.some((l) => l.resultado.estado === "encontrada"),
    camadaDoMapa,
  };
}
