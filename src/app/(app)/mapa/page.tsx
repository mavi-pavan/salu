import type { Metadata } from "next";

import { exigirUsuario } from "@/lib/authz";
import { numero } from "@/lib/format";
import { terrenosComCoordenada } from "@/server/queries";
import { MapaTerrenos } from "@/components/mapa/mapa-terrenos";
import { zoneamentoWms } from "@/lib/geo/geosampa";
import { Cartao, TituloPagina, Vazio } from "@/components/ui";

export const metadata: Metadata = { title: "Mapa" };
export const dynamic = "force-dynamic";

export default async function MapaPage() {
  await exigirUsuario();
  const terrenos = await terrenosComCoordenada();

  return (
    <>
      <TituloPagina
        titulo="Mapa"
        descricao={`${numero(terrenos.length)} terreno(s) com coordenada. O tamanho do círculo indica a área; a cor, a faixa de pontuação. A mancha por baixo é o zoneamento vigente da Prefeitura.`}
      />

      {terrenos.length === 0 ? (
        <Vazio
          titulo="Nenhum terreno com coordenada"
          descricao="Preencha latitude e longitude na ficha do terreno para vê-lo aqui. Terrenos importados da busca já vêm geocodificados quando o endereço é identificado."
        />
      ) : (
        <Cartao className="overflow-hidden">
          <div className="h-[70vh] min-h-[420px] w-full">
            <MapaTerrenos terrenos={terrenos} wms={zoneamentoWms()} />
          </div>
          <div className="flex flex-wrap gap-4 border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> 80+ excelente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-600" /> 65 a 79 bom
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> 45 a 64 médio
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> abaixo de 45
            </span>
          </div>
        </Cartao>
      )}
    </>
  );
}
