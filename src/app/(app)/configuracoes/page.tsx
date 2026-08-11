import type { Metadata } from "next";

import { ehAdmin, exigirUsuario } from "@/lib/authz";
import { OPCOES_PAPEL, PAPEL_ROTULO, type Papel } from "@/lib/enums";
import { paraPremissasFormulario } from "@/lib/viabilidade";
import { data, dataHora } from "@/lib/format";
import { listarConvites, listarMembros, obterConfiguracao } from "@/server/queries";
import { alterarMembro, removerConvite } from "@/server/actions";
import { estadoDaBusca } from "@/server/busca";
import { FormConfiguracao } from "@/components/form-configuracao";
import { FormConvite } from "@/components/form-convite";
import {
  Aviso,
  Botao,
  Cartao,
  CartaoCabecalho,
  CartaoCorpo,
  Etiqueta,
  LinhaInfo,
  TituloPagina,
} from "@/components/ui";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const usuario = await exigirUsuario();
  const admin = ehAdmin(usuario.papel);

  const [config, membros, convites, busca] = await Promise.all([
    obterConfiguracao(),
    listarMembros(),
    admin ? listarConvites() : Promise.resolve([]),
    estadoDaBusca(),
  ]);

  return (
    <>
      <TituloPagina
        titulo="Configurações"
        descricao={
          <>
            {config.atualizadoEm
              ? `Última alteração em ${dataHora(config.atualizadoEm)}`
              : "Ainda usando os valores padrão"}
            {" · "}
            <span className="text-slate-500">
              nada aqui filtra a busca — quem decide os anúncios que aparecem é o filtro de zonas,
              área e preço na tela de buscar
            </span>
          </>
        }
      />

      {!admin ? (
        <div className="mb-5">
          <Aviso tom="info">
            Só administradores alteram pesos, premissas e equipe. Você pode consultar os valores em
            uso.
          </Aviso>
        </div>
      ) : null}

      {admin ? (
        <FormConfiguracao
          pesos={config.pesos}
          premissasFormulario={paraPremissasFormulario(config.premissas)}
        />
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Cartao>
          <CartaoCabecalho
            titulo="Equipe"
            descricao={`${membros.length} pessoa(s) com acesso`}
          />
          <ul className="divide-y divide-slate-100">
            {membros.map((membro) => (
              <li key={membro.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {membro.name ?? membro.email}
                    {membro.id === usuario.id ? (
                      <span className="ml-1.5 text-xs text-slate-400">(você)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {membro.email} · {membro._count.terrenosCriados} terreno(s) ·{" "}
                    {membro.emailVerified ? `desde ${data(membro.createdAt)}` : "nunca entrou"}
                  </p>
                </div>

                {admin ? (
                  <form action={alterarMembro} className="flex items-center gap-2">
                    <input type="hidden" name="usuarioId" value={membro.id} />
                    <select
                      name="papel"
                      defaultValue={membro.papel}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      aria-label={`Papel de ${membro.email}`}
                    >
                      {OPCOES_PAPEL.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                    <input type="hidden" name="ativo" value={String(membro.ativo)} />
                    <Botao type="submit" variante="secundario" className="px-2 py-1 text-xs">
                      Aplicar
                    </Botao>
                  </form>
                ) : (
                  <Etiqueta>{PAPEL_ROTULO[membro.papel as Papel]}</Etiqueta>
                )}
              </li>
            ))}
          </ul>
        </Cartao>

        {admin ? (
          <Cartao>
            <CartaoCabecalho
              titulo="Convites"
              descricao="Só e-mails convidados conseguem receber o link de acesso."
            />
            <CartaoCorpo className="border-b border-slate-200 bg-slate-50">
              <FormConvite />
            </CartaoCorpo>
            {convites.length === 0 ? (
              <CartaoCorpo>
                <p className="text-sm text-slate-500">Nenhum convite pendente.</p>
              </CartaoCorpo>
            ) : (
              <ul className="divide-y divide-slate-100">
                {convites.map((convite) => (
                  <li key={convite.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm text-slate-800">{convite.email}</p>
                      <p className="text-xs text-slate-500">
                        {PAPEL_ROTULO[convite.papel as Papel]} · convidado em {data(convite.createdAt)}
                        {convite.autor ? ` por ${convite.autor.name ?? convite.autor.email}` : ""}
                      </p>
                    </div>
                    <form action={removerConvite}>
                      <input type="hidden" name="conviteId" value={convite.id} />
                      <Botao variante="fantasma" type="submit" className="text-xs">
                        Remover
                      </Botao>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        ) : null}
      </div>

      <div className="mt-6">
        <Cartao>
          <CartaoCabecalho
            titulo="Integrações da busca"
            descricao="Configuradas por variáveis de ambiente — ver README."
          />
          <CartaoCorpo>
            <dl className="divide-y divide-slate-100">
              <LinhaInfo
                rotulo="Provedor de busca"
                valor={
                  busca.demo ? (
                    <Etiqueta className="bg-amber-50 text-amber-800 ring-amber-200">
                      demonstração (sem chave)
                    </Etiqueta>
                  ) : (
                    <Etiqueta className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                      {busca.provedor}
                    </Etiqueta>
                  )
                }
              />
              <LinhaInfo
                rotulo="Camada de zoneamento"
                valor={
                  busca.zoneamento ? (
                    <Etiqueta className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                      carregada
                    </Etiqueta>
                  ) : (
                    <Etiqueta className="bg-slate-100 text-slate-500 ring-slate-200">
                      não configurada
                    </Etiqueta>
                  )
                }
              />
              <LinhaInfo rotulo="Portais consultados" valor={busca.portais.join(", ")} />
            </dl>
          </CartaoCorpo>
        </Cartao>
      </div>
    </>
  );
}
