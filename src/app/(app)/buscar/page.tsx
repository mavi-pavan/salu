import type { Metadata } from "next";
import Link from "next/link";

import { exigirUsuario, podeEditar } from "@/lib/authz";
import { regioesPorSetor } from "@/lib/busca/regioes";
import { brlCompacto, dataHora, m2, numero } from "@/lib/format";
import { estadoDaBusca, listarBuscas } from "@/server/busca";
import { FormBusca } from "@/components/form-busca";
import { Aviso, Cartao, CartaoCabecalho, Etiqueta, TituloPagina, Vazio } from "@/components/ui";

export const metadata: Metadata = { title: "Buscar terrenos" };
export const dynamic = "force-dynamic";

const PROVEDOR_ROTULO: Record<string, string> = {
  serper: "Serper (Google)",
  brave: "Brave Search",
  tavily: "Tavily",
  demo: "Demonstração",
};

export default async function BuscarPage() {
  const usuario = await exigirUsuario();
  const [estado, buscas] = await Promise.all([estadoDaBusca(), listarBuscas(10)]);

  return (
    <>
      <TituloPagina
        titulo="Buscar terrenos na internet"
        descricao="Procura anúncios de terreno nos portais, filtra pela área que você definir e marca os que estão em zona de eixo."
      />

      <div className="mb-6 flex flex-col gap-3">
        {estado.demo ? (
          <Aviso tom="atencao" titulo="Modo demonstração — resultados fictícios">
            Nenhuma chave de busca configurada, então o app devolve anúncios de exemplo (com
            endereço <code>.invalid</code>) só para você conhecer o fluxo. Para buscar de verdade,
            coloque <code>SERPER_API_KEY</code>, <code>BRAVE_API_KEY</code> ou{" "}
            <code>TAVILY_API_KEY</code> no <code>.env</code> — todos têm cota gratuita. Passo a passo
            no README.
          </Aviso>
        ) : (
          <Aviso tom="ok" titulo={`Busca ativa via ${PROVEDOR_ROTULO[estado.provedor] ?? estado.provedor}`}>
            Consultando {estado.portais.length} portais: {estado.portais.join(", ")}.
          </Aviso>
        )}

        {!estado.zoneamento ? (
          <Aviso tom="info" titulo="Zoneamento não carregado">
            Sem a camada oficial de zoneamento, o app não confirma sozinho se o lote está em ZEU —
            ele filtra por região de eixo e deixa a zona como <strong>a verificar</strong>, com link
            para o GeoSampa. Para ativar a confirmação automática, veja{" "}
            <code>ZONEAMENTO_GEOJSON</code> no README.
          </Aviso>
        ) : null}
      </div>

      {podeEditar(usuario.papel) ? (
        <FormBusca regioesPorSetor={regioesPorSetor()} zoneamentoAtivo={estado.zoneamento} />
      ) : (
        <Aviso tom="info">Seu perfil é somente leitura: você pode ver buscas já feitas.</Aviso>
      )}

      <div className="mt-8">
        <Cartao>
          <CartaoCabecalho
            titulo="Buscas anteriores"
            descricao="Repetir o mesmo filtro depois mostra o que entrou no mercado desde então."
          />
          {buscas.length === 0 ? (
            <div className="px-5 py-4">
              <Vazio
                titulo="Nenhuma busca ainda"
                descricao="Defina a área e as zonas acima para rodar a primeira."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {buscas.map((busca) => (
                <li key={busca.id}>
                  <Link
                    href={`/buscar/${busca.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-800">
                        {busca.zonas.length ? (
                          busca.zonas.map((z) => (
                            <Etiqueta key={z} className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                              {z}
                            </Etiqueta>
                          ))
                        ) : (
                          <Etiqueta>todas as zonas</Etiqueta>
                        )}
                        <span className="text-slate-500">
                          {busca.areaMin ? `a partir de ${m2(busca.areaMin)}` : "sem área mínima"}
                          {busca.areaMax ? ` até ${m2(busca.areaMax)}` : ""}
                          {busca.precoMax ? ` · até ${brlCompacto(busca.precoMax)}` : ""}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {dataHora(busca.createdAt)} · {busca.criadoPor.name ?? busca.criadoPor.email}
                        {busca.regioes.length ? ` · ${busca.regioes.length} região(ões)` : ""}
                        {busca.erro ? " · terminou com erro" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="tnum text-sm font-semibold text-slate-900">
                          {numero(busca._count.resultados)}
                        </p>
                        <p className="text-xs text-slate-500">aceitos</p>
                      </div>
                      <div>
                        <p className="tnum text-sm text-slate-500">{numero(busca.totalBruto)}</p>
                        <p className="text-xs text-slate-400">brutos</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
