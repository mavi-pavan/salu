"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { buscarNaInternet } from "@/server/actions-busca";
import { ESTADO_INICIAL } from "@/lib/form-state";
import { PARAMETROS_ZONA } from "@/lib/zeu";
import type { Regiao } from "@/lib/busca/regioes";
import { BotaoEnvio } from "./botao-envio";
import { Aviso, Campo, Cartao, CartaoCabecalho, CartaoCorpo, Entrada, Selecao } from "./ui";

const ZONAS_BUSCAVEIS = ["ZEU", "ZEUa", "ZEUP", "ZEUPa", "ZEM", "ZEMP"] as const;

/** Espelha MAX_CONSULTAS de src/lib/busca/consultas.ts. */
const MAX_REGIOES = 20;

const VARIACOES = [
  {
    chave: "estacao",
    titulo: "Pelas estações do eixo",
    ajuda:
      "A ZEU é uma faixa em torno da estação, não o bairro inteiro — e o anúncio de terreno para incorporação cita a estação porque é o argumento de venda dele. É a consulta que mais acerta o alvo.",
    padrao: true,
  },
  {
    chave: "bairro",
    titulo: "Pelo bairro inteiro",
    ajuda: "Rede mais larga: traz também o que está longe do eixo.",
    padrao: true,
  },
  {
    chave: "incorporacao",
    titulo: "Por termo de incorporação",
    ajuda:
      '"Área para incorporação" — como anuncia quem já sabe o que tem em mãos. Costuma ser lote grande e sem benfeitoria.',
    padrao: false,
  },
] as const;

