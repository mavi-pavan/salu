import type { Metadata } from "next";
import Link from "next/link";

import { exigirUsuario, podeEditar } from "@/lib/authz";
import { OPCOES_STATUS, type StatusPipeline } from "@/lib/enums";
import { PARAMETROS_ZONA, ZONAS, type ZonaChave } from "@/lib/zeu";
import { brl, brlCompacto, m2, metros, numero } from "@/lib/format";
import { listarTerrenos, type Ordenacao } from "@/server/queries";
import {
  Botao,
  BotaoLink,
  Cartao,
  Entrada,
  EtiquetaScore,
  EtiquetaStatus,
  Selecao,
  TituloPagina,
  Vazio,
} from "@/components/ui";

export const metadata: Metadata = { title: "Terrenos" };
export const dynamic = "force-dynamic";

const ORDENACOES: Array<{ valor: Ordenacao; rotulo: string }> = [
  { valor: "score", rotulo: "Maior pontuação" },
  { valor: "preco_potencial", rotulo: "Menor R$/m² de potencial" },
  { valor: "area", rotulo: "Maior área" },
  { valor: "preco", rotulo: "Menor preço" },
  { valor: "recentes", rotulo: "Atualizados recentemente" },
];

type Params = Promise<{
  q?: string;
  status?: string;
  zona?: string;
  scoreMin?: string;
  areaMin?: string;
  precoMax?: string;
  ordenar?: string;
  arquivados?: string;
}>;

