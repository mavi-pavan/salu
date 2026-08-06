"use client";

import { useActionState, useState } from "react";

import { ESTADO_INICIAL } from "@/lib/form-state";
import { CRITERIOS_CHAVES, CRITERIO_META, type Pesos } from "@/lib/scoring";
import { PREMISSA_META, type Premissas } from "@/lib/viabilidade";
import { salvarConfiguracao } from "@/server/actions";
import { BotaoEnvio } from "./botao-envio";
import { Aviso, Cartao, CartaoCabecalho, CartaoCorpo } from "./ui";

const ORDEM_PREMISSAS: Array<keyof Premissas> = [
  "precoVendaM2",
  "custoObraM2",
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
  "margemAlvoPct",
];

export function FormConfiguracao({
  pesos,
  premissasFormulario,
}: {
  pesos: Pesos;
  premissasFormulario: Record<string, number>;
}) {
  const [estado, acao] = useActionState(salvarConfiguracao, ESTADO_INICIAL);
  const [valores, setValores] = useState<Pesos>(pesos);

  const soma = CRITERIOS_CHAVES.reduce((total, c) => total + (valores[c] ?? 0), 0);

  return (
    <form action={acao} className="flex flex-col gap-5">
      {estado.mensagem ? <Aviso tom={estado.ok ? "ok" : "erro"}>{estado.mensagem}</Aviso> : null}

      <Cartao>
        <CartaoCabecalho
          titulo="Pesos da pontuação"
          descricao="Quanto cada critério vale no score final. Não precisa somar 100 — o cálculo é uma média ponderada. Salvar repontua todos os terrenos."
          acao={
            <span className="tnum text-sm font-medium text-slate-500">soma {soma}</span>
          }
        />
        <CartaoCorpo>
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
        </CartaoCorpo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho
          titulo="Premissas padrão de viabilidade"
          descricao="Valores usados no estudo expresso de cada terreno. Terrenos com premissas próprias não são afetados."
        />
        <CartaoCorpo>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ORDEM_PREMISSAS.map((chave) => {
              const meta = PREMISSA_META[chave];
              return (
                <div key={chave} className="flex flex-col gap-1.5">
                  <label htmlFor={`prem-${chave}`} className="text-sm font-medium text-slate-700">
                    {meta.rotulo}
                    <span className="ml-1 text-xs font-normal text-slate-400">{meta.sufixo}</span>
                  </label>
                  <input
                    id={`prem-${chave}`}
                    name={chave}
                    type="number"
                    step={meta.passo}
                    min={0}
                    defaultValue={premissasFormulario[chave] ?? 0}
                    className="tnum w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <p className="text-xs text-slate-500">{meta.ajuda}</p>
                </div>
              );
            })}
          </div>
        </CartaoCorpo>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <BotaoEnvio carregando="Salvando e repontuando…">Salvar configuração</BotaoEnvio>
        </div>
      </Cartao>
    </form>
  );
}
