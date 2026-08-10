"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleMarker, MapContainer, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

import { brl, brlCompacto, m2 } from "@/lib/format";
import { alternarDescarte } from "@/server/actions-busca";
import { BotaoZoneamento, CamadaZoneamento } from "./camada-zoneamento";
import type { CamadaWms } from "@/lib/geo/geosampa";
import type { PontoResultado } from "@/server/busca";

/** Centro aproximado da cidade, para o caso de não haver ponto nenhum. */
const CENTRO_SP: [number, number] = [-23.5629, -46.6544];

/**
 * A cor responde à pergunta que motiva a busca: este lote está mesmo em zona de
 * eixo? Verde é zona conferida na camada da Prefeitura; azul é zona que só o
 * anúncio afirma; âmbar é a verificar.
 */
const CORES = {
  confirmada: "#059669",
  citada: "#0284c7",
  verificar: "#d97706",
} as const;

function corDoPonto(p: PontoResultado): string {
  if (p.origemZona === "GEOSAMPA" || p.origemZona === "GEOJSON") return CORES.confirmada;
  if (p.origemZona === "TEXTO") return CORES.citada;
  return CORES.verificar;
}

/** Raio pela área: dá a leitura de porte sem precisar clicar. */
function raioDoPonto(p: PontoResultado): number {
  if (!p.areaM2) return 7;
  return Math.max(7, Math.min(22, Math.sqrt(p.areaM2) / 4));
}

/** ~9 m. Menos que a incerteza da geocodificação, e o bastante para separar. */
const AFASTAMENTO_GRAUS = 0.00008;

/**
 * Afasta em alguns metros os pontos que caem na mesma coordenada.
 *
 * O mesmo lote costuma estar anunciado por mais de um corretor, e anúncios sem
 * número acabam todos no centroide do bairro. Empilhados, só o círculo de cima
 * recebe clique — os debaixo somem da tela sem aviso, que é o pior jeito de
 * perder um candidato.
 *
 * O deslocamento é determinístico (posição na roda pelo índice) e menor que a
 * incerteza da própria geocodificação, então não inventa precisão que não
 * existe: ele só torna clicável o que já estava ali.
 */
function afastarCoincidentes(pontos: PontoResultado[]): PontoResultado[] {
  const vistos = new Map<string, number>();

  return pontos.map((p) => {
    const chave = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
    const ordem = vistos.get(chave) ?? 0;
    vistos.set(chave, ordem + 1);
    if (ordem === 0) return p;

    const angulo = (ordem * 2 * Math.PI) / 8;
    const volta = Math.floor(ordem / 8) + 1;
    return {
      ...p,
      latitude: p.latitude + Math.sin(angulo) * AFASTAMENTO_GRAUS * volta,
      longitude: p.longitude + Math.cos(angulo) * AFASTAMENTO_GRAUS * volta,
    };
  });
}

/** Enquadra o mapa em tudo que existe, na primeira renderização. */
function Enquadrar({ pontos }: { pontos: PontoResultado[] }) {
  const map = useMap();
  useMemo(() => {
    if (!pontos.length) return;
    const limites = L.latLngBounds(pontos.map((p) => [p.latitude, p.longitude] as [number, number]));
    map.fitBounds(limites, { padding: [40, 40], maxZoom: 16 });
  }, [map, pontos]);
  return null;
}

interface Caixa {
  inicio: L.LatLng;
  fim: L.LatLng;
}

/**
 * Seleção por área: arrastar sobre o mapa marca todos os lotes dentro da
 * caixa. É o gesto que responde "o que tem naquele trecho do eixo?", que
 * clicar um por um não responde.
 *
 * Enquanto o modo está ligado, o arraste do mapa fica desabilitado — senão o
 * mapa se move junto e não dá para desenhar nada.
 */
function SelecaoPorArea({
  ativo,
  aoSelecionar,
}: {
  ativo: boolean;
  aoSelecionar: (limites: L.LatLngBounds) => void;
}) {
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const map = useMap();

  useMemo(() => {
    if (ativo) map.dragging.disable();
    else map.dragging.enable();
  }, [ativo, map]);

  useMapEvents({
    mousedown(evento) {
      if (!ativo) return;
      setCaixa({ inicio: evento.latlng, fim: evento.latlng });
    },
    mousemove(evento) {
      if (!ativo || !caixa) return;
      setCaixa((atual) => (atual ? { ...atual, fim: evento.latlng } : null));
    },
    mouseup() {
      if (!ativo || !caixa) return;
      aoSelecionar(L.latLngBounds(caixa.inicio, caixa.fim));
      setCaixa(null);
    },
  });

  if (!caixa) return null;
  return (
    <Rectangle
      bounds={L.latLngBounds(caixa.inicio, caixa.fim)}
      pathOptions={{ color: "#0f172a", weight: 1, dashArray: "4 4", fillOpacity: 0.08 }}
    />
  );
}

