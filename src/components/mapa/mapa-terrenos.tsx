"use client";

import dynamic from "next/dynamic";

import type { TerrenoMapa } from "@/server/queries";

/**
 * O Leaflet toca em `window` na importação, então precisa ficar fora do SSR.
 * `ssr: false` só é permitido em componente cliente — daí este invólucro.
 */
const MapaLeaflet = dynamic(() => import("./mapa-leaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      Carregando mapa…
    </div>
  ),
});

export function MapaTerrenos({ terrenos }: { terrenos: TerrenoMapa[] }) {
  return <MapaLeaflet terrenos={terrenos} />;
}
