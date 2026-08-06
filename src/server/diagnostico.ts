import "server-only";

import { camadaConfigurada, endpointConfigurado, urlConsulta } from "@/lib/geo/geosampa";
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

export interface Diagnostico {
  fonte: ReturnType<typeof fonteZoneamento>;
  endpoint: string;
  camada: string;
  /** A requisição exata do primeiro ponto, para abrir no navegador. */
  exemploUrl: string;
  linhas: LinhaDiagnostico[];
  /** Verde só quando alguma consulta voltou com zona. */
  ok: boolean;
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

  return {
    fonte: fonteZoneamento(),
    endpoint: endpointConfigurado(),
    camada: camadaConfigurada(),
    exemploUrl: urlConsulta(x, y),
    linhas,
    ok: linhas.some((l) => l.resultado.estado === "encontrada"),
  };
}
