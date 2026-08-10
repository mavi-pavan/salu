import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { exigirUsuario, podeEditar } from "@/lib/authz";
import { brl, brlCompacto, dataHora, m2, numero, pct } from "@/lib/format";
import { linkGeoSampa } from "@/lib/geo/zoneamento";
import {
  ehPortalConhecido,
  obterBusca,
  pontosDoMapa,
  precoPorPotencialDoResultado,
  vereditoDoResultado,
  type ResultadoDetalhado,
} from "@/server/busca";
import { obterConfiguracao } from "@/server/queries";
import { MapaResultados } from "@/components/mapa/mapa-resultados";
import { zoneamentoWms } from "@/lib/geo/geosampa";
import type { Premissas } from "@/lib/viabilidade";
import { alternarDescarte, excluirBusca, repetirBusca } from "@/server/actions-busca";
import { BotaoEnvio } from "@/components/botao-envio";
import {
  Aviso,
  Botao,
  BotaoLink,
  Cartao,
  CartaoCabecalho,
  CartaoCorpo,
  Etiqueta,
  Metrica,
  TituloPagina,
  Vazio,
} from "@/components/ui";

export const metadata: Metadata = { title: "Resultados da busca" };
export const dynamic = "force-dynamic";
/** Repetir a busca roda daqui, e ela leva o mesmo tempo da busca original. */
export const maxDuration = 60;

const ORIGEM_ZONA: Record<string, { rotulo: string; classe: string; ajuda: string }> = {
  GEOSAMPA: {
    rotulo: "confirmada no GeoSampa",
    classe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    ajuda: "Coordenada cruzada com a camada oficial de zoneamento da Prefeitura, ao vivo.",
  },
  GEOJSON: {
    rotulo: "confirmada",
    classe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    ajuda: "Coordenada cruzada com a camada de zoneamento carregada no servidor.",
  },
  TEXTO: {
    rotulo: "citada no anúncio",
    classe: "bg-sky-50 text-sky-700 ring-sky-200",
    ajuda: "O próprio anúncio menciona a zona. Confirmar no GeoSampa.",
  },
  PRESUMIDA: {
    rotulo: "a verificar",
    classe: "bg-amber-50 text-amber-800 ring-amber-200",
    ajuda: "Bairro de eixo, mas sem confirmação da zona do lote.",
  },
  DESCONHECIDA: {
    rotulo: "sem indício",
    classe: "bg-slate-100 text-slate-500 ring-slate-200",
    ajuda: "Não foi possível deduzir a zona a partir do anúncio.",
  },
};

