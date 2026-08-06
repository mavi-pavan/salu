import type { Metadata } from "next";
import Link from "next/link";

import { exigirUsuario, podeEditar } from "@/lib/authz";
import {
  CATEGORIA_DD_ROTULO,
  STATUS_CLASSE,
  STATUS_ENCERRADOS,
  STATUS_ORDEM,
  STATUS_ROTULO,
  type CategoriaDD,
} from "@/lib/enums";
import { PARAMETROS_ZONA, type ZonaChave } from "@/lib/zeu";
import { brlCompacto, m2, numero, tempoRelativo } from "@/lib/format";
import { estatisticas } from "@/server/queries";
import {
  BotaoLink,
  Cartao,
  CartaoCabecalho,
  CartaoCorpo,
  Etiqueta,
  EtiquetaScore,
  Metrica,
  TituloPagina,
  Vazio,
} from "@/components/ui";

export const metadata: Metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const usuario = await exigirUsuario();
  const stats = await estatisticas();

  const totalFunil = STATUS_ORDEM.reduce(
    (soma, s) => soma + (stats.contagemPorStatus.get(s) ?? 0),
    0,
  );

  return (
    <>
      <TituloPagina
        titulo={`Olá, ${(usuario.name ?? usuario.email ?? "").split(" ")[0]}`}
        descricao="Situação da prospecção em Zona Eixo."
        acao={
          podeEditar(usuario.papel) ? (
            <div className="flex gap-2">
              <BotaoLink href="/buscar">Buscar terrenos</BotaoLink>
              <BotaoLink href="/terrenos/novo" variante="secundario">
                + Novo terreno
              </BotaoLink>
            </div>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica rotulo="Terrenos ativos" valor={numero(stats.ativos)} detalhe="fora os arquivados" />
        <Metrica
          rotulo="Área somada"
          valor={m2(stats.areaTotal)}
          detalhe="terrenos em análise ou negociação"
        />
        <Metrica
          rotulo="Valor pedido em análise"
          valor={brlCompacto(stats.valorEmAnalise)}
          detalhe="soma dos preços pedidos"
        />
        <Metrica
          rotulo="Pontuação média"
          valor={numero(stats.scoreMedio, 1)}
          detalhe="de 0 a 100"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Cartao>
            <CartaoCabecalho titulo="Funil" descricao={`${numero(totalFunil)} terreno(s) em andamento`} />
            <CartaoCorpo>
              <ul className="flex flex-col gap-2">
                {STATUS_ORDEM.map((status) => {
                  const quantidade = stats.contagemPorStatus.get(status) ?? 0;
                  const largura = totalFunil ? (quantidade / totalFunil) * 100 : 0;
                  return (
                    <li key={status}>
                      <Link
                        href={`/terrenos?status=${status}`}
                        className="flex items-center gap-3 rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-50"
                      >
                        <span className="w-36 shrink-0 text-sm text-slate-600">
                          {STATUS_ROTULO[status]}
                        </span>
                        <span className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                          <span
                            className={`block h-full rounded ${STATUS_CLASSE[status].split(" ")[0]}`}
                            style={{ width: `${Math.max(largura, quantidade ? 3 : 0)}%` }}
                          />
                        </span>
                        <span className="tnum w-8 shrink-0 text-right text-sm font-medium text-slate-900">
                          {quantidade}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {STATUS_ENCERRADOS.map((status) => (
                  <Link key={status} href={`/terrenos?status=${status}`} className="hover:underline">
                    {STATUS_ROTULO[status]}: {stats.contagemPorStatus.get(status) ?? 0}
                  </Link>
                ))}
              </div>
            </CartaoCorpo>
          </Cartao>
        </div>

        <Cartao>
          <CartaoCabecalho titulo="Melhores oportunidades" descricao="Maior pontuação no funil ativo" />
          {stats.topScore.length === 0 ? (
            <CartaoCorpo>
              <p className="text-sm text-slate-500">Nenhum terreno pontuado ainda.</p>
            </CartaoCorpo>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.topScore.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/terrenos/${t.id}`}
                    className="block px-5 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{t.apelido}</p>
                        <p className="text-xs text-slate-500">
                          {t.bairro ?? "—"} · {PARAMETROS_ZONA[t.zona as ZonaChave]?.rotulo} ·{" "}
                          {m2(t.areaTerreno)}
                        </p>
                      </div>
                      <EtiquetaScore total={t.scoreTotal} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Cartao>
          <CartaoCabecalho
            titulo="Problemas na due diligence"
            descricao="Itens marcados como problema, em qualquer terreno"
          />
          {stats.problemas.length === 0 ? (
            <CartaoCorpo>
              <p className="text-sm text-slate-500">Nenhum problema aberto. Bom sinal.</p>
            </CartaoCorpo>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.problemas.map((item) => (
                <li key={item.id} className="px-5 py-3">
                  <Link href={`/terrenos/${item.terreno.id}?aba=dd`} className="group block">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-800 group-hover:text-emerald-700">
                      {item.titulo}
                      {item.critico ? (
                        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-rose-700 uppercase">
                          crítico
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.terreno.codigo} · {item.terreno.apelido} ·{" "}
                      {CATEGORIA_DD_ROTULO[item.categoria as CategoriaDD]}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <CartaoCabecalho titulo="Atividade recente" />
          {stats.atividade.length === 0 ? (
            <CartaoCorpo>
              <Vazio
                titulo="Nada aconteceu ainda"
                descricao="Cadastre um terreno ou rode uma busca para começar."
              />
            </CartaoCorpo>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.atividade.map((evento) => (
                <li key={evento.id} className="flex items-baseline gap-3 px-5 py-2.5 text-sm">
                  <span className="w-24 shrink-0 text-xs text-slate-400">
                    {tempoRelativo(evento.createdAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-600">
                    <span className="font-medium text-slate-800">
                      {evento.usuario?.name ?? evento.usuario?.email ?? "sistema"}
                    </span>{" "}
                    <span className="font-mono text-xs text-slate-500">{evento.acao}</span>
                    {evento.terreno ? (
                      <>
                        {" "}
                        em{" "}
                        <Link
                          href={`/terrenos/${evento.terreno.id}`}
                          className="text-emerald-700 hover:underline"
                        >
                          {evento.terreno.codigo}
                        </Link>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <div className="mt-6">
        <Cartao>
          <CartaoCorpo className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Referência rápida — ZEU</p>
              <p className="text-xs text-slate-500">
                CA básico {PARAMETROS_ZONA.ZEU.caBasico} · CA máximo {PARAMETROS_ZONA.ZEU.caMaximo} ·
                TO {PARAMETROS_ZONA.ZEU.taxaOcupacaoAte500 * 100}% (até 500 m²) /{" "}
                {PARAMETROS_ZONA.ZEU.taxaOcupacaoAcima500 * 100}% (acima) · sem limite de gabarito ·
                cota-parte {PARAMETROS_ZONA.ZEU.cotaParteMaximaM2} m²/unidade
              </p>
            </div>
            <Etiqueta className="bg-slate-100 text-slate-500 ring-slate-200">
              Lei 16.402/2016 · 18.081/2024 · 18.177/2024
            </Etiqueta>
          </CartaoCorpo>
        </Cartao>
      </div>
    </>
  );
}
