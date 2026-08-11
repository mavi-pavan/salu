import type { Metadata } from "next";

import { exigirUsuario } from "@/lib/authz";
import { numero } from "@/lib/format";
import { terrenosComCoordenada } from "@/server/queries";
import { MapaTerrenos } from "@/components/mapa/mapa-terrenos";
import { zoneamentoWms } from "@/lib/geo/geosampa";
import { Aviso, Cartao, TituloPagina } from "@/components/ui";

export const metadata: Metadata = { title: "Mapa" };
export const dynamic = "force-dynamic";

export default async function MapaPage() {
  await exigirUsuario();
  const terrenos = await terrenosComCoordenada();
  const wms = zoneamentoWms();

  return (
    <>
      <TituloPagina
        titulo="Mapa"
        descricao={
          terrenos.length
            ? `${numero(terrenos.length)} terreno(s) com coordenada. O tamanho do círculo indica a área; a cor, a faixa de pontuação. A mancha por baixo é o zoneamento vigente da Prefeitura.`
            : "Nenhum terreno no funil ainda — mas o zoneamento da Prefeitura está desenhado aqui. Arraste e dê zoom para ver onde os eixos passam."
        }
      />

      {/*
        O mapa aparece mesmo sem terreno nenhum. Antes uma tela vazia tomava o
        lugar dele, e com ela sumia a camada de zoneamento — que é útil sozinha:
        dá para percorrer a cidade e ver onde a ZEU passa antes de ter qualquer
        lote cadastrado.
      */}
      {terrenos.length === 0 ? (
        <div className="mb-4">
          <Aviso tom="info" titulo="Nenhum terreno com coordenada">
            Os terrenos do funil aparecem aqui quando têm latitude e longitude — o que acontece
            sozinho nos que vêm da busca com endereço identificado. Para ver os{" "}
            <strong>anúncios</strong> no mapa, abra o resultado de uma busca.
          </Aviso>
        </div>
      ) : null}

      <Cartao className="overflow-hidden">
        <div className="h-[70vh] min-h-[420px] w-full">
          <MapaTerrenos terrenos={terrenos} wms={wms} />
        </div>
        <div className="flex flex-wrap gap-4 border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          {terrenos.length ? (
            <>
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
            </>
          ) : null}
          {wms.ativo ? (
            <span className="text-slate-400">
              Zoneamento: camada {wms.camada} do GeoSampa, ligada e desligada no botão do canto.
            </span>
          ) : null}
        </div>
      </Cartao>
    </>
  );
}
