"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { ESTADO_INICIAL, type EstadoForm } from "@/lib/form-state";
import {
  OPCOES_DOCUMENTAL,
  OPCOES_MOTIVACAO,
  OPCOES_OCUPACAO,
  OPCOES_ORIGEM,
  OPCOES_STATUS,
  OPCOES_TOPOGRAFIA,
} from "@/lib/enums";
import { PARAMETROS_ZONA, ZONAS } from "@/lib/zeu";
import { BotaoEnvio } from "./botao-envio";
import {
  Aviso,
  AreaTexto,
  Campo,
  Cartao,
  CartaoCorpo,
  Caixa,
  Entrada,
  GrupoCampos,
  Selecao,
} from "./ui";

export interface ValoresTerreno {
  apelido?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  distrito?: string | null;
  cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sqlContribuinte?: string | null;
  zona?: string | null;
  zonaObservacao?: string | null;
  caBasico?: number | null;
  caMaximo?: number | null;
  areaTerreno?: number | null;
  testada?: number | null;
  profundidade?: number | null;
  numeroLotes?: number | null;
  numeroMatriculas?: number | null;
  topografia?: string | null;
  ocupacao?: string | null;
  estacaoProxima?: string | null;
  linhaTransporte?: string | null;
  distanciaEstacaoM?: number | null;
  precoPedido?: number | null;
  valorVenalM2?: number | null;
  aceitaPermuta?: boolean | null;
  percentualPermuta?: number | null;
  origem?: string | null;
  motivacaoVendedor?: string | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoEmail?: string | null;
  situacaoDocumental?: string | null;
  tombado?: boolean | null;
  zepecEntorno?: boolean | null;
  areaContaminada?: boolean | null;
  melhoramentoViario?: boolean | null;
  areaPreservacao?: boolean | null;
  servidao?: boolean | null;
  restricaoAeroportuaria?: boolean | null;
  restricoesObservacao?: string | null;
  status?: string | null;
  responsavelId?: string | null;
  observacoes?: string | null;
}

export interface MembroOpcao {
  id: string;
  name: string | null;
  email: string;
}

const v = (valor: string | number | null | undefined): string | number | undefined =>
  valor == null ? undefined : valor;

