"use client";

import { useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import Link from "next/link";

import "leaflet/dist/leaflet.css";

import { STATUS_ROTULO, type StatusPipeline } from "@/lib/enums";
import { faixaScore } from "@/lib/scoring";
import { brlCompacto, m2 } from "@/lib/format";
import type { TerrenoMapa } from "@/server/queries";
import type { CamadaWms } from "@/lib/geo/geosampa";
import { BotaoZoneamento, CamadaZoneamento } from "./camada-zoneamento";

/** Centro aproximado da cidade, usado quando não há terreno com coordenada. */
const CENTRO_SP: [number, number] = [-23.5629, -46.6544];

const CORES: Record<string, string> = {
  excelente: "#059669",
  bom: "#0284c7",
  medio: "#d97706",
  fraco: "#e11d48",
};

export default function MapaLeaflet({
  terrenos,
  wms,
}: {
  terrenos: TerrenoMapa[];
  wms: CamadaWms;
}) {
  const [zoneamento, setZoneamento] = useState(true);
  const primeiro = terrenos[0];
  const centro: [number, number] = primeiro
    ? [primeiro.latitude, primeiro.longitude]
    : CENTRO_SP;

  return (
    <div className="relative h-full w-full">
      {/* Fora do MapContainer e acima dele: o Leaflet reserva o canto para os
          próprios controles. */}
      <div className="absolute top-3 right-3 z-[1000]">
        <BotaoZoneamento
          ligado={zoneamento}
          aoAlternar={() => setZoneamento((v) => !v)}
          indisponivel={!wms.ativo}
        />
      </div>
      <MapContainer
      center={centro}
      zoom={terrenos.length ? 12 : 11}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CamadaZoneamento wms={wms} visivel={zoneamento} />

      {terrenos.map((t) => {
        const faixa = t.scoreTotal != null ? faixaScore(t.scoreTotal).faixa : "fraco";
        const cor = CORES[faixa] ?? "#64748b";
        // Raio proporcional à área dá a leitura de porte sem precisar abrir o popup.
        const raio = Math.max(7, Math.min(20, Math.sqrt(t.areaTerreno) / 4));

        return (
          <CircleMarker
            key={t.id}
            center={[t.latitude, t.longitude]}
            radius={raio}
            pathOptions={{ color: cor, fillColor: cor, fillOpacity: 0.45, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <strong>{t.apelido}</strong>
              <br />
              {m2(t.areaTerreno)} · {t.zona}
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{t.apelido}</p>
                <p style={{ margin: "2px 0", fontSize: 12, color: "#64748b" }}>
                  {t.codigo} · {t.bairro ?? "—"}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                  {m2(t.areaTerreno)} · {t.zona}
                  <br />
                  {t.precoPedido ? brlCompacto(t.precoPedido) : "sem preço"}
                  <br />
                  {STATUS_ROTULO[t.status as StatusPipeline]}
                  {t.scoreTotal != null ? ` · score ${Math.round(t.scoreTotal)}` : ""}
                </p>
                {t.estacaoProxima ? (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                    {t.estacaoProxima}
                  </p>
                ) : null}
                <Link
                  href={`/terrenos/${t.id}`}
                  style={{ display: "inline-block", marginTop: 8, color: "#047857", fontWeight: 500 }}
                >
                  Abrir ficha →
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
      </MapContainer>
    </div>
  );
}