const paraNumero = (v?: string) => {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export default async function TerrenosPage({ searchParams }: { searchParams: Params }) {
  const usuario = await exigirUsuario();
  const filtros = await searchParams;

  const terrenos = await listarTerrenos({
    q: filtros.q,
    status: filtros.status ? [filtros.status as StatusPipeline] : undefined,
    zona: filtros.zona ? [filtros.zona as ZonaChave] : undefined,
    scoreMin: paraNumero(filtros.scoreMin),
    areaMin: paraNumero(filtros.areaMin),
    precoMax: paraNumero(filtros.precoMax),
    arquivados: filtros.arquivados === "1",
    ordenar: (filtros.ordenar as Ordenacao) ?? "score",
  });

  const temFiltro = Boolean(
    filtros.q ||
      filtros.status ||
      filtros.zona ||
      filtros.scoreMin ||
      filtros.areaMin ||
      filtros.precoMax ||
      filtros.arquivados,
  );

  return (
    <>
      <TituloPagina
        titulo="Terrenos"
        descricao={`${numero(terrenos.length)} terreno(s) no funil`}
        acao={
          podeEditar(usuario.papel) ? (
            <div className="flex gap-2">
              <BotaoLink href="/buscar" variante="secundario">
                Buscar na internet
              </BotaoLink>
              <BotaoLink href="/terrenos/novo">+ Novo terreno</BotaoLink>
            </div>
          ) : null
        }
      />

      <Cartao className="mb-5">
        <form method="get" className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-slate-600">
              Buscar
            </label>
            <Entrada
              id="q"
              name="q"
              defaultValue={filtros.q ?? ""}
              placeholder="código, apelido, rua, bairro, SQL…"
            />
          </div>
          <div>
            <label htmlFor="status" className="mb-1.5 block text-xs font-medium text-slate-600">
              Status
            </label>
            <Selecao id="status" name="status" defaultValue={filtros.status ?? ""}>
              <option value="">Todos</option>
              {OPCOES_STATUS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <label htmlFor="zona" className="mb-1.5 block text-xs font-medium text-slate-600">
              Zona
            </label>
            <Selecao id="zona" name="zona" defaultValue={filtros.zona ?? ""}>
              <option value="">Todas</option>
              {ZONAS.map((z) => (
                <option key={z} value={z}>
                  {PARAMETROS_ZONA[z].rotulo}
                </option>
              ))}
            </Selecao>
          </div>
          <div className="w-28">
            <label htmlFor="areaMin" className="mb-1.5 block text-xs font-medium text-slate-600">
              Área mín.
            </label>
            <Entrada
              id="areaMin"
              name="areaMin"
              type="number"
              min={0}
              step={100}
              defaultValue={filtros.areaMin ?? ""}
            />
          </div>
          <div className="w-28">
            <label htmlFor="scoreMin" className="mb-1.5 block text-xs font-medium text-slate-600">
              Score mín.
            </label>
            <Entrada
              id="scoreMin"
              name="scoreMin"
              type="number"
              min={0}
              max={100}
              defaultValue={filtros.scoreMin ?? ""}
            />
          </div>
          <div>
            <label htmlFor="ordenar" className="mb-1.5 block text-xs font-medium text-slate-600">
              Ordenar por
            </label>
            <Selecao id="ordenar" name="ordenar" defaultValue={filtros.ordenar ?? "score"}>
              {ORDENACOES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Selecao>
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-600">
            <input
              type="checkbox"
              name="arquivados"
              value="1"
              defaultChecked={filtros.arquivados === "1"}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Incluir arquivados
          </label>
          <div className="flex gap-2">
            <Botao type="submit" variante="secundario">
              Filtrar
            </Botao>
            {temFiltro ? (
              <Link
                href="/terrenos"
                className="inline-flex items-center rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                Limpar
              </Link>
            ) : null}
          </div>
        </form>
      </Cartao>

      {terrenos.length === 0 ? (
        <Vazio
          titulo={temFiltro ? "Nada encontrado com esse filtro" : "Nenhum terreno cadastrado"}
          descricao={
            temFiltro
              ? "Ajuste os filtros ou limpe a busca."
              : "Comece pela busca automática na internet ou cadastre um terreno manualmente."
          }
          acao={
            podeEditar(usuario.papel) ? (
              <div className="flex gap-2">
                <BotaoLink href="/buscar">Buscar na internet</BotaoLink>
                <BotaoLink href="/terrenos/novo" variante="secundario">
                  Cadastrar manualmente
                </BotaoLink>
              </div>
            ) : null
          }
        />
      ) : (
        <Cartao className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left">
                <tr className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Terreno</th>
                  <th className="px-4 py-2.5">Zona</th>
                  <th className="px-4 py-2.5 text-right">Área</th>
                  <th className="px-4 py-2.5 text-right">Testada</th>
                  <th className="px-4 py-2.5 text-right">Preço</th>
                  <th className="px-4 py-2.5 text-right">R$/m² pot.</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terrenos.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/terrenos/${t.id}`} className="group block">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">{t.codigo}</span>
                          {t.bloqueios > 0 ? (
                            <span
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-700"
                              title={`${t.bloqueios} alerta(s) de bloqueio`}
                            >
                              !
                            </span>
                          ) : null}
                          {t.arquivado ? (
                            <span className="text-xs text-slate-400">arquivado</span>
                          ) : null}
                        </span>
                        <span className="block font-medium text-slate-900 group-hover:text-emerald-700">
                          {t.apelido}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {t.bairro ?? t.logradouro}
                          {t.estacaoProxima ? ` · ${t.estacaoProxima}` : ""}
                          {t.distanciaEstacaoM ? ` (${numero(t.distanciaEstacaoM)} m)` : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {PARAMETROS_ZONA[t.zona as ZonaChave]?.rotulo ?? t.zona}
                    </td>
                    <td className="tnum px-4 py-3 text-right whitespace-nowrap">{m2(t.areaTerreno)}</td>
                    <td className="tnum px-4 py-3 text-right whitespace-nowrap text-slate-600">
                      {t.testada ? metros(t.testada) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="tnum px-4 py-3 text-right whitespace-nowrap">
                      {t.precoPedido ? brlCompacto(t.precoPedido) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="tnum px-4 py-3 text-right whitespace-nowrap font-medium">
                      {t.precoPorPotencial ? brl(t.precoPorPotencial) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <EtiquetaStatus status={t.status as StatusPipeline} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <EtiquetaScore total={t.scoreTotal} cobertura={t.scoreCobertura} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}
    </>
  );
}
