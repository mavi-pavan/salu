"use client";

import { useActionState, useState } from "react";

import { ESTADO_INICIAL } from "@/lib/form-state";
import { brl } from "@/lib/format";
import { CRITERIOS_CHAVES, CRITERIO_META, type Pesos } from "@/lib/scoring";
import {
  calcularViabilidade,
  premissasDoFormulario,
  PREMISSA_META,
  type Premissas,
} from "@/lib/viabilidade";
import { salvarConfiguracao } from "@/server/actions";
import { BotaoEnvio } from "./botao-envio";
import { Aviso, Cartao, CartaoCabecalho, CartaoCorpo } from "./ui";

/**
 * As três premissas que decidem o resultado.
 *
 * Um aumento de 30% no preço de venda multiplica por quatro o preço máximo que
 * o terreno pode custar. Nenhuma das outras dez chega perto disso — elas
 * ajustam a conta, estas três definem a conta.
 */
const ESSENCIAIS: Array<keyof Premissas> = ["precoVendaM2", "custoObraM2", "margemAlvoPct"];

const AVANCADAS: Array<keyof Premissas> = [
  "areaMediaUnidadeM2",
  "eficienciaPrivativa",
  "fatorAreaTotal",
  "fatorAreaEquivalente",
  "custosIndiretosPctVGV",
  "comissaoMarketingPctVGV",
  "impostosPctVGV",
  "itbiPct",
  "fatorSocial",
  "fatorPlanejamento",
];

/** Lote de referência do preview: 1.000 m² em ZEU, o caso típico de eixo. */
const LOTE_REFERENCIA = 1000;

export function FormConfiguracao({
  pesos,
  premissasFormulario,
}: {
  pesos: Pesos;
  premissasFormulario: Record<string, number>;
}) {
  const [estado, acao] = useActionState(salvarConfiguracao, ESTADO_INICIAL);
  const [valores, setValores] = useState<Pesos>(pesos);
  const [premissas, setPremissas] = useState<Record<string, number>>(premissasFormulario);

  const soma = CRITERIOS_CHAVES.reduce((total, c) => total + (valores[c] ?? 0), 0);

  // O efeito das premissas, calculado enquanto se digita. É a diferença entre
  // preencher números no escuro e ver o que eles fazem com o negócio.
  const conta = calcularViabilidade(
    { zona: "ZEU", areaTerreno: LOTE_REFERENCIA },
    premissasDoFormulario(premissas),
  );
  const teto = conta.precoMaximoPorM2Terreno;

  function campoPremissa(chave: keyof Premissas, destaque = false) {
    const meta = PREMISSA_META[chave];
    return (
      <div key={chave} className="flex flex-col gap-1.5">
        <label
          htmlFor={`prem-${chave}`}
          className={destaque ? "text-sm font-semibold text-slate-800" : "text-sm font-medium text-slate-700"}
        >
          {meta.rotulo}
          <span className="ml-1 text-xs font-normal text-slate-400">{meta.sufixo}</span>
        </label>
        <input
          id={`prem-${chave}`}
          name={chave}
          type="number"
          step={meta.passo}
          min={0}
          value={premissas[chave] ?? 0}
          onChange={(e) =>
            setPremissas((atual) => ({ ...atual, [chave]: Number(e.target.value) }))
          }
          className={`tnum w-full rounded-lg border px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none ${
            destaque ? "border-slate-300 text-base font-medium" : "border-slate-300 text-sm"
          }`}
        />
        <p className="text-xs text-slate-500">{meta.ajuda}</p>
      </div>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-5">
      {estado.mensagem ? <Aviso tom={estado.ok ? "ok" : "erro"}>{estado.mensagem}</Aviso> : null}

      <Cartao>
        <CartaoCabecalho
          titulo="Os três números que decidem"
          descricao="É com eles que o app calcula quanto um terreno pode custar para o negócio fechar. O resto tem valor padrão razoável e raramente precisa de ajuste."
        />
        <CartaoCorpo className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {ESSENCIAIS.map((chave) => campoPremissa(chave, true))}
          </div>

          <div
            className={`rounded-lg px-4 py-3 ${
              teto > 0 ? "bg-emerald-50" : "bg-amber-50"
            }`}
          >
            {teto > 0 ? (
              <>
                <p className="text-sm text-slate-700">
                  Com esses números, um terreno de 1.000 m² em ZEU pode custar até{" "}
                  <strong className="tnum text-emerald-800">{brl(teto)}/m²</strong> — ou{" "}
                  <strong className="tnum">{brl(conta.precoMaximoTerreno)}</strong> no total.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Acima disso o negócio não entrega a margem. Compare com o que os terrenos da
                  região realmente pedem: se o teto sair muito abaixo do mercado, é sinal de que o
                  preço de venda está subestimado.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-amber-900">
                  Com esses números, nenhum terreno fecha — nem de graça.
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Obra, custos indiretos, comissão e impostos já somam mais que o VGV. Suba o preço
                  de venda, baixe o custo de obra ou reduza a margem alvo até este aviso sumir.
                </p>
              </>
            )}
          </div>
        </CartaoCorpo>
      </Cartao>

      {/*
        Tudo que segue fica fechado. Os campos continuam no formulário e são
        enviados normalmente — só não ocupam a tela de quem não vai mexer neles.
      */}
      <details className="rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-700">
          Outras premissas da conta
          <span className="ml-2 font-normal text-slate-400">
            eficiência, fatores de área, custos indiretos, outorga — {AVANCADAS.length} campos
          </span>
        </summary>
        <div className="border-t border-slate-200 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AVANCADAS.map((chave) => campoPremissa(chave))}
          </div>
        </div>
      </details>

      <details className="rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-700">
          Pesos da pontuação
          <span className="ml-2 font-normal text-slate-400">
            quanto cada critério vale no score — soma {soma}
          </span>
        </summary>
        <div className="border-t border-slate-200 px-5 py-4">
          <p className="mb-4 text-xs text-slate-500">
            Muda só a nota dos terrenos do funil; não altera quais anúncios a busca encontra. Não
            precisa somar 100 — o cálculo é média ponderada. Salvar repontua todos os terrenos.
          </p>
          <div className="flex flex-col gap-4">
            {CRITERIOS_CHAVES.map((chave) => {
              const meta = CRITERIO_META[chave];
              const valor = valores[chave] ?? 0;
              return (
                <div key={chave} className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[220px] flex-1">
                    <label htmlFor={`peso-${chave}`} className="text-sm font-medium text-slate-800">
                      {meta.rotulo}
                    </label>
                    <p className="text-xs text-slate-500">{meta.descricao}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={valor}
                      onChange={(e) =>
                        setValores((atual) => ({ ...atual, [chave]: Number(e.target.value) }))
                      }
                      className="w-40 accent-emerald-600"
                      aria-label={`Peso de ${meta.rotulo}`}
                    />
                    <input
                      id={`peso-${chave}`}
                      name={chave}
                      type="number"
                      min={0}
                      max={100}
                      value={valor}
                      onChange={(e) =>
                        setValores((atual) => ({ ...atual, [chave]: Number(e.target.value) }))
                      }
                      className="tnum w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </details>

      <div className="flex justify-end">
        <BotaoEnvio carregando="Salvando e repontuando…">Salvar configuração</BotaoEnvio>
      </div>
    </form>
  );
}
