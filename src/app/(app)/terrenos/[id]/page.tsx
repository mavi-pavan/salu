import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";

import { exigirUsuario, podeEditar } from "@/lib/authz";
import {
  CATEGORIA_DD_ROTULO,
  DOCUMENTAL_ROTULO,
  MOTIVACAO_ROTULO,
  OCUPACAO_ROTULO,
  OPCOES_STATUS,
  ORIGEM_ROTULO,
  STATUS_DD_CLASSE,
  STATUS_DD_ROTULO,
  TIPO_NOTA_ROTULO,
  TOPOGRAFIA_ROTULO,
  type CategoriaDD,
  type StatusItemDD,
  type StatusPipeline,
} from "@/lib/enums";
import { AVISO_LEGAL, alertasUrbanisticos, PARAMETROS_ZONA, type ZonaChave } from "@/lib/zeu";
import { normalizarPremissas } from "@/lib/viabilidade";
import { faixaScore } from "@/lib/scoring";
import { brl, brlCompacto, data, dataHora, enderecoCurto, m2, metros, numero, pct, tempoRelativo } from "@/lib/format";
import { linkGeoSampa } from "@/lib/geo/zoneamento";
import {
  itensFaltantes,
  listarMembros,
  obterConfiguracao,
  obterTerreno,
  progressoDD,
  scoreArmazenado,
  type TerrenoDetalhado,
} from "@/server/queries";
import { alternarArquivo, mudarStatus, removerDocumento, sincronizarChecklist } from "@/server/actions";
import { CalculadoraViabilidade } from "@/components/terreno/calculadora-viabilidade";
import { LinhaItemDD } from "@/components/terreno/item-dd";
import { FormDocumento, FormNota } from "@/components/terreno/formularios";
import {
  Aviso,
  Barra,
  Botao,
  BotaoLink,
  Cartao,
  CartaoCabecalho,
  CartaoCorpo,
  Etiqueta,
  EtiquetaScore,
  EtiquetaStatus,
  LinhaInfo,
  Metrica,
  Vazio,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const ABAS = [
  { chave: "resumo", rotulo: "Resumo" },
  { chave: "viabilidade", rotulo: "Viabilidade" },
  { chave: "pontuacao", rotulo: "Pontuação" },
  { chave: "dd", rotulo: "Due diligence" },
  { chave: "notas", rotulo: "Notas" },
  { chave: "documentos", rotulo: "Documentos" },
  { chave: "historico", rotulo: "Histórico" },
] as const;

type AbaChave = (typeof ABAS)[number]["chave"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const terreno = await obterTerreno(id);
  return { title: terreno ? `${terreno.codigo} · ${terreno.apelido}` : "Terreno" };
}

export default async function TerrenoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const [{ id }, { aba }] = await Promise.all([params, searchParams]);
  const usuario = await exigirUsuario();

  const [terreno, membros, config] = await Promise.all([
    obterTerreno(id),
    listarMembros(),
    obterConfiguracao(),
  ]);
  if (!terreno) notFound();

  const editavel = podeEditar(usuario.papel);
  const abaAtiva: AbaChave = (ABAS.find((a) => a.chave === aba)?.chave ?? "resumo") as AbaChave;
  const score = scoreArmazenado(terreno);
  const progresso = progressoDD(terreno.itensDD);
  const parametros = PARAMETROS_ZONA[terreno.zona as ZonaChave];

  return (
    <>
      {/* ---------------- Cabeçalho ---------------- */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-400">{terreno.codigo}</span>
              <EtiquetaStatus status={terreno.status as StatusPipeline} />
              <EtiquetaScore total={terreno.scoreTotal} cobertura={terreno.scoreCobertura} />
              {terreno.arquivado ? <Etiqueta>arquivado</Etiqueta> : null}
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">
              {terreno.apelido}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {enderecoCurto(terreno)} · {m2(terreno.areaTerreno)} ·{" "}
              {parametros?.rotulo ?? terreno.zona}
              {terreno.sqlContribuinte ? ` · SQL ${terreno.sqlContribuinte}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editavel ? (
              <>
                <form action={mudarStatus} className="flex items-center gap-1.5">
                  <input type="hidden" name="terrenoId" value={terreno.id} />
                  <select
                    name="status"
                    defaultValue={terreno.status}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    aria-label="Mudar status"
                  >
                    {OPCOES_STATUS.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                  <Botao type="submit" variante="secundario">
                    Mudar
                  </Botao>
                </form>
                <BotaoLink href={`/terrenos/${terreno.id}/editar`}>Editar</BotaoLink>
                <form action={alternarArquivo}>
                  <input type="hidden" name="terrenoId" value={terreno.id} />
                  <Botao type="submit" variante="fantasma">
                    {terreno.arquivado ? "Desarquivar" : "Arquivar"}
                  </Botao>
                </form>
              </>
            ) : null}
          </div>
        </div>

        <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200">
          {ABAS.map((a) => (
            <Link
              key={a.chave}
              href={`/terrenos/${terreno.id}?aba=${a.chave}`}
              className={clsx(
                "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                abaAtiva === a.chave
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
              )}
            >
              {a.rotulo}
              {a.chave === "dd" && progresso.total ? (
                <span className="ml-1.5 text-xs text-slate-400">
                  {progresso.concluidos}/{progresso.total}
                </span>
              ) : null}
              {a.chave === "notas" && terreno.notas.length ? (
                <span className="ml-1.5 text-xs text-slate-400">{terreno.notas.length}</span>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>

      {/* ---------------- Conteúdo ---------------- */}
      {abaAtiva === "resumo" ? (
        <AbaResumo terreno={terreno} progresso={progresso} score={score} />
      ) : null}

      {abaAtiva === "viabilidade" ? (
        <CalculadoraViabilidade
          terrenoId={terreno.id}
          zona={terreno.zona as ZonaChave}
          areaTerreno={terreno.areaTerreno}
          caBasico={terreno.caBasico}
          caMaximo={terreno.caMaximo}
          precoPedido={terreno.precoPedido}
          valorVenalM2={terreno.valorVenalM2}
          premissas={terreno.premissas ? normalizarPremissas(terreno.premissas) : config.premissas}
          usandoPremissasProprias={Boolean(terreno.premissas)}
          editavel={editavel}
        />
      ) : null}

      {abaAtiva === "pontuacao" ? <AbaPontuacao score={score} /> : null}

      {abaAtiva === "dd" ? (
        <AbaDueDiligence terreno={terreno} membros={membros} editavel={editavel} progresso={progresso} />
      ) : null}

      {abaAtiva === "notas" ? (
        <Cartao>
          <CartaoCabecalho titulo="Notas, visitas e ligações" />
          {editavel ? (
            <CartaoCorpo className="border-b border-slate-200 bg-slate-50">
              <FormNota terrenoId={terreno.id} />
            </CartaoCorpo>
          ) : null}
          {terreno.notas.length === 0 ? (
            <CartaoCorpo>
              <p className="text-sm text-slate-500">Nada registrado ainda.</p>
            </CartaoCorpo>
          ) : (
            <ul className="divide-y divide-slate-100">
              {terreno.notas.map((nota) => (
                <li key={nota.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Etiqueta className="bg-slate-100 text-slate-600 ring-slate-200">
                      {TIPO_NOTA_ROTULO[nota.tipo]}
                    </Etiqueta>
                    <span>{nota.autor.name ?? nota.autor.email}</span>
                    <span>·</span>
                    <span title={dataHora(nota.createdAt)}>{tempoRelativo(nota.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm whitespace-pre-wrap text-slate-700">{nota.corpo}</p>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      ) : null}

      {abaAtiva === "documentos" ? (
        <Cartao>
          <CartaoCabecalho
            titulo="Documentos"
            descricao="Links para os arquivos — matrícula, certidões, estudo de massa, plantas."
          />
          {editavel ? (
            <CartaoCorpo className="border-b border-slate-200 bg-slate-50">
              <FormDocumento terrenoId={terreno.id} />
            </CartaoCorpo>
          ) : null}
          {terreno.documentos.length === 0 ? (
            <CartaoCorpo>
              <p className="text-sm text-slate-500">Nenhum documento anexado.</p>
            </CartaoCorpo>
          ) : (
            <ul className="divide-y divide-slate-100">
              {terreno.documentos.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm font-medium text-slate-800 hover:text-emerald-700 hover:underline"
                    >
                      {doc.nome}
                    </a>
                    <p className="text-xs text-slate-500">
                      {doc.categoria ? `${CATEGORIA_DD_ROTULO[doc.categoria as CategoriaDD]} · ` : ""}
                      {doc.adicionadoPor.name ?? doc.adicionadoPor.email} · {data(doc.createdAt)}
                    </p>
                  </div>
                  {editavel ? (
                    <form action={removerDocumento}>
                      <input type="hidden" name="documentoId" value={doc.id} />
                      <Botao variante="fantasma" type="submit" className="text-xs">
                        Remover
                      </Botao>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      ) : null}

      {abaAtiva === "historico" ? (
        <Cartao>
          <CartaoCabecalho titulo="Histórico" descricao="Quem mexeu no quê, e quando." />
          {terreno.eventos.length === 0 ? (
            <CartaoCorpo>
              <p className="text-sm text-slate-500">Sem eventos.</p>
            </CartaoCorpo>
          ) : (
            <ul className="divide-y divide-slate-100">
              {terreno.eventos.map((evento) => (
                <li key={evento.id} className="flex items-baseline gap-3 px-5 py-2.5 text-sm">
                  <span className="w-32 shrink-0 text-xs text-slate-400" title={dataHora(evento.createdAt)}>
                    {tempoRelativo(evento.createdAt)}
                  </span>
                  <span className="font-mono text-xs text-slate-500">{evento.acao}</span>
                  <span className="text-slate-600">
                    {evento.usuario?.name ?? evento.usuario?.email ?? "sistema"}
                  </span>
                  {evento.detalhe ? (
                    <span className="truncate text-xs text-slate-400">
                      {JSON.stringify(evento.detalhe)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------

type Progresso = ReturnType<typeof progressoDD>;

function AbaResumo({
  terreno,
  progresso,
  score,
}: {
  terreno: TerrenoDetalhado;
  progresso: Progresso;
  score: ReturnType<typeof scoreArmazenado>;
}) {
  const parametros = PARAMETROS_ZONA[terreno.zona as ZonaChave];
  const alertasZona = alertasUrbanisticos(terreno.zona as ZonaChave, terreno.areaTerreno);
  const bloqueios = score?.alertas.filter((a) => a.nivel === "bloqueio") ?? [];
  const atencoes = score?.alertas.filter((a) => a.nivel === "atencao") ?? [];

  return (
    <div className="flex flex-col gap-5">
      {bloqueios.length ? (
        <Aviso tom="erro" titulo="Bloqueios">
          <ul className="list-inside list-disc">
            {bloqueios.map((a, i) => (
              <li key={i}>{a.texto}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      {atencoes.length ? (
        <Aviso tom="atencao" titulo="Pontos de atenção">
          <ul className="list-inside list-disc">
            {atencoes.map((a, i) => (
              <li key={i}>{a.texto}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica rotulo="Área" valor={m2(terreno.areaTerreno)} detalhe={terreno.testada ? `testada ${metros(terreno.testada)}` : undefined} />
        <Metrica
          rotulo="Preço pedido"
          valor={terreno.precoPedido ? brlCompacto(terreno.precoPedido) : "—"}
          detalhe={
            terreno.precoPedido ? `${brl(terreno.precoPedido / terreno.areaTerreno)}/m² de terreno` : undefined
          }
        />
        <Metrica
          rotulo="R$/m² de potencial"
          valor={score?.precoPorPotencial ? brl(score.precoPorPotencial) : "—"}
          detalhe={`CA máximo ${numero(terreno.caMaximo ?? parametros?.caMaximo ?? 0, 1)}`}
        />
        <Metrica
          rotulo="Due diligence"
          valor={`${progresso.concluidos}/${progresso.total}`}
          detalhe={progresso.problemasCriticos ? `${progresso.problemasCriticos} problema(s) crítico(s)` : `${pct(progresso.percentual, 0)} concluído`}
          destaque={progresso.problemasCriticos ? "negativo" : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Cartao>
          <CartaoCabecalho titulo="Terreno" />
          <CartaoCorpo>
            <dl className="divide-y divide-slate-100">
              <LinhaInfo rotulo="Endereço" valor={enderecoCurto(terreno)} />
              {terreno.distrito ? <LinhaInfo rotulo="Distrito" valor={terreno.distrito} /> : null}
              {terreno.cep ? <LinhaInfo rotulo="CEP" valor={terreno.cep} /> : null}
              <LinhaInfo rotulo="Área" valor={m2(terreno.areaTerreno)} />
              <LinhaInfo rotulo="Testada" valor={terreno.testada ? metros(terreno.testada) : "—"} />
              <LinhaInfo
                rotulo="Profundidade"
                valor={terreno.profundidade ? metros(terreno.profundidade) : "—"}
              />
              <LinhaInfo rotulo="Lotes / matrículas" valor={`${terreno.numeroLotes} / ${terreno.numeroMatriculas}`} />
              <LinhaInfo rotulo="Topografia" valor={TOPOGRAFIA_ROTULO[terreno.topografia]} />
              <LinhaInfo rotulo="Ocupação" valor={OCUPACAO_ROTULO[terreno.ocupacao]} />
              <LinhaInfo rotulo="Documental" valor={DOCUMENTAL_ROTULO[terreno.situacaoDocumental]} />
            </dl>
          </CartaoCorpo>
        </Cartao>

        <Cartao>
          <CartaoCabecalho
            titulo="Zoneamento e transporte"
            acao={
              <a
                href={linkGeoSampa(terreno.latitude, terreno.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                Abrir GeoSampa
              </a>
            }
          />
          <CartaoCorpo>
            <dl className="divide-y divide-slate-100">
              <LinhaInfo rotulo="Zona" valor={`${parametros?.rotulo} — ${parametros?.nomeCompleto}`} />
              <LinhaInfo
                rotulo="CA básico / máximo"
                valor={`${numero(terreno.caBasico ?? parametros?.caBasico ?? 0, 1)} / ${numero(terreno.caMaximo ?? parametros?.caMaximo ?? 0, 1)}`}
              />
              <LinhaInfo
                rotulo="Taxa de ocupação"
                valor={pct(
                  (terreno.areaTerreno <= 500
                    ? (parametros?.taxaOcupacaoAte500 ?? 0)
                    : (parametros?.taxaOcupacaoAcima500 ?? 0)) * 100,
                  0,
                )}
              />
              <LinhaInfo
                rotulo="Gabarito"
                valor={parametros?.gabaritoMaximoM ? metros(parametros.gabaritoMaximoM, 0) : "sem limite"}
              />
              <LinhaInfo rotulo="Estação" valor={terreno.estacaoProxima ?? "—"} />
              <LinhaInfo rotulo="Linha" valor={terreno.linhaTransporte ?? "—"} />
              <LinhaInfo
                rotulo="Distância"
                valor={terreno.distanciaEstacaoM ? `${numero(terreno.distanciaEstacaoM)} m` : "—"}
              />
            </dl>
            {terreno.zonaObservacao ? (
              <p className="mt-3 text-xs text-slate-500">{terreno.zonaObservacao}</p>
            ) : null}
            {alertasZona.length ? (
              <ul className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
                {alertasZona.map((a, i) => (
                  <li key={i} className="text-xs text-slate-500">
                    • {a}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">{AVISO_LEGAL}</p>
          </CartaoCorpo>
        </Cartao>

        <Cartao>
          <CartaoCabecalho titulo="Comercial" />
          <CartaoCorpo>
            <dl className="divide-y divide-slate-100">
              <LinhaInfo rotulo="Preço pedido" valor={terreno.precoPedido ? brl(terreno.precoPedido) : "—"} />
              <LinhaInfo
                rotulo="Valor venal do m²"
                valor={terreno.valorVenalM2 ? brl(terreno.valorVenalM2) : "não informado"}
              />
              <LinhaInfo
                rotulo="Permuta"
                valor={terreno.aceitaPermuta ? `sim${terreno.percentualPermuta ? ` — ${pct(terreno.percentualPermuta)}` : ""}` : "não"}
              />
              <LinhaInfo rotulo="Origem" valor={ORIGEM_ROTULO[terreno.origem]} />
              <LinhaInfo rotulo="Motivação do vendedor" valor={MOTIVACAO_ROTULO[terreno.motivacaoVendedor]} />
              <LinhaInfo rotulo="Contato" valor={terreno.contatoNome ?? "—"} />
              <LinhaInfo rotulo="Telefone" valor={terreno.contatoTelefone ?? "—"} />
              <LinhaInfo rotulo="E-mail" valor={terreno.contatoEmail ?? "—"} />
              <LinhaInfo
                rotulo="Responsável"
                valor={terreno.responsavel?.name ?? terreno.responsavel?.email ?? "—"}
              />
            </dl>
          </CartaoCorpo>
        </Cartao>

        <Cartao>
          <CartaoCabecalho titulo="Observações" />
          <CartaoCorpo>
            {terreno.observacoes ? (
              <p className="text-sm whitespace-pre-wrap text-slate-700">{terreno.observacoes}</p>
            ) : (
              <p className="text-sm text-slate-400">Nada anotado.</p>
            )}
            {terreno.restricoesObservacao ? (
              <>
                <p className="mt-4 text-xs font-semibold text-slate-500 uppercase">Restrições</p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
                  {terreno.restricoesObservacao}
                </p>
              </>
            ) : null}
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
              Criado por {terreno.criadoPor.name ?? terreno.criadoPor.email} em {data(terreno.createdAt)} ·
              atualizado {tempoRelativo(terreno.updatedAt)}
            </p>
          </CartaoCorpo>
        </Cartao>
      </div>
    </div>
  );
}

function AbaPontuacao({ score }: { score: ReturnType<typeof scoreArmazenado> }) {
  if (!score) {
    return <Vazio titulo="Sem pontuação" descricao="Salve o terreno para calcular a pontuação." />;
  }

  const faixa = faixaScore(score.total);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica rotulo="Pontuação" valor={`${numero(score.total, 1)} / 100`} detalhe={faixa.rotulo} />
        <Metrica
          rotulo="Cobertura dos dados"
          valor={pct(score.cobertura, 0)}
          detalhe={score.cobertura < 70 ? "faltam dados para confiar no número" : "base sólida"}
          destaque={score.cobertura < 50 ? "negativo" : undefined}
        />
        <Metrica
          rotulo="R$/m² de potencial"
          valor={score.precoPorPotencial ? brl(score.precoPorPotencial) : "—"}
          detalhe={score.precoPorM2Terreno ? `${brl(score.precoPorM2Terreno)}/m² de terreno` : undefined}
        />
      </div>

      <Cartao>
        <CartaoCabecalho
          titulo="Critérios"
          descricao="Cada critério tem nota de 0 a 10 e um peso. Critério sem dado não pontua nem penaliza — ele sai da média e reduz a cobertura."
        />
        <ul className="divide-y divide-slate-100">
          {score.criterios.map((c) => (
            <li key={c.chave} className="px-5 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {c.rotulo}
                    <span className="ml-2 text-xs font-normal text-slate-400">peso {c.peso}</span>
                  </p>
                  <p className="text-xs text-slate-500">{c.texto}</p>
                </div>
                <div className="w-32 shrink-0 text-right">
                  {c.nota == null ? (
                    <span className="text-xs text-slate-400">sem dado</span>
                  ) : (
                    <>
                      <span className="tnum text-sm font-semibold text-slate-900">
                        {numero(c.nota, 1)}
                      </span>
                      <span className="text-xs text-slate-400"> /10</span>
                      <div className="mt-1">
                        <Barra
                          percentual={c.nota * 10}
                          className={
                            c.nota >= 7 ? "bg-emerald-500" : c.nota >= 4 ? "bg-amber-500" : "bg-rose-500"
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

function AbaDueDiligence({
  terreno,
  membros,
  editavel,
  progresso,
}: {
  terreno: TerrenoDetalhado;
  membros: Array<{ id: string; name: string | null; email: string }>;
  editavel: boolean;
  progresso: Progresso;
}) {
  const faltantes = itensFaltantes(terreno.itensDD);

  const categorias = new Map<CategoriaDD, typeof terreno.itensDD>();
  for (const item of terreno.itensDD) {
    const lista = categorias.get(item.categoria as CategoriaDD) ?? [];
    lista.push(item);
    categorias.set(item.categoria as CategoriaDD, lista);
  }

  return (
    <div className="flex flex-col gap-5">
      <Cartao>
        <CartaoCorpo>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {progresso.concluidos} de {progresso.total} concluídos
              </p>
              <p className="text-xs text-slate-500">
                {progresso.problemas} problema(s)
                {progresso.problemasCriticos ? `, ${progresso.problemasCriticos} crítico(s)` : ""}
              </p>
            </div>
            <div className="w-full sm:w-64">
              <Barra percentual={progresso.percentual} />
            </div>
          </div>

          {faltantes > 0 && editavel ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-sky-50 px-4 py-3">
              <p className="text-sm text-sky-900">
                O checklist padrão ganhou {faltantes} item(ns) desde que este terreno foi criado.
              </p>
              <form action={sincronizarChecklist}>
                <input type="hidden" name="terrenoId" value={terreno.id} />
                <Botao type="submit" variante="secundario">
                  Sincronizar
                </Botao>
              </form>
            </div>
          ) : null}
        </CartaoCorpo>
      </Cartao>

      {[...categorias.entries()].map(([categoria, itens]) => {
        const ok = itens.filter((i) => i.status === "OK").length;
        return (
          <Cartao key={categoria}>
            <CartaoCabecalho
              titulo={CATEGORIA_DD_ROTULO[categoria]}
              acao={
                <span className="text-xs text-slate-500">
                  {ok}/{itens.length}
                </span>
              }
            />
            <ul className="divide-y divide-slate-100">
              {itens.map((item) => (
                <LinhaItemDD
                  key={item.id}
                  item={{
                    id: item.id,
                    titulo: item.titulo,
                    descricao: item.descricao,
                    critico: item.critico,
                    status: item.status as StatusItemDD,
                    prazo: item.prazo,
                    observacao: item.observacao,
                    responsavel: item.responsavel,
                  }}
                  membros={membros}
                  editavel={editavel}
                />
              ))}
            </ul>
          </Cartao>
        );
      })}

      <p className="text-xs text-slate-400">
        Legenda:{" "}
        {(["PENDENTE", "EM_ANDAMENTO", "OK", "PROBLEMA", "NAO_APLICAVEL"] as StatusItemDD[]).map((s) => (
          <span key={s} className="mr-1.5 inline-block">
            <Etiqueta className={STATUS_DD_CLASSE[s]}>{STATUS_DD_ROTULO[s]}</Etiqueta>
          </span>
        ))}
      </p>
    </div>
  );
}