export default function MapaResultadosLeaflet({
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
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [modoArea, setModoArea] = useState(false);
  // Ligado de saída: a pergunta que traz alguém a esta tela é "isto é ZEU?".
  const [zoneamento, setZoneamento] = useState(true);

  // Maior primeiro: o Leaflet desenha na ordem, então os círculos pequenos
  // ficam por cima e continuam clicáveis dentro dos grandes.
  const noMapa = useMemo(
    () => afastarCoincidentes([...pontos].sort((a, b) => (b.areaM2 ?? 0) - (a.areaM2 ?? 0))),
    [pontos],
  );
  const porId = useMemo(() => new Map(pontos.map((p) => [p.id, p])), [pontos]);
  const escolhidos = selecionados.map((id) => porId.get(id)).filter(Boolean) as PontoResultado[];

  const areaSomada = escolhidos.reduce((soma, p) => soma + (p.areaM2 ?? 0), 0);
  const precoSomado = escolhidos.reduce((soma, p) => soma + (p.precoBRL ?? 0), 0);

  function alternar(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  function selecionarNaCaixa(limites: L.LatLngBounds) {
    const dentro = noMapa
      .filter((p) => limites.contains(L.latLng(p.latitude, p.longitude)))
      .map((p) => p.id);
    // Soma à seleção em vez de substituir: dá para varrer dois trechos de eixo
    // e comparar os dois juntos.
    setSelecionados((atual) => [...new Set([...atual, ...dentro])]);
    setModoArea(false);
  }

  const centro: [number, number] = pontos[0]
    ? [pontos[0].latitude, pontos[0].longitude]
    : CENTRO_SP;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {pontos.length} no mapa
          {semCoordenada > 0 ? (
            <>
              {" · "}
              <span title="Anúncio sem endereço específico o bastante para localizar no mapa. Ele continua na lista abaixo.">
                {semCoordenada} sem coordenada
              </span>
            </>
          ) : null}
          {" · clique para selecionar"}
        </p>
        <div className="flex items-center gap-2">
          <BotaoZoneamento
            ligado={zoneamento}
            aoAlternar={() => setZoneamento((v) => !v)}
            indisponivel={!wms.ativo}
          />
          <button
            type="button"
            onClick={() => setModoArea((v) => !v)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              modoArea
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {modoArea ? "Arraste sobre o mapa…" : "Selecionar por área"}
          </button>
          {selecionados.length ? (
            <button
              type="button"
              onClick={() => setSelecionados([])}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Limpar seleção
            </button>
          ) : null}
        </div>
      </div>

      {/*
        No modo de área, os controles do mapa ficam atravessados: começar o
        arraste em cima do botão de zoom não desenha nada, porque o Leaflet
        bloqueia a propagação dos eventos nos controles. Como o canto superior
        esquerdo é justamente onde a mão vai, eles saem do caminho enquanto
        durar a seleção.
      */}
      <div
        className={`h-[420px] overflow-hidden rounded-xl border border-slate-200 ${
          modoArea
            ? "[&_.leaflet-container]:cursor-crosshair [&_.leaflet-control-container]:pointer-events-none [&_.leaflet-control-container]:opacity-40"
            : ""
        }`}
      >
        <MapContainer
          center={centro}
          zoom={13}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CamadaZoneamento wms={wms} visivel={zoneamento} />
          <Enquadrar pontos={noMapa} />
          <SelecaoPorArea ativo={modoArea} aoSelecionar={selecionarNaCaixa} />

          {noMapa.map((p) => {
            const cor = corDoPonto(p);
            const marcado = selecionados.includes(p.id);
            return (
              <CircleMarker
                key={p.id}
                center={[p.latitude, p.longitude]}
                radius={raioDoPonto(p)}
                pathOptions={{
                  color: marcado ? "#0f172a" : cor,
                  fillColor: cor,
                  fillOpacity: marcado ? 0.85 : 0.4,
                  weight: marcado ? 3 : 2,
                }}
                eventHandlers={{ click: () => alternar(p.id) }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  <strong>{p.areaM2 ? m2(p.areaM2) : "área não informada"}</strong>
                  {p.precoBRL ? ` · ${brlCompacto(p.precoBRL)}` : ""}
                  <br />
                  {p.zona ?? "zona a verificar"}
                  {p.bairro ? ` · ${p.bairro}` : ""}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES.confirmada }} />
          zona confirmada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES.citada }} />
          citada no anúncio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES.verificar }} />
          a verificar
        </span>
        <span className="text-slate-400">tamanho do círculo = área do lote</span>
      </div>

      {escolhidos.length ? (
        <div className="rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-medium text-slate-800">
              {escolhidos.length} selecionado(s)
            </p>
            <p className="tnum text-xs text-slate-500">
              {areaSomada > 0 ? `${m2(areaSomada)} somados` : "área não informada"}
              {precoSomado > 0 ? ` · ${brlCompacto(precoSomado)} somados` : ""}
            </p>
          </div>

          <ul className="divide-y divide-slate-100">
            {escolhidos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                  >
                    {p.titulo}
                  </a>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span>{p.fonte}</span>
                    {p.areaM2 ? <span>· {m2(p.areaM2)}</span> : null}
                    {p.precoBRL ? <span>· {brlCompacto(p.precoBRL)}</span> : null}
                    {p.precoPorPotencial ? (
                      <span>· {brl(p.precoPorPotencial)}/m² de potencial</span>
                    ) : null}
                    {p.zona ? <span>· {p.zona}</span> : null}
                    {p.veredito ? (
                      <span className={p.veredito.cabe ? "text-emerald-700" : "text-rose-700"}>
                        · {p.veredito.rotulo}
                      </span>
                    ) : null}
                  </p>
                </div>

                {editavel ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/terrenos/novo?resultado=${p.id}`}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Mandar para o funil
                    </Link>
                    <form action={alternarDescarte}>
                      <input type="hidden" name="resultadoId" value={p.id} />
                      <button
                        type="submit"
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                      >
                        Descartar
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