export default async function ResultadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();
  const [busca, config] = await Promise.all([obterBusca(id), obterConfiguracao()]);
  if (!busca) notFound();
  const premissas = config.premissas;

  const editavel = podeEditar(usuario.papel);
  const ativos = busca.resultados.filter((r) => !r.descartado);
  const descartados = busca.resultados.filter((r) => r.descartado);
  const comArea = ativos.filter((r) => r.areaM2 != null);
  // Quando toda linha com dado suficiente diz "as premissas não fecham", o
  // problema não está nos anúncios: está na conta. Dizer isso uma vez no topo
  // evita que alguém descarte a busca inteira achando que não achou nada.
  const vereditos = ativos.map((r) => vereditoDoResultado(r, premissas));
  const comConta = vereditos.filter((v) => v.estado !== "sem_dados");
  const nenhumFecha =
    comConta.length > 0 && comConta.every((v) => v.estado === "premissas_inviaveis");
  const areaTotal = comArea.reduce((soma, r) => soma + (r.areaM2 ?? 0), 0);
  const pontos = pontosDoMapa(ativos, premissas);
  const semCoordenada = ativos.length - pontos.length;

  return (
    <>
      <TituloPagina
        titulo="Resultados da busca"
        descricao={
          <>
            {dataHora(busca.createdAt)} · {busca.criadoPor.name ?? busca.criadoPor.email} · provedor{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{busca.provedor}</code>
          </>
        }
        acao={
          <div className="flex gap-2">
            <BotaoLink href="/buscar" variante="secundario">
              Nova busca
            </BotaoLink>
            {editavel ? (
              <form action={repetirBusca}>
                <input type="hidden" name="buscaId" value={busca.id} />
                <BotaoEnvio carregando="Procurando…" variante="secundario">
                  Repetir esta busca
                </BotaoEnvio>
              </form>
            ) : null}
            {editavel ? (
              <form action={excluirBusca}>
                <input type="hidden" name="buscaId" value={busca.id} />
                <Botao variante="perigo" type="submit">
                  Apagar busca
                </Botao>
              </form>
            ) : null}
          </div>
        }
      />

      {busca.erro ? (
        <div className="mb-6">
          <Aviso tom="atencao" titulo="Esta busca não rodou por inteiro">
            {busca.erro}
          </Aviso>
        </div>
      ) : null}

      {nenhumFecha ? (
        <div className="mb-6">
          <Aviso tom="atencao" titulo="Nenhum empreendimento fecha com as premissas atuais">
            Com venda a {brl(premissas.precoVendaM2)}/m² e obra a {brl(premissas.custoObraM2)}/m², os
            custos de obra, indiretos, comissão e impostos já passam do VGV — nenhum preço de
            terreno, nem de graça, entrega a margem de {pct(premissas.margemAlvoPct * 100, 0)}. A
            coluna &quot;cabe na conta&quot; não tem o que responder enquanto isso valer.{" "}
            <Link href="/configuracoes" className="font-medium underline">
              Revise as premissas
            </Link>{" "}
            com os números da região que você prospecta.
          </Aviso>
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          rotulo="Candidatos"
          valor={numero(ativos.length)}
          detalhe={
            [
              `${numero(busca.totalBruto)} páginas lidas`,
              busca.descartadosListagem > 0
                ? `${numero(busca.descartadosListagem)} eram lista do portal`
                : null,
              busca.descartadosArea > 0 ? `${numero(busca.descartadosArea)} sem área no texto` : null,
              busca.descartadosZona > 0 ? `${numero(busca.descartadosZona)} fora da zona` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          }
        />
        <Metrica rotulo="Com área identificada" valor={numero(comArea.length)} detalhe={`${m2(areaTotal)} somados`} />
        <Metrica
          rotulo="Novos"
          valor={numero(ativos.filter((r) => r.novo).length)}
          detalhe="não apareceram em busca anterior"
        />
        <Metrica
          rotulo="Zona confirmada"
          valor={numero(
            ativos.filter((r) => r.origemZona === "GEOSAMPA" || r.origemZona === "GEOJSON").length,
          )}
          detalhe="cruzadas com o zoneamento"
        />
        <Metrica
          rotulo="Reprovados pela zona"
          valor={numero(busca.descartadosZona)}
          detalhe={
            busca.zonasReprovadas.length
              ? busca.zonasReprovadas.join(", ")
              : "zona confirmada fora do filtro"
          }
        />
      </div>

      <div className="mb-6">
        <Cartao>
          <CartaoCabecalho titulo="Filtro usado" />
          <div className="flex flex-wrap items-center gap-2 px-5 py-4 text-sm text-slate-600">
            {busca.zonas.length ? (
              busca.zonas.map((z) => (
                <Etiqueta key={z} className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                  {z}
                </Etiqueta>
              ))
            ) : (
              <Etiqueta>todas as zonas</Etiqueta>
            )}
            <span className="text-slate-400">|</span>
            <span>
              Área {busca.areaMin ? `≥ ${m2(busca.areaMin)}` : "livre"}
              {busca.areaMax ? ` e ≤ ${m2(busca.areaMax)}` : ""}
            </span>
            {busca.precoMax ? (
              <>
                <span className="text-slate-400">|</span>
                <span>Até {brlCompacto(busca.precoMax)}</span>
              </>
            ) : null}
            {busca.regioes.length ? (
              <>
                <span className="text-slate-400">|</span>
                <span>{busca.regioes.join(", ")}</span>
              </>
            ) : null}
          </div>
          <details className="border-t border-slate-200 px-5 py-3">
            <summary className="cursor-pointer text-xs text-slate-500">
              Ver as {busca.consultas.length} consultas disparadas
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {busca.consultas.map((c, i) => (
                <li key={i} className="font-mono text-xs break-all text-slate-500">
                  {c}
                </li>
              ))}
            </ul>
          </details>
        </Cartao>
      </div>

      {pontos.length > 0 ? (
        <div className="mb-6">
          <Cartao>
            <CartaoCabecalho
              titulo="No mapa"
              descricao="A mancha colorida por baixo é o zoneamento vigente da Prefeitura — arraste o mapa e ela acompanha. Clique nos círculos para escolher, ou use “Selecionar por área” e arraste sobre um trecho do eixo."
            />
            <CartaoCorpo>
              <MapaResultados
                pontos={pontos}
                semCoordenada={semCoordenada}
                editavel={editavel}
                wms={zoneamentoWms()}
              />
            </CartaoCorpo>
          </Cartao>
        </div>
      ) : null}

      {ativos.length > 0 ? (
        <div className="mb-6">
          <CompiladoPorRegiao resultados={ativos} />
        </div>
      ) : null}

      {ativos.length === 0 ? (
        <Vazio
          titulo="Nenhum anúncio passou no filtro"
          descricao={
            busca.descartadosZona > 0
              ? `${busca.descartadosZona} anúncio(s) foram encontrados e reprovados pelo zoneamento: a coordenada caiu fora das zonas escolhidas. Isso é um resultado, não uma falha — na maior parte da cidade não há eixo. Amplie as regiões ou inclua mais zonas no filtro.`
              : "Tente uma área mínima menor, mais regiões ou mais consultas por busca. Anúncios sem área declarada são descartados quando essa opção está marcada."
          }
          acao={<BotaoLink href="/buscar">Ajustar filtros</BotaoLink>}
        />
      ) : (
        <ListaResultados resultados={ativos} editavel={editavel} premissas={premissas} />
      )}

      {busca.notas.length ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Como esta busca rodou
          </p>
          <ul className="flex flex-col gap-1.5">
            {busca.notas.map((nota, i) => (
              <li key={i} className="text-xs leading-relaxed text-slate-500">
                {nota}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {descartados.length ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-slate-500">
            {descartados.length} descartado(s)
          </summary>
          <div className="mt-3">
            <ListaResultados resultados={descartados} editavel={editavel} premissas={premissas} />
          </div>
        </details>
      ) : null}
    </>
  );
}

/**
 * Compilado por região: qual bairro rendeu mais candidatos e onde está o metro
 * de potencial mais barato. É a leitura que orienta a próxima busca.
 */
function CompiladoPorRegiao({ resultados }: { resultados: ResultadoDetalhado[] }) {
  const porRegiao = new Map<
    string,
    { total: number; areaSoma: number; comArea: number; melhorPotencial: number | null }
  >();

  for (const r of resultados) {
    const chave = r.bairro ?? "Região não identificada";
    const atual =
      porRegiao.get(chave) ?? { total: 0, areaSoma: 0, comArea: 0, melhorPotencial: null };

    atual.total += 1;
    if (r.areaM2) {
      atual.areaSoma += r.areaM2;
      atual.comArea += 1;
    }
    const potencial = precoPorPotencialDoResultado(r);
    if (potencial != null && (atual.melhorPotencial == null || potencial < atual.melhorPotencial)) {
      atual.melhorPotencial = potencial;
    }

    porRegiao.set(chave, atual);
  }

  const linhas = [...porRegiao.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <Cartao className="overflow-hidden">
      <CartaoCabecalho
        titulo="Compilado por região"
        descricao="Onde apareceu mais oferta e onde o metro de potencial está mais barato."
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr className="text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Região</th>
              <th className="px-4 py-2.5 text-right">Candidatos</th>
              <th className="px-4 py-2.5 text-right">Área média</th>
              <th className="px-4 py-2.5 text-right">Melhor R$/m² potencial</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map(([regiao, dados]) => (
              <tr key={regiao}>
                <td className="px-4 py-2.5 font-medium text-slate-800">{regiao}</td>
                <td className="tnum px-4 py-2.5 text-right">{numero(dados.total)}</td>
                <td className="tnum px-4 py-2.5 text-right text-slate-600">
                  {dados.comArea ? m2(dados.areaSoma / dados.comArea) : <span className="text-slate-300">—</span>}
                </td>
                <td className="tnum px-4 py-2.5 text-right font-medium">
                  {dados.melhorPotencial != null ? (
                    brl(dados.melhorPotencial)
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}

function ListaResultados({
  resultados,
  editavel,
  premissas,
}: {
  resultados: ResultadoDetalhado[];
  editavel: boolean;
  premissas: Premissas;
}) {
  return (
    <Cartao className="overflow-hidden">
      <CartaoCabecalho
        titulo="Candidatos"
        descricao={
          <>
            &quot;Cabe na conta&quot; compara o preço pedido com o máximo que fecha a margem alvo,
            pela mesma conta da ficha do terreno — hoje com venda a {brl(premissas.precoVendaM2)}/m²
            e obra a {brl(premissas.custoObraM2)}/m². Esses números mudam muito de bairro para
            bairro:{" "}
            <Link href="/configuracoes" className="font-medium text-emerald-700 hover:underline">
              ajuste em Configurações
            </Link>{" "}
            antes de descartar alguém por causa deles. Sem zona confirmada não há veredito: os
            coeficientes mudam tudo.
          </>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr className="text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Anúncio</th>
              <th className="px-4 py-2.5 text-right">Área</th>
              <th className="px-4 py-2.5 text-right">Preço</th>
              <th className="px-4 py-2.5 text-right">R$/m² terreno</th>
              <th className="px-4 py-2.5 text-right">R$/m² potencial</th>
              <th className="px-4 py-2.5 text-right">Cabe na conta?</th>
              <th className="px-4 py-2.5">Zona</th>
              <th className="px-4 py-2.5 text-right">Confiança</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {resultados.map((r) => {
              const porPotencial = precoPorPotencialDoResultado(r);
              const porM2 = r.precoBRL && r.areaM2 ? r.precoBRL / r.areaM2 : null;
              const veredito = vereditoDoResultado(r, premissas);
              // Estação, bairro e logradouro podem ser o mesmo texto ("Praça
              // da Árvore" é as três coisas). Repetir três vezes na mesma
              // linha só polui.
              const locais = [...new Set([r.bairro, r.endereco].filter(Boolean) as string[])];
              const mostrarEstacao =
                Boolean(r.estacaoProxima) && !locais.includes(r.estacaoProxima ?? "");
              const origem = ORIGEM_ZONA[r.origemZona] ?? ORIGEM_ZONA.DESCONHECIDA;

              return (
                <tr key={r.id} className={r.descartado ? "opacity-50" : undefined}>
                  <td className="max-w-[380px] px-4 py-3">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="line-clamp-2 font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      {r.titulo}
                    </a>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      {r.novo ? (
                        <span
                          className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                          title="Não apareceu em nenhuma busca anterior"
                        >
                          novo
                        </span>
                      ) : null}
                      <span>{r.fonte}</span>
                      {!ehPortalConhecido(r.fonte) ? (
                        <span
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                          title="Não veio de um portal de imóveis conhecido — pode ser matéria, blog ou página de listagem"
                        >
                          fora dos portais
                        </span>
                      ) : null}
                      {locais.map((texto) => (
                        <span key={texto}>· {texto}</span>
                      ))}
                      {mostrarEstacao ? (
                        <span className="text-emerald-700">
                          · {r.estacaoProxima}
                          {r.distanciaEstacaoM ? ` a ${r.distanciaEstacaoM} m` : ""}
                        </span>
                      ) : null}
                    </p>
                  </td>
                  <td className="tnum px-4 py-3 text-right whitespace-nowrap">
                    {r.areaM2 ? m2(r.areaM2) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="tnum px-4 py-3 text-right whitespace-nowrap">
                    {r.precoBRL ? brlCompacto(r.precoBRL) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="tnum px-4 py-3 text-right whitespace-nowrap text-slate-600">
                    {porM2 ? brl(porM2) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="tnum px-4 py-3 text-right whitespace-nowrap font-medium">
                    {porPotencial ? brl(porPotencial) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {veredito.estado === "ok" ? (
                      <span
                        className={
                          veredito.folga >= 0
                            ? "font-semibold text-emerald-700"
                            : "font-medium text-rose-700"
                        }
                        title={`Preço máximo que fecha a margem alvo em ${veredito.zona}: ${brl(veredito.precoMaximo)}`}
                      >
                        {veredito.folga >= 0 ? "cabe" : "acima"}
                        <span className="tnum block text-xs font-normal text-slate-500">
                          {veredito.folga >= 0 ? "folga " : "faltam "}
                          {brlCompacto(Math.abs(veredito.folga))}
                        </span>
                      </span>
                    ) : veredito.estado === "premissas_inviaveis" ? (
                      <span
                        className="text-xs font-medium text-amber-700"
                        title="Obra, custos e impostos já passam do VGV: nenhum preço de terreno fecha a margem. O problema está nas premissas, não neste anúncio."
                      >
                        premissas
                        <span className="block font-normal text-slate-500">não fecham</span>
                      </span>
                    ) : (
                      <span
                        className="text-xs text-slate-300"
                        title="Precisa de área, preço e zona confirmada para a conta fazer sentido."
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {r.zonaDetectada ? (
                        <span className="text-sm font-medium text-slate-800">{r.zonaDetectada}</span>
                      ) : null}
                      <Etiqueta className={origem?.classe} >
                        <span title={origem?.ajuda}>{origem?.rotulo}</span>
                      </Etiqueta>
                    </span>
                    {r.latitude && r.longitude ? (
                      <a
                        href={linkGeoSampa(r.latitude, r.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block text-xs text-slate-400 hover:text-emerald-700 hover:underline"
                      >
                        conferir no GeoSampa
                      </a>
                    ) : null}
                  </td>
                  <td className="tnum px-4 py-3 text-right text-slate-500">
                    {pct(r.confianca * 100, 0)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.terrenoId ? (
                      <Link
                        href={`/terrenos/${r.terrenoId}`}
                        className="text-sm font-medium text-emerald-700 hover:underline"
                      >
                        já cadastrado
                      </Link>
                    ) : editavel ? (
                      <div className="flex items-center gap-1">
                        <BotaoLink
                          href={`/terrenos/novo?resultado=${r.id}`}
                          variante="secundario"
                          className="px-2 py-1 text-xs"
                        >
                          Cadastrar
                        </BotaoLink>
                        <form action={alternarDescarte}>
                          <input type="hidden" name="resultadoId" value={r.id} />
                          <Botao variante="fantasma" type="submit" className="px-2 py-1 text-xs">
                            {r.descartado ? "Restaurar" : "Descartar"}
                          </Botao>
                        </form>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}
