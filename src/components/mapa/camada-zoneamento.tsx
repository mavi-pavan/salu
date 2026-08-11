"use client";

import { useEffect, useRef, useState } from "react";
import { Pane, Polygon, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBounds } from "leaflet";

import { parametrosDaZona } from "@/lib/zeu";
import {
  estiloDaZona,
  ZOOM_MINIMO,
  type RespostaZonas,
  type ZonaDesenhavel,
} from "@/lib/geo/zonas-mapa";

/**
 * Zoneamento oficial desenhado por baixo dos lotes.
 *
 * É o que responde "esse trecho é ZEU?" sem clicar em nada: arrasta o mapa e a
 * mancha da zona acompanha.
 *
 * Quem desenha é o app, não a Prefeitura. A primeira versão pedia a imagem
 * pronta ao serviço de mapas (WMS) e nunca apareceu nada — nenhum dos endereços
 * plausíveis respondeu, e a falha no navegador é muda. Esta versão usa o serviço
 * de dados (WFS), o mesmo que já confirma a zona de cada anúncio e que está
 * comprovadamente de pé: o servidor busca os polígonos da área visível,
 * converte de metros para grau e manda para cá traçar.
 */

export type EstadoZoneamento =
  | { tipo: "desligado" }
  | { tipo: "carregando" }
  | { tipo: "pronto"; quantidade: number; truncado: boolean }
  /** Zoom aberto demais: nesta escala a cidade inteira viraria uma mancha só. */
  | { tipo: "longe" }
  | { tipo: "fora_da_cidade" }
  | { tipo: "falhou"; motivo: string };

/**
 * Margem pedida além da tela, em fração do lado.
 *
 * Arrastar um pouco o mapa não deve piscar a camada inteira: com esta folga, os
 * arrastes curtos caem dentro do que já foi baixado e não geram requisição
 * nova. É pequena porque cada ponto percentual aqui é área pedida a mais, e a
 * conta cresce ao quadrado — 25% de folga vira 56% de área.
 */
const FOLGA = 0.1;

export function CamadaZoneamento({
  visivel,
  aoMudarEstado,
}: {
  visivel: boolean;
  /**
   * Precisa ser estável entre renderizações — o `setState` do componente pai
   * serve. Uma função nova a cada render reiniciaria o efeito em loop.
   */
  aoMudarEstado: (estado: EstadoZoneamento) => void;
}) {
  const map = useMap();
  const [zonas, setZonas] = useState<ZonaDesenhavel[]>([]);
  const [gatilho, setGatilho] = useState(0);
  const baixado = useRef<{ caixa: LatLngBounds; zoom: number } | null>(null);

  useMapEvents({ moveend: () => setGatilho((g) => g + 1) });

  useEffect(() => {
    if (!visivel) return;

    const zoom = map.getZoom();
    const naTela = map.getBounds();

    if (zoom < ZOOM_MINIMO) {
      baixado.current = null;
      setZonas([]);
      aoMudarEstado({ tipo: "longe" });
      return;
    }

    // Já baixado e ainda cobrindo a tela: nada a fazer. O zoom entra na conta
    // porque a simplificação dos contornos é calculada pela escala.
    const anterior = baixado.current;
    if (anterior && anterior.zoom === zoom && anterior.caixa.contains(naTela)) return;

    const pedida = naTela.pad(FOLGA);
    const controle = new AbortController();
    aoMudarEstado({ tipo: "carregando" });

    const busca = new URLSearchParams({
      sul: pedida.getSouth().toFixed(6),
      oeste: pedida.getWest().toFixed(6),
      norte: pedida.getNorth().toFixed(6),
      leste: pedida.getEast().toFixed(6),
    });

    fetch(`/api/zoneamento?${busca}`, { signal: controle.signal })
      .then(async (resposta) => (await resposta.json()) as RespostaZonas)
      .then((resposta) => {
        if (resposta.estado !== "ok") {
          baixado.current = null;
          setZonas([]);
          aoMudarEstado(
            resposta.estado === "indisponivel"
              ? { tipo: "falhou", motivo: resposta.motivo }
              : { tipo: resposta.estado },
          );
          return;
        }
        baixado.current = { caixa: pedida, zoom };
        setZonas(resposta.zonas);
        aoMudarEstado({
          tipo: "pronto",
          quantidade: resposta.zonas.length,
          truncado: resposta.truncado,
        });
      })
      .catch((erro: unknown) => {
        // Abortar é o comportamento normal de quem arrastou de novo antes de a
        // resposta chegar — não é falha e não vira aviso na tela.
        if (erro instanceof DOMException && erro.name === "AbortError") return;
        const causa = erro instanceof Error ? erro.message : String(erro);
        baixado.current = null;
        aoMudarEstado({ tipo: "falhou", motivo: causa });
      });

    return () => controle.abort();
  }, [gatilho, visivel, map, aoMudarEstado]);

  useEffect(() => {
    if (!visivel) aoMudarEstado({ tipo: "desligado" });
  }, [visivel, aoMudarEstado]);

  if (!visivel || !zonas.length) return null;

  return (
    /*
      Painel próprio, entre os azulejos (200) e os marcadores (400). Sem ele, a
      camada recarregada depois de um arraste entraria por cima dos círculos dos
      anúncios e roubaria os cliques.
    */
    <Pane name="zoneamento" style={{ zIndex: 350 }}>
      {zonas.map((z) => {
        const estilo = estiloDaZona(z.zona);
        return (
          <Polygon
            key={z.id}
            positions={z.aneis}
            pathOptions={{
              color: estilo.cor,
              weight: estilo.espessura,
              fillColor: estilo.cor,
              fillOpacity: estilo.opacidadePreenchimento,
            }}
          >
            <Tooltip sticky>
              <strong>{z.sigla}</strong>
              <br />
              {parametrosDaZona(z.zona).nomeCompleto}
            </Tooltip>
          </Polygon>
        );
      })}
    </Pane>
  );
}

