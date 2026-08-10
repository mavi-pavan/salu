"use client";

import { useState } from "react";
import { WMSTileLayer } from "react-leaflet";

import type { CamadaWms } from "@/lib/geo/geosampa";

/**
 * Zoneamento oficial desenhado por baixo dos lotes.
 *
 * É o que responde "esse trecho é ZEU?" sem clicar em nada: arrasta o mapa e a
 * mancha da zona acompanha. Quem desenha é o servidor da Prefeitura, que manda
 * só os azulejos da área visível — o navegador não baixa polígono nenhum.
 *
 * A opacidade é baixa de propósito: a camada é pano de fundo para os círculos
 * dos anúncios, não o assunto principal da tela.
 */
export function CamadaZoneamento({ wms, visivel }: { wms: CamadaWms; visivel: boolean }) {
  const [falhou, setFalhou] = useState(false);

  if (!visivel || !wms.ativo || falhou) return null;

  return (
    <WMSTileLayer
      url={wms.url}
      layers={wms.camada}
      format="image/png"
      transparent
      version="1.1.1"
      opacity={0.4}
      zIndex={250}
      attribution='Zoneamento: <a href="https://geosampa.prefeitura.sp.gov.br">GeoSampa</a> / Prefeitura de São Paulo'
      {...(wms.filtro ? { CQL_FILTER: wms.filtro } : {})}
      eventHandlers={{
        // Sem isto, um serviço fora do ar vira um mapa quadriculado de imagens
        // quebradas e ninguém entende o que aconteceu. Melhor sumir e dizer.
        tileerror: () => setFalhou(true),
      }}
    />
  );
}

/**
 * Botão de ligar/desligar a camada, com o aviso de indisponível no mesmo lugar.
 * Separado do componente de tiles porque aquele vive dentro do MapContainer e
 * este mora na barra de controles, fora dele.
 */
export function BotaoZoneamento({
  ligado,
  aoAlternar,
  indisponivel,
}: {
  ligado: boolean;
  aoAlternar: () => void;
  indisponivel: boolean;
}) {
  if (indisponivel) return null;

  return (
    <button
      type="button"
      onClick={aoAlternar}
      title="Desenha o zoneamento vigente da Prefeitura por baixo dos anúncios"
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
        ligado ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      Zoneamento
    </button>
  );
}
