"use client";

import { useActionState, useMemo, useState } from "react";

import { ESTADO_INICIAL } from "@/lib/form-state";
import { brl, brlCompacto, m2, numero, pct } from "@/lib/format";
import {
  calcularViabilidade,
  paraPremissasFormulario,
  PREMISSA_META,
  PREMISSAS_PERCENTUAIS,
  type Premissas,
} from "@/lib/viabilidade";
import type { ZonaChave } from "@/lib/zeu";
import { salvarPremissasTerreno } from "@/server/actions";
import { BotaoEnvio } from "../botao-envio";
import { Aviso, Botao, Cartao, CartaoCabecalho, CartaoCorpo, LinhaInfo, Metrica } from "../ui";

interface Props {
  terrenoId: string;
  zona: ZonaChave;
  areaTerreno: number;
  caBasico: number | null;
  caMaximo: number | null;
  precoPedido: number | null;
  valorVenalM2: number | null;
  premissas: Premissas;
  usandoPremissasProprias: boolean;
  editavel: boolean;
}

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

export function CalculadoraViabilidade(props: Props) {
  const [estado, acao] = useActionState(
    salvarPremissasTerreno.bind(null, props.terrenoId),
    ESTADO_INICIAL,
  );
  // O formulário trabalha com percentuais inteiros (20), o cálculo com frações (0,20).
  const [form, setForm] = useState<Record<string, number>>(() =>
    paraPremissasFormulario(props.premissas),
  );

  const premissas = useMemo<Premissas>(() => {
    const saida = { ...props.premissas } as Record<string, number>;
    for (const chave of Object.keys(form)) {
      const valor = form[chave];
      if (typeof valor !== "number" || Number.isNaN(valor)) continue;
      saida[chave] = PREMISSAS_PERCENTUAIS.includes(chave as keyof Premissas)
        ? valor / 100
        : valor;
    }
    return saida as unknown as Premissas;
  }, [form, props.premissas]);

  const v = useMemo(
    () =>
      calcularViabilidade(
        {
          zona: props.zona,
          areaTerreno: props.areaTerreno,
          caBasico: props.caBasico,
          caMaximo: props.caMaximo,
          precoPedido: props.precoPedido,
          valorVenalM2: props.valorVenalM2,
        },
        premissas,
      ),
    [premissas, props.areaTerreno, props.caBasico, props.caMaximo, props.precoPedido, props.valorVenalM2, props.zona],
  );

  const temPreco = (props.precoPedido ?? 0) > 0;
  const folgaPositiva = (v.folga ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          rotulo="Preço máximo do terreno"
          valor={brlCompacto(v.precoMaximoTerreno)}
          detalhe={`para margem de ${pct(premissas.margemAlvoPct * 100, 0)} · ${brl(v.precoMaximoPorM2Terreno)}/m²`}
          destaque="positivo"
        />
        <Metrica
          rotulo={temPreco ? "Folga sobre o pedido" : "Preço pedido"}
          valor={temPreco ? brlCompacto(v.folga ?? 0) : "—"}
          detalhe={
            temPreco
              ? folgaPositiva
                ? "cabe negociação nesse preço"
                : "acima do que a conta suporta"
              : "informe o preço para comparar"
          }
          destaque={temPreco ? (folgaPositiva ? "positivo" : "negativo") : undefined}
        />
        <Metrica rotulo="VGV estimado" valor={brlCompacto(v.vgv)} detalhe={`${brl(v.vgvPorM2Terreno)}/m² de terreno`} />
        <Metrica
          rotulo="Margem no preço pedido"
          valor={temPreco ? pct(v.margemPct) : "—"}
          detalhe={temPreco ? `resultado de ${brlCompacto(v.resultado)}` : "sem preço informado"}
          destaque={temPreco ? (v.margemPct >= premissas.margemAlvoPct * 100 ? "positivo" : "negativo") : undefined}
        />
      </div>

      {v.outorgaEstimadaPeloPedido ? (
        <Aviso tom="atencao" titulo="Outorga estimada pelo preço pedido">
          O valor venal do m² (Quadro 14 do PDE) não foi informado, então a outorga está sendo
          calculada usando o preço pedido como referência de valor de terreno. Preencha o campo
          “Valor venal do m²” na edição do terreno para uma conta fiel.
        </Aviso>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Cartao>
          <CartaoCabecalho titulo="Potencial construtivo" descricao={`CA ${numero(v.caBasico, 1)} básico / ${numero(v.caMaximo, 1)} máximo (${v.origemCA === "terreno" ? "definido no terreno" : "padrão da zona"})`} />
          <CartaoCorpo>
            <dl className="divide-y divide-slate-100">
              <LinhaInfo rotulo="Área computável máxima" valor={m2(v.areaComputavel)} />
              <LinhaInfo rotulo="Área básica (sem outorga)" valor={m2(v.areaBasica)} />
              <LinhaInfo rotulo="Área adicional (paga outorga)" valor={m2(v.areaAdicional)} />
              <LinhaInfo rotulo="Área total construída" valor={m2(v.areaTotalConstruida)} />
              <LinhaInfo rotulo="Área privativa" valor={m2(v.areaPrivativa)} />
              <LinhaInfo
                rotulo="Unidades estimadas"
                valor={`${numero(v.unidadesEstimadas)} un. de ${numero(premissas.areaMediaUnidadeM2)} m²`}
              />
              {v.unidadesMinimasCotaParte != null ? (
                <LinhaInfo
                  rotulo="Mínimo pela cota-parte"
                  valor={`${numero(v.unidadesMinimasCotaParte)} un.`}
                />
              ) : null}
            </dl>
          </CartaoCorpo>
        </Cartao>

        <Cartao>
          <CartaoCabecalho titulo="Conta do negócio" descricao="No preço pedido atual" />
          <CartaoCorpo>
            <dl className="divide-y divide-slate-100">
              <LinhaInfo rotulo="VGV" valor={brl(v.vgv)} />
              <LinhaInfo rotulo="Custo de obra" valor={`- ${brl(v.custoObra)}`} />
              <LinhaInfo rotulo="Outorga onerosa" valor={`- ${brl(v.outorga)}`} />
              <LinhaInfo rotulo="Custos indiretos" valor={`- ${brl(v.custosIndiretos)}`} />
              <LinhaInfo rotulo="Comissão e marketing" valor={`- ${brl(v.comissaoMarketing)}`} />
              <LinhaInfo rotulo="Impostos sobre venda" valor={`- ${brl(v.impostos)}`} />
              <LinhaInfo rotulo="Terreno" valor={`- ${brl(v.custoTerreno)}`} />
              <LinhaInfo rotulo="ITBI e cartório" valor={`- ${brl(v.itbi)}`} />
              <LinhaInfo
                rotulo="Resultado"
                valor={
                  <span className={v.resultado >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    {brl(v.resultado)} ({pct(v.margemPct)})
                  </span>
                }
                className="border-t-2 border-slate-200 pt-2 font-semibold"
              />
            </dl>
          </CartaoCorpo>
        </Cartao>
      </div>

      <Cartao>
        <CartaoCabecalho
          titulo="Premissas"
          descricao={
            props.usandoPremissasProprias
              ? "Este terreno usa premissas próprias, diferentes do padrão da equipe."
              : "Usando o padrão da equipe. Alterar aqui só afeta este terreno."
          }
        />
        <form action={acao}>
          <CartaoCorpo>
            {estado.mensagem ? (
              <div className="mb-4">
                <Aviso tom={estado.ok ? "ok" : "erro"}>{estado.mensagem}</Aviso>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ORDEM_PREMISSAS.map((chave) => {
                const meta = PREMISSA_META[chave];
                return (
                  <div key={chave} className="flex flex-col gap-1.5">
                    <label htmlFor={chave} className="text-sm font-medium text-slate-700">
                      {meta.rotulo}
                      <span className="ml-1 text-xs font-normal text-slate-400">{meta.sufixo}</span>
                    </label>
                    <input
                      id={chave}
                      name={chave}
                      type="number"
                      step={meta.passo}
                      min={0}
                      value={form[chave] ?? 0}
                      disabled={!props.editavel}
                      onChange={(e) =>
                        setForm((atual) => ({ ...atual, [chave]: Number(e.target.value) }))
                      }
                      className="tnum w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none disabled:bg-slate-50"
                    />
                    <p className="text-xs text-slate-500">{meta.ajuda}</p>
                  </div>
                );
              })}
            </div>
          </CartaoCorpo>

          {props.editavel ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-xs text-slate-500">
                Os números acima recalculam a tela na hora. Salvar guarda essas premissas só neste
                terreno.
              </p>
              <div className="flex gap-2">
                {props.usandoPremissasProprias ? (
                  <Botao type="submit" name="restaurarPadrao" value="1" variante="secundario">
                    Voltar ao padrão
                  </Botao>
                ) : null}
                <BotaoEnvio carregando="Salvando…">Salvar premissas</BotaoEnvio>
              </div>
            </div>
          ) : null}
        </form>
      </Cartao>
    </div>
  );
}