export function FormTerreno({
  acao,
  inicial = {},
  membros,
  resultadoId,
  rotuloEnvio = "Salvar terreno",
  cancelarHref,
}: {
  acao: (estado: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  inicial?: ValoresTerreno;
  membros: MembroOpcao[];
  resultadoId?: string;
  rotuloEnvio?: string;
  cancelarHref: string;
}) {
  const [estado, executar] = useActionState(acao, ESTADO_INICIAL);
  const [zona, setZona] = useState(inicial.zona ?? "ZEU");
  const [permuta, setPermuta] = useState(Boolean(inicial.aceitaPermuta));

  const erros = estado.erros ?? {};
  const parametros = PARAMETROS_ZONA[zona as keyof typeof PARAMETROS_ZONA];

  return (
    <form action={executar} className="flex flex-col gap-5">
      {resultadoId ? <input type="hidden" name="resultadoId" value={resultadoId} /> : null}

      {estado.mensagem && !estado.ok ? <Aviso tom="erro">{estado.mensagem}</Aviso> : null}

      <Cartao>
        <CartaoCorpo className="flex flex-col gap-6">
          {/* --- Identificação --- */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo
              label="Como vamos chamar"
              htmlFor="apelido"
              obrigatorio
              erro={erros.apelido}
              ajuda="Nome curto para conversas: “Esquina Vergueiro x Luís Góis”."
              className="sm:col-span-2"
            >
              <Entrada id="apelido" name="apelido" defaultValue={v(inicial.apelido)} maxLength={120} />
            </Campo>
            <Campo label="Status" htmlFor="status" erro={erros.status}>
              <Selecao id="status" name="status" defaultValue={inicial.status ?? "NOVO"}>
                {OPCOES_STATUS.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>

          {/* --- Localização --- */}
          <GrupoCampos titulo="Localização">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo
                label="Logradouro"
                htmlFor="logradouro"
                obrigatorio
                erro={erros.logradouro}
                className="sm:col-span-2"
              >
                <Entrada id="logradouro" name="logradouro" defaultValue={v(inicial.logradouro)} />
              </Campo>
              <Campo label="Número" htmlFor="numero" erro={erros.numero}>
                <Entrada id="numero" name="numero" defaultValue={v(inicial.numero)} />
              </Campo>
              <Campo label="Complemento" htmlFor="complemento" erro={erros.complemento}>
                <Entrada id="complemento" name="complemento" defaultValue={v(inicial.complemento)} />
              </Campo>
              <Campo label="Bairro" htmlFor="bairro" erro={erros.bairro}>
                <Entrada id="bairro" name="bairro" defaultValue={v(inicial.bairro)} />
              </Campo>
              <Campo label="Distrito" htmlFor="distrito" erro={erros.distrito}>
                <Entrada id="distrito" name="distrito" defaultValue={v(inicial.distrito)} />
              </Campo>
              <Campo label="CEP" htmlFor="cep" erro={erros.cep}>
                <Entrada id="cep" name="cep" placeholder="00000-000" defaultValue={v(inicial.cep)} />
              </Campo>
              <Campo
                label="Nº do contribuinte (SQL)"
                htmlFor="sqlContribuinte"
                erro={erros.sqlContribuinte}
                ajuda="Setor-quadra-lote do IPTU. É a chave para consultar o GeoSampa."
              >
                <Entrada
                  id="sqlContribuinte"
                  name="sqlContribuinte"
                  defaultValue={v(inicial.sqlContribuinte)}
                />
              </Campo>
              <Campo label="Latitude" htmlFor="latitude" erro={erros.latitude}>
                <Entrada
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="any"
                  placeholder="-23.5875"
                  defaultValue={v(inicial.latitude)}
                />
              </Campo>
              <Campo
                label="Longitude"
                htmlFor="longitude"
                erro={erros.longitude}
                ajuda="Preencha as duas para o terreno aparecer no mapa."
              >
                <Entrada
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="any"
                  placeholder="-46.6390"
                  defaultValue={v(inicial.longitude)}
                />
              </Campo>
            </div>
          </GrupoCampos>

          {/* --- Urbanístico --- */}
          <GrupoCampos
            titulo="Zoneamento"
            descricao="Os coeficientes só precisam ser preenchidos quando a certidão divergir do padrão da zona."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Zona" htmlFor="zona" erro={erros.zona}>
                <Selecao
                  id="zona"
                  name="zona"
                  value={zona}
                  onChange={(e) => setZona(e.target.value)}
                >
                  {ZONAS.map((z) => (
                    <option key={z} value={z}>
                      {PARAMETROS_ZONA[z].rotulo} — {PARAMETROS_ZONA[z].nomeCompleto}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo
                label="CA básico"
                htmlFor="caBasico"
                erro={erros.caBasico}
                ajuda={`Padrão da zona: ${parametros?.caBasico ?? "—"}`}
              >
                <Entrada
                  id="caBasico"
                  name="caBasico"
                  type="number"
                  step="0.1"
                  min={0}
                  placeholder={String(parametros?.caBasico ?? "")}
                  defaultValue={v(inicial.caBasico)}
                />
              </Campo>
              <Campo
                label="CA máximo"
                htmlFor="caMaximo"
                erro={erros.caMaximo}
                ajuda={`Padrão da zona: ${parametros?.caMaximo ?? "—"}`}
              >
                <Entrada
                  id="caMaximo"
                  name="caMaximo"
                  type="number"
                  step="0.1"
                  min={0}
                  placeholder={String(parametros?.caMaximo ?? "")}
                  defaultValue={v(inicial.caMaximo)}
                />
              </Campo>
              <Campo label="Observação de zoneamento" htmlFor="zonaObservacao" erro={erros.zonaObservacao}>
                <Entrada
                  id="zonaObservacao"
                  name="zonaObservacao"
                  defaultValue={v(inicial.zonaObservacao)}
                  placeholder="ex.: parte do lote em ZEU, parte em ZM"
                />
              </Campo>
            </div>
            {parametros?.observacao ? (
              <p className="mt-3 text-xs text-amber-700">{parametros.observacao}</p>
            ) : null}
          </GrupoCampos>

          {/* --- Físico --- */}
          <GrupoCampos titulo="Terreno">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Área (m²)" htmlFor="areaTerreno" obrigatorio erro={erros.areaTerreno}>
                <Entrada
                  id="areaTerreno"
                  name="areaTerreno"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={v(inicial.areaTerreno)}
                />
              </Campo>
              <Campo label="Testada (m)" htmlFor="testada" erro={erros.testada}>
                <Entrada
                  id="testada"
                  name="testada"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={v(inicial.testada)}
                />
              </Campo>
              <Campo label="Profundidade (m)" htmlFor="profundidade" erro={erros.profundidade}>
                <Entrada
                  id="profundidade"
                  name="profundidade"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={v(inicial.profundidade)}
                />
              </Campo>
              <Campo label="Topografia" htmlFor="topografia" erro={erros.topografia}>
                <Selecao
                  id="topografia"
                  name="topografia"
                  defaultValue={inicial.topografia ?? "NAO_INFORMADO"}
                >
                  {OPCOES_TOPOGRAFIA.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo label="Nº de lotes" htmlFor="numeroLotes" erro={erros.numeroLotes}>
                <Entrada
                  id="numeroLotes"
                  name="numeroLotes"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={inicial.numeroLotes ?? 1}
                />
              </Campo>
              <Campo
                label="Nº de matrículas"
                htmlFor="numeroMatriculas"
                erro={erros.numeroMatriculas}
                ajuda="Mais de uma matrícula = unificação antes de aprovar."
              >
                <Entrada
                  id="numeroMatriculas"
                  name="numeroMatriculas"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={inicial.numeroMatriculas ?? 1}
                />
              </Campo>
              <Campo label="Ocupação atual" htmlFor="ocupacao" erro={erros.ocupacao}>
                <Selecao id="ocupacao" name="ocupacao" defaultValue={inicial.ocupacao ?? "NAO_INFORMADO"}>
                  {OPCOES_OCUPACAO.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo
                label="Situação documental"
                htmlFor="situacaoDocumental"
                erro={erros.situacaoDocumental}
              >
                <Selecao
                  id="situacaoDocumental"
                  name="situacaoDocumental"
                  defaultValue={inicial.situacaoDocumental ?? "NAO_INFORMADO"}
                >
                  {OPCOES_DOCUMENTAL.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Selecao>
              </Campo>
            </div>
          </GrupoCampos>

          {/* --- Transporte --- */}
          <GrupoCampos titulo="Transporte" descricao="É o que define o eixo e sustenta o argumento de venda.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Estação / corredor" htmlFor="estacaoProxima" erro={erros.estacaoProxima}>
                <Entrada
                  id="estacaoProxima"
                  name="estacaoProxima"
                  placeholder="ex.: Estação Saúde"
                  defaultValue={v(inicial.estacaoProxima)}
                />
              </Campo>
              <Campo label="Linha" htmlFor="linhaTransporte" erro={erros.linhaTransporte}>
                <Entrada
                  id="linhaTransporte"
                  name="linhaTransporte"
                  placeholder="ex.: Linha 1-Azul"
                  defaultValue={v(inicial.linhaTransporte)}
                />
              </Campo>
              <Campo
                label="Distância a pé (m)"
                htmlFor="distanciaEstacaoM"
                erro={erros.distanciaEstacaoM}
              >
                <Entrada
                  id="distanciaEstacaoM"
                  name="distanciaEstacaoM"
                  type="number"
                  min={0}
                  step={10}
                  defaultValue={v(inicial.distanciaEstacaoM)}
                />
              </Campo>
            </div>
          </GrupoCampos>

          {/* --- Comercial --- */}
          <GrupoCampos titulo="Comercial">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Preço pedido (R$)" htmlFor="precoPedido" erro={erros.precoPedido}>
                <Entrada
                  id="precoPedido"
                  name="precoPedido"
                  type="number"
                  min={0}
                  step={1000}
                  defaultValue={v(inicial.precoPedido)}
                />
              </Campo>
              <Campo
                label="Valor venal do m² (R$)"
                htmlFor="valorVenalM2"
                erro={erros.valorVenalM2}
                ajuda="Quadro 14 do PDE. Base de cálculo da outorga onerosa."
              >
                <Entrada
                  id="valorVenalM2"
                  name="valorVenalM2"
                  type="number"
                  min={0}
                  step={10}
                  defaultValue={v(inicial.valorVenalM2)}
                />
              </Campo>
              <Campo label="Origem" htmlFor="origem" erro={erros.origem}>
                <Selecao id="origem" name="origem" defaultValue={inicial.origem ?? "OUTRA"}>
                  {OPCOES_ORIGEM.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo
                label="Motivação do vendedor"
                htmlFor="motivacaoVendedor"
                erro={erros.motivacaoVendedor}
              >
                <Selecao
                  id="motivacaoVendedor"
                  name="motivacaoVendedor"
                  defaultValue={inicial.motivacaoVendedor ?? "NAO_INFORMADO"}
                >
                  {OPCOES_MOTIVACAO.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo label="Contato" htmlFor="contatoNome" erro={erros.contatoNome}>
                <Entrada id="contatoNome" name="contatoNome" defaultValue={v(inicial.contatoNome)} />
              </Campo>
              <Campo label="Telefone" htmlFor="contatoTelefone" erro={erros.contatoTelefone}>
                <Entrada
                  id="contatoTelefone"
                  name="contatoTelefone"
                  defaultValue={v(inicial.contatoTelefone)}
                />
              </Campo>
              <Campo label="E-mail do contato" htmlFor="contatoEmail" erro={erros.contatoEmail}>
                <Entrada
                  id="contatoEmail"
                  name="contatoEmail"
                  type="email"
                  defaultValue={v(inicial.contatoEmail)}
                />
              </Campo>
              <Campo label="Responsável" htmlFor="responsavelId" erro={erros.responsavelId}>
                <Selecao
                  id="responsavelId"
                  name="responsavelId"
                  defaultValue={inicial.responsavelId ?? ""}
                >
                  <option value="">Ninguém ainda</option>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </Selecao>
              </Campo>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Caixa
                name="aceitaPermuta"
                label="Aceita permuta"
                descricao="Permuta reduz a necessidade de caixa na aquisição."
                defaultChecked={Boolean(inicial.aceitaPermuta)}
                onChange={(e) => setPermuta(e.currentTarget.checked)}
              />
              {permuta ? (
                <Campo
                  label="Percentual de permuta (%)"
                  htmlFor="percentualPermuta"
                  erro={erros.percentualPermuta}
                >
                  <Entrada
                    id="percentualPermuta"
                    name="percentualPermuta"
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    defaultValue={v(inicial.percentualPermuta)}
                  />
                </Campo>
              ) : null}
            </div>
          </GrupoCampos>

          {/* --- Restrições --- */}
          <GrupoCampos
            titulo="Restrições"
            descricao="Cada marcação entra na pontuação e vira alerta na ficha do terreno."
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Caixa name="tombado" label="Tombado" descricao="Impede a incorporação" defaultChecked={Boolean(inicial.tombado)} />
              <Caixa
                name="zepecEntorno"
                label="ZEPEC no entorno"
                descricao="Pode limitar gabarito"
                defaultChecked={Boolean(inicial.zepecEntorno)}
              />
              <Caixa
                name="areaContaminada"
                label="Área contaminada"
                descricao="Posto, indústria, oficina"
                defaultChecked={Boolean(inicial.areaContaminada)}
              />
              <Caixa
                name="melhoramentoViario"
                label="Melhoramento viário"
                descricao="Parte do lote pode ser atingida"
                defaultChecked={Boolean(inicial.melhoramentoViario)}
              />
              <Caixa
                name="areaPreservacao"
                label="APP / curso d'água"
                descricao="Faixa non aedificandi"
                defaultChecked={Boolean(inicial.areaPreservacao)}
              />
              <Caixa name="servidao" label="Servidão" defaultChecked={Boolean(inicial.servidao)} />
              <Caixa
                name="restricaoAeroportuaria"
                label="Restrição aeroportuária"
                descricao="Cone de aproximação"
                defaultChecked={Boolean(inicial.restricaoAeroportuaria)}
              />
            </div>
            <div className="mt-4">
              <Campo label="Observações sobre restrições" htmlFor="restricoesObservacao">
                <AreaTexto
                  id="restricoesObservacao"
                  name="restricoesObservacao"
                  rows={2}
                  defaultValue={v(inicial.restricoesObservacao)}
                />
              </Campo>
            </div>
          </GrupoCampos>

          <GrupoCampos titulo="Observações gerais">
            <Campo label="Anotações" htmlFor="observacoes">
              <AreaTexto
                id="observacoes"
                name="observacoes"
                rows={4}
                defaultValue={v(inicial.observacoes)}
                placeholder="Contexto, histórico da negociação, o que precisa ser confirmado…"
              />
            </Campo>
          </GrupoCampos>
        </CartaoCorpo>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <Link
            href={cancelarHref}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </Link>
          <BotaoEnvio carregando="Salvando…">{rotuloEnvio}</BotaoEnvio>
        </div>
      </Cartao>
    </form>
  );
}