/**
 * Botão de ligar/desligar a camada, com o estado no mesmo lugar.
 *
 * Separado do componente dos polígonos porque aquele vive dentro do
 * MapContainer e este mora na barra de controles, fora dele.
 *
 * O botão diz o que está acontecendo em vez de só ligar e desligar: camada que
 * some calada faz quem clicou achar que o botão está quebrado — foi exatamente
 * o que aconteceu com a versão anterior.
 */
export function BotaoZoneamento({
  ligado,
  aoAlternar,
  indisponivel,
  estado,
}: {
  ligado: boolean;
  aoAlternar: () => void;
  indisponivel: boolean;
  estado: EstadoZoneamento;
}) {
  if (indisponivel) return null;

  const aviso =
    ligado && estado.tipo === "longe"
      ? "aproxime para ver"
      : ligado && estado.tipo === "carregando"
        ? "carregando…"
        : ligado && estado.tipo === "fora_da_cidade"
          ? "fora de São Paulo"
          : ligado && estado.tipo === "falhou"
            ? "indisponível"
            : ligado && estado.tipo === "pronto" && estado.truncado
              ? "parcial"
              : null;

  const explicacao =
    estado.tipo === "falhou"
      ? `O GeoSampa não respondeu: ${estado.motivo}. A confirmação de zona de cada anúncio é feita por outro caminho e continua funcionando.`
      : estado.tipo === "longe"
        ? `As zonas aparecem a partir do zoom ${ZOOM_MINIMO}. Mais longe que isso, o zoneamento da cidade inteira vira uma mancha sem leitura.`
        : estado.tipo === "pronto" && estado.truncado
          ? "Há mais zonas nesta área do que cabe numa consulta. Aproxime o mapa para ver todas."
          : "Desenha o zoneamento vigente da Prefeitura por baixo dos anúncios";

  return (
    <button
      type="button"
      onClick={aoAlternar}
      title={explicacao}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
        ligado
          ? aviso
            ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      Zoneamento
      {aviso ? <span className="font-normal"> · {aviso}</span> : null}
    </button>
  );
}
