"use client";

import dynamic from "next/dynamic";

import type { PontoResultado } from "@/server/busca";
import type { CamadaWms } from "@/lib/geo/geosampa";

/**
 * O Leaflet toca em `window` na importação, então precisa ficar fora do SSR.
 * `ssr: false` só é permitido em componente cliente — daí este invólucro.
 */
const MapaLeaflet = dynamic(() => import("./mapa-resultados-leaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
      Carregando mapa…
    </div>
  ),
});

export function MapaResultados({
  pontos,
  semCoordenada,
  editavel,
  wms,
}: {
  pontos: PontoResultado[];
  semCoordenada: number;
  editavel: boolean;
  wms: CamadaWms;
}) {
  return (
    <MapaLeaflet
      pontos={pontos}
      semCoordenada={semCoordenada}
      editavel={editavel}
      wms={wms}
    />
  );
}
