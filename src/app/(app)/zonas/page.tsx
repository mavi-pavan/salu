import type { Metadata } from "next";

import { exigirUsuario } from "@/lib/authz";
import { AVISO_LEGAL, PARAMETROS_ZONA, ZONAS_EIXO, type ZonaChave } from "@/lib/zeu";
import { calcularViabilidade, PREMISSAS_PADRAO } from "@/lib/viabilidade";
import { brlCompacto, m2, metros, numero, pct } from "@/lib/format";
import { REGIOES } from "@/lib/busca/regioes";
import {
  Aviso,
  BotaoLink,
  Cartao,
  CartaoCabecalho,
  CartaoCorpo,
  Etiqueta,
  LinhaInfo,
  TituloPagina,
} from "@/components/ui";

export const metadata: Metadata = { title: "Zonas" };

/**
 * Lote de referência para traduzir sigla em número. 1.000 m² é o porte que a
 * equipe mais persegue, e o valor venal é uma ordem de grandeza de eixo — o que
 * importa aqui é comparar as zonas entre si, não acertar o caso concreto.
 */
const LOTE_REFERENCIA = 1000;
const VALOR_VENAL_REFERENCIA = 2500;

const ZONAS_COMPARACAO: ZonaChave[] = [...ZONAS_EIXO, "ZC", "ZM", "ZR"];

function exemplo(zona: ZonaChave) {
  return calcularViabilidade(
    { zona, areaTerreno: LOTE_REFERENCIA, valorVenalM2: VALOR_VENAL_REFERENCIA },
    PREMISSAS_PADRAO,
  );
}

