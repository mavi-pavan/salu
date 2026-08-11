import "server-only";

import { feicoesNaArea, siglaDaFeature } from "@/lib/geo/geosampa";
import { extrairPoligonos, type Anel, type Poligono } from "@/lib/geo/poligono";
import { paraWgs84 } from "@/lib/geo/projecao";
import { normalizarZona } from "@/lib/geo/zoneamento";
import {
  afinarAnel,
  caberNoOrcamento,
  caixaEmMetros,
  caixaValida,
  grandeDemais,
  tocaACidade,
  toleranciaDaCaixa,
  toleranciaParaCaber,
  MAX_ZONAS,
  type AnelLatLng,
  type CaixaGraus,
  type RespostaZonas,
  type ZonaDesenhavel,
} from "@/lib/geo/zonas-mapa";
import { ehZonaEixo } from "@/lib/zeu";

export type { CaixaGraus };

/** Metro em UTM vira grau, com 6 casas (~11 cm) — o resto é peso sem imagem. */
function paraLatLng(anel: Anel): AnelLatLng {
  return anel.map(([x, y]) => {
    const { latitude, longitude } = paraWgs84(x, y);
    return [Number(latitude.toFixed(6)), Number(longitude.toFixed(6))] as [number, number];
  });
}

/**
 * Os polígonos de zoneamento que cobrem a área visível do mapa.
 *
 * O caminho é o mesmo que confirma a zona de cada anúncio — WFS, em EPSG:31983,
 * consultado por caixa. A diferença é que aqui a resposta é desenhada em vez de
 * testada, então os contornos voltam para grau decimal antes de sair daqui.
 */
export async function zonasNaArea(caixa: CaixaGraus): Promise<RespostaZonas> {
  if (!caixaValida(caixa)) {
    return { estado: "indisponivel", motivo: "área pedida inválida" };
  }
  if (grandeDemais(caixa)) return { estado: "longe" };
  if (!tocaACidade(caixa)) return { estado: "fora_da_cidade" };

  const emMetros = caixaEmMetros(caixa);
  // Pede uma a mais que o teto: se a extra vier, é porque havia mais do que
  // cabe, e a tela precisa dizer isso em vez de mostrar um recorte silencioso.
  const resposta = await feicoesNaArea(emMetros, MAX_ZONAS + 1);
  if (resposta.estado === "indisponivel") return resposta;

  // Separa a leitura do serviço do desenho: os contornos ficam em metros até se
  // saber quanto afinar, e só então viram grau — reprojetar duas vezes o mesmo
  // vértice seria trabalho jogado fora.
  const brutas: Array<{ id: string; sigla: string; poligono: Poligono }> = [];
  for (const [indice, feicao] of resposta.feicoes.entries()) {
    const sigla = siglaDaFeature(feicao.properties);
    if (!sigla) continue;
    for (const [parte, poligono] of extrairPoligonos(feicao.geometry).entries()) {
      brutas.push({ id: `${indice}-${parte}`, sigla, poligono });
    }
  }

  const afinarTudo = (tolerancia: number) =>
    brutas.map((b) => ({ ...b, aneis: b.poligono.map((anel) => afinarAnel(anel, tolerancia)) }));
  const contar = (lista: Array<{ aneis: Anel[] }>) =>
    lista.reduce((soma, z) => soma + z.aneis.reduce((s, anel) => s + anel.length, 0), 0);

  // Duas correções bastam: a contagem cai quase na razão da tolerância, e o
  // desvio que sobra vem dos anéis pequenos demais para afinar, que não cedem
  // por mais que se aumente o corte.
  let tolerancia = toleranciaDaCaixa(emMetros);
  let afinadas = afinarTudo(tolerancia);
  for (let passo = 0; passo < 2; passo++) {
    const ajustada = toleranciaParaCaber(tolerancia, contar(afinadas));
    if (ajustada === tolerancia) break;
    tolerancia = ajustada;
    afinadas = afinarTudo(tolerancia);
  }

  const zonas: ZonaDesenhavel[] = [];
  for (const feicao of afinadas) {
    const aneis = feicao.aneis.map(paraLatLng).filter((anel) => anel.length >= 4);
    if (!aneis.length) continue;
    zonas.push({
      id: feicao.id,
      sigla: feicao.sigla,
      zona: normalizarZona(feicao.sigla),
      aneis,
    });
  }

  const cabendo = caberNoOrcamento(zonas);

  // Eixo por último: o Leaflet desenha na ordem, e o roxo do eixo é o que a
  // pessoa veio ver — ele não pode ficar debaixo do cinza do vizinho.
  cabendo.zonas.sort((a, b) => Number(ehZonaEixo(a.zona)) - Number(ehZonaEixo(b.zona)));

  return {
    estado: "ok",
    zonas: cabendo.zonas,
    truncado: resposta.feicoes.length > MAX_ZONAS || cabendo.cortadas > 0,
  };
}