export function FormBusca({
  regioesPorSetor,
  zoneamentoAtivo,
  zoneamentoRotulo,
}: {
  regioesPorSetor: Array<{ setor: string; regioes: Regiao[] }>;
  zoneamentoAtivo: boolean;
  zoneamentoRotulo: string;
}) {
  const [estado, acao] = useActionState(buscarNaInternet, ESTADO_INICIAL);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [variacoes, setVariacoes] = useState<string[]>(
    VARIACOES.filter((v) => v.padrao).map((v) => v.chave),
  );

  /**
   * Quantas consultas isto vai disparar. Espelha a repartição do servidor: uma
   * consulta por bairro, uma por termo de incorporação e uma por estação, tudo
   * limitado ao teto. Aparece na tela porque cada consulta consome cota.
   */
  const porRegiao = regioesPorSetor.flatMap((g) => g.regioes);
  const consultasPrevistas = Math.min(
    selecionadas.reduce((soma, nome) => {
      const regiao = porRegiao.find((r) => r.nome === nome);
      return (
        soma +
        (variacoes.includes("bairro") ? 1 : 0) +
        (variacoes.includes("incorporacao") ? 1 : 0) +
        (variacoes.includes("estacao") ? (regiao?.estacoes.length ?? 0) : 0)
      );
    }, 0),
    MAX_REGIOES,
  );

  return (
    <form action={acao}>
      <Cartao>
        <CartaoCabecalho
          titulo="Filtros da busca"
          descricao="Escolha as zonas de eixo e a faixa de área. O app procura anúncios de terreno nos portais e devolve só o que cabe no filtro."
        />
        <CartaoCorpo className="flex flex-col gap-6">
          {estado.mensagem && !estado.ok ? <Aviso tom="erro">{estado.mensagem}</Aviso> : null}

          {/* --- Zonas --- */}
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">
                Zonas <span className="text-rose-500">*</span>
              </p>
              <Link href="/zonas" className="text-xs font-medium text-emerald-700 hover:underline">
                O que é cada zona?
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ZONAS_BUSCAVEIS.map((chave) => {
                const p = PARAMETROS_ZONA[chave];
                return (
                  <label
                    key={chave}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50 has-checked:border-emerald-300 has-checked:bg-emerald-50/60"
                  >
                    <input
                      type="checkbox"
                      name="zonas"
                      value={chave}
                      defaultChecked={chave === "ZEU" || chave === "ZEUa"}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">
                        {p.rotulo}
                        <span className="ml-1.5 font-normal text-slate-400">CA {p.caMaximo}</span>
                      </span>
                      <span className="block text-xs text-slate-500">{p.nomeCompleto}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* --- Área e preço --- */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              label="Área mínima (m²)"
              htmlFor="areaMin"
              obrigatorio
              erro={estado.erros?.areaMin}
              ajuda="Abaixo de 600 m² dificilmente fecha uma torre."
            >
              <Entrada
                id="areaMin"
                name="areaMin"
                type="number"
                min={0}
                step={50}
                defaultValue={1000}
                inputMode="decimal"
              />
            </Campo>
            <Campo label="Área máxima (m²)" htmlFor="areaMax" erro={estado.erros?.areaMax}>
              <Entrada id="areaMax" name="areaMax" type="number" min={0} step={50} placeholder="sem limite" />
            </Campo>
            <Campo label="Preço máximo (R$)" htmlFor="precoMax" erro={estado.erros?.precoMax}>
              <Entrada
                id="precoMax"
                name="precoMax"
                type="number"
                min={0}
                step={100000}
                placeholder="sem limite"
              />
            </Campo>
          </div>

          {/* --- Como procurar --- */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Como procurar</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {VARIACOES.map((v) => (
                <label
                  key={v.chave}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50 has-checked:border-emerald-300 has-checked:bg-emerald-50/60"
                >
                  <input
                    type="checkbox"
                    name="variacoes"
                    value={v.chave}
                    checked={variacoes.includes(v.chave)}
                    onChange={(e) =>
                      setVariacoes((atual) =>
                        e.target.checked
                          ? [...atual, v.chave]
                          : atual.filter((c) => c !== v.chave),
                      )
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{v.titulo}</span>
                    <span className="block text-xs text-slate-500">{v.ajuda}</span>
                  </span>
                </label>
              ))}
            </div>
            {!variacoes.length ? (
              <p className="mt-2 text-xs text-amber-700">
                Sem nenhuma marcada, a busca usa o padrão: estações e bairro.
              </p>
            ) : null}
          </div>

          {/* --- Regiões --- */}
          <details className="rounded-lg border border-slate-200" open={selecionadas.length > 0}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
              Regiões
              <span className="ml-2 font-normal text-slate-500">
                {selecionadas.length
                  ? `${selecionadas.length} marcada(s) — ${consultasPrevistas} consulta(s)`
                  : "nenhuma marcada: amostra automática pela cidade"}
              </span>
            </summary>

            <div className="border-t border-slate-200 px-4 py-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Todas as marcadas são pesquisadas. Com as estações ligadas, uma região rende mais
                  de uma consulta — e a cota é repartida em rodadas, de modo que toda região marcada
                  recebe a primeira consulta antes de qualquer uma receber a segunda.
                </p>
                {selecionadas.length ? (
                  <button
                    type="button"
                    onClick={() => setSelecionadas([])}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                  >
                    Limpar tudo
                  </button>
                ) : null}
              </div>

              {selecionadas.length > MAX_REGIOES ? (
                <div className="mb-3">
                  <Aviso tom="atencao">
                    O limite é {MAX_REGIOES} regiões por busca. As {selecionadas.length - MAX_REGIOES}{" "}
                    últimas ficarão de fora — desmarque algumas ou rode uma segunda busca.
                  </Aviso>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {regioesPorSetor.map(({ setor, regioes }) => {
                  const nomes = regioes.map((r) => r.nome);
                  const todosMarcados = nomes.every((n) => selecionadas.includes(n));

                  return (
                    <div key={setor}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {setor}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setSelecionadas((atual) =>
                              todosMarcados
                                ? atual.filter((n) => !nomes.includes(n))
                                : [...new Set([...atual, ...nomes])],
                            )
                          }
                          className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                          {todosMarcados ? "desmarcar" : "marcar todos"}
                        </button>
                      </div>

                      <div className="flex flex-col gap-1">
                        {regioes.map((r) => (
                          <label
                            key={r.nome}
                            className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
                          >
                            <input
                              type="checkbox"
                              name="regioes"
                              value={r.nome}
                              checked={selecionadas.includes(r.nome)}
                              onChange={(e) =>
                                setSelecionadas((atual) =>
                                  e.target.checked
                                    ? [...atual, r.nome]
                                    : atual.filter((n) => n !== r.nome),
                                )
                              }
                              className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span title={`Eixos: ${r.eixos.join(", ")}`}>{r.nome}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </details>

          {/* --- Ajustes finos --- */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Termos extras"
              htmlFor="termosExtras"
              ajuda='Ex.: "esquina", "sem benfeitorias", "espólio".'
            >
              <Entrada id="termosExtras" name="termosExtras" placeholder="opcional" maxLength={160} />
            </Campo>
            <Campo
              label="Consultas na amostra automática"
              htmlFor="maxConsultas"
              ajuda="Só vale quando nenhuma região está marcada. Cada consulta consome uma unidade da cota."
            >
              <Selecao id="maxConsultas" name="maxConsultas" defaultValue="6">
                <option value="3">3 — rápida</option>
                <option value="6">6 — padrão</option>
                <option value="10">10 — ampla</option>
                <option value="15">15 — varredura</option>
              </Selecao>
            </Campo>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                name="exigirArea"
                defaultChecked
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                Descartar anúncios sem área identificada
                <span className="block text-xs text-slate-400">
                  Recomendado: sem a área, não dá para filtrar nem calcular potencial.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                name="exigirZonaConfirmada"
                disabled={!zoneamentoAtivo}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
              />
              <span className={zoneamentoAtivo ? "" : "text-slate-400"}>
                Só aceitar zona confirmada no zoneamento
                <span className="block text-xs text-slate-400">
                  {zoneamentoAtivo
                    ? `Descarta o que não for confirmado pela ${zoneamentoRotulo}. Anúncio sem endereço legível não é geocodificado — e cai fora com esta opção marcada.`
                    : "Indisponível: nenhuma camada de zoneamento configurada (ver README)."}
                </span>
              </span>
            </label>
          </div>
        </CartaoCorpo>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            A busca pode levar alguns segundos: são várias consultas em sequência.
          </p>
          <BotaoEnvio carregando="Procurando…">Buscar terrenos</BotaoEnvio>
        </div>
      </Cartao>
    </form>
  );
}