export default async function ZonasPage() {
  await exigirUsuario();

  return (
    <>
      <TituloPagina
        titulo="Zonas de eixo"
        descricao="O que significa cada sigla e quanto ela vale num terreno de verdade."
        acao={<BotaoLink href="/buscar">Buscar terrenos</BotaoLink>}
      />

      <div className="mb-6 flex flex-col gap-3">
        <Aviso tom="info" titulo="O que é um eixo">
          A Lei 16.402/2016 concentra o adensamento da cidade nas faixas ao longo do transporte de
          alta capacidade — metrô, trem e corredores. Dentro dessas faixas, o coeficiente de
          aproveitamento sobe de <strong>1,0</strong> para <strong>4,0</strong> e o limite de altura
          desaparece. É isso que faz um terreno em eixo valer várias vezes o vizinho de esquina:
          num mesmo lote cabe quatro vezes mais metro quadrado vendável.
        </Aviso>
        <Aviso tom="atencao" titulo="Antes de confiar em qualquer número desta página">
          {AVISO_LEGAL}
        </Aviso>
      </div>

      <div className="mb-6 flex flex-col gap-5">
        {ZONAS_EIXO.map((chave) => {
          const p = PARAMETROS_ZONA[chave];
          const v = exemplo(chave);

          return (
            <Cartao key={chave}>
              <CartaoCabecalho
                titulo={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-emerald-700">{p.rotulo}</span>
                    <span className="font-normal text-slate-600">{p.nomeCompleto}</span>
                    {p.vigenciaCondicionada ? (
                      <Etiqueta className="bg-amber-50 text-amber-800 ring-amber-200">
                        depende de obra
                      </Etiqueta>
                    ) : (
                      <Etiqueta className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                        vigente
                      </Etiqueta>
                    )}
                  </span>
                }
                descricao={p.descricao}
              />

              <CartaoCorpo className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Parâmetros
                  </p>
                  <dl className="divide-y divide-slate-100">
                    <LinhaInfo
                      rotulo="Coeficiente de aproveitamento"
                      valor={`${numero(p.caBasico, 1)} básico · ${numero(p.caMaximo, 1)} máximo`}
                    />
                    <LinhaInfo
                      rotulo="Taxa de ocupação"
                      valor={`${pct(p.taxaOcupacaoAte500 * 100, 0)} até 500 m² · ${pct(p.taxaOcupacaoAcima500 * 100, 0)} acima`}
                    />
                    <LinhaInfo
                      rotulo="Gabarito"
                      valor={p.gabaritoMaximoM ? metros(p.gabaritoMaximoM, 0) : "sem limite de altura"}
                    />
                    <LinhaInfo
                      rotulo="Cota-parte por unidade"
                      valor={p.cotaParteMaximaM2 ? `máx. ${p.cotaParteMaximaM2} m²` : "não se aplica"}
                    />
                    <LinhaInfo
                      rotulo="Fruição pública"
                      valor={
                        p.fruicaoPublicaAcimaM2
                          ? `obrigatória acima de ${m2(p.fruicaoPublicaAcimaM2)}`
                          : "não se aplica"
                      }
                    />
                    <LinhaInfo
                      rotulo="Vagas não computáveis"
                      valor={`${p.vagasNaoComputaveisPorUH} por unidade`}
                    />
                  </dl>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Num terreno de {m2(LOTE_REFERENCIA)}
                  </p>
                  <dl className="divide-y divide-slate-100">
                    <LinhaInfo rotulo="Área computável máxima" valor={m2(v.areaComputavel)} />
                    <LinhaInfo rotulo="Área privativa estimada" valor={m2(v.areaPrivativa)} />
                    <LinhaInfo
                      rotulo="Unidades estimadas"
                      valor={`${numero(v.unidadesEstimadas)} de ${numero(PREMISSAS_PADRAO.areaMediaUnidadeM2)} m²`}
                    />
                    {v.unidadesMinimasCotaParte != null ? (
                      <LinhaInfo
                        rotulo="Mínimo pela cota-parte"
                        valor={`${numero(v.unidadesMinimasCotaParte)} unidades`}
                      />
                    ) : null}
                    <LinhaInfo rotulo="VGV estimado" valor={brlCompacto(v.vgv)} />
                    <LinhaInfo rotulo="Outorga onerosa" valor={brlCompacto(v.outorga)} />
                    <LinhaInfo
                      rotulo="Preço máximo do terreno"
                      valor={
                        <span className="font-semibold text-emerald-700">
                          {brlCompacto(v.precoMaximoTerreno)}
                        </span>
                      }
                    />
                    <LinhaInfo
                      rotulo="Equivalente por m² de terreno"
                      valor={`${brlCompacto(v.precoMaximoPorM2Terreno)}/m²`}
                    />
                  </dl>
                  <p className="mt-2 text-xs text-slate-400">
                    Para a margem alvo de {pct(PREMISSAS_PADRAO.margemAlvoPct * 100, 0)}, com as
                    premissas padrão da equipe. Ajuste em Configurações.
                  </p>
                </div>
              </CartaoCorpo>

              {p.observacao ? (
                <div className="border-t border-slate-200 px-5 py-4">
                  <Aviso tom={p.vigenciaCondicionada ? "atencao" : "info"}>{p.observacao}</Aviso>
                </div>
              ) : null}

              <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-700">Onde procurar:</strong>{" "}
                  {chave === "ZEM" || chave === "ZEMP"
                    ? "corredores metropolitanos — trechos de CPTM e rodovias de integração."
                    : REGIOES.slice(0, 8)
                        .map((r) => r.nome)
                        .join(", ") + " e outras faixas ao longo do metrô e da CPTM."}
                </p>
              </div>
            </Cartao>
          );
        })}
      </div>

      <Cartao className="mb-6 overflow-hidden">
        <CartaoCabecalho
          titulo="Comparação"
          descricao={`Mesmo terreno de ${m2(LOTE_REFERENCIA)}, o que muda de zona para zona. As três últimas linhas são zonas fora de eixo, para dar escala.`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr className="text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Zona</th>
                <th className="px-4 py-2.5 text-right">CA máx.</th>
                <th className="px-4 py-2.5 text-right">Área computável</th>
                <th className="px-4 py-2.5 text-right">Unidades</th>
                <th className="px-4 py-2.5 text-right">VGV</th>
                <th className="px-4 py-2.5 text-right">Preço máx. do terreno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ZONAS_COMPARACAO.map((chave) => {
                const p = PARAMETROS_ZONA[chave];
                const v = exemplo(chave);
                const eixo = ZONAS_EIXO.includes(chave);

                return (
                  <tr key={chave} className={eixo ? undefined : "bg-slate-50/60 text-slate-500"}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{p.rotulo}</span>
                      {!eixo ? (
                        <span className="ml-2 text-xs text-slate-400">fora de eixo</span>
                      ) : null}
                    </td>
                    <td className="tnum px-4 py-3 text-right">{numero(p.caMaximo, 1)}</td>
                    <td className="tnum px-4 py-3 text-right">{m2(v.areaComputavel)}</td>
                    <td className="tnum px-4 py-3 text-right">{numero(v.unidadesEstimadas)}</td>
                    <td className="tnum px-4 py-3 text-right">{brlCompacto(v.vgv)}</td>
                    <td className="tnum px-4 py-3 text-right font-medium">
                      {brlCompacto(v.precoMaximoTerreno)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao>
        <CartaoCabecalho
          titulo="Como confirmar a zona de um lote"
          descricao="O mapa erra na borda do perímetro, e a borda é justamente onde estão as barganhas."
        />
        <CartaoCorpo>
          <p className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Na busca, o Salu já cruza a coordenada de cada anúncio com a camada oficial do GeoSampa
            e mostra a zona como <strong>confirmada</strong>. Isso serve para triagem — vale pelo
            endereço do anúncio, que nem sempre é o do lote. Para decidir compra, o roteiro abaixo
            continua sendo o caminho.
          </p>
          <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-slate-700">
            <li>
              Pegue o <strong>número do contribuinte (SQL)</strong> no carnê do IPTU ou na matrícula.
            </li>
            <li>
              Consulte o{" "}
              <a
                href="https://geosampa.prefeitura.sp.gov.br"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-700 hover:underline"
              >
                GeoSampa
              </a>{" "}
              por esse número e veja a camada de zoneamento. Um mesmo lote pode ter duas zonas.
            </li>
            <li>
              Peça a <strong>Certidão de Zoneamento</strong> à SMUL. É o documento que vale, e é o
              que o banco e o cartório vão pedir.
            </li>
            <li>
              Sendo <strong>ZEUP ou ZEUPa</strong>, confirme o cronograma da obra de transporte: até
              ela operar, valem os parâmetros da zona anterior — e o CA 4 é só promessa.
            </li>
          </ol>
        </CartaoCorpo>
      </Cartao>
    </>
  );
}
