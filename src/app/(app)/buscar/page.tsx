import type { Metadata } from "next";
import Link from "next/link";

import { exigirUsuario, podeEditar } from "@/lib/authz";
import { regioesPorSetor } from "@/lib/busca/regioes";
import { brlCompacto, dataHora, m2, numero } from "@/lib/format";
import { estadoDaBusca, listarBuscas } from "@/server/busca";
import { diagnosticoZoneamento } from "@/server/diagnostico";
import { FormBusca } from "@/components/form-busca";
import {
  Aviso,
  Cartao,
  CartaoCabecalho,
  CartaoCorpo,
  Etiqueta,
  TituloPagina,
  Vazio,
} from "@/components/ui";

export const metadata: Metadata = { title: "Buscar terrenos" };
export const dynamic = "force-dynamic";
/**
 * A busca faz muita coisa em sequência: várias consultas ao provedor, uma
 * geocodificação por segundo (política do Nominatim) e o cruzamento com o
 * zoneamento. O teto padrão de 10 s da Vercel cortaria a execução no meio.
 */
export const maxDuration = 60;

const PROVEDOR_ROTULO: Record<string, string> = {
  serper: "Serper (Google)",
  brave: "Brave Search",
  tavily: "Tavily",
  demo: "Demonstração",
};

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ diagnostico?: string }>;
}) {
  const usuario = await exigirUsuario();
  const { diagnostico } = await searchParams;
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

        {estado.zoneamento.chave === "geosampa" ? (
          <Aviso tom="ok" titulo="Zona confirmada no GeoSampa">
            Cada anúncio com endereço identificável é geocodificado e a coordenada é cruzada, na
            hora, com a camada <code>{estado.zoneamento.camada}</code> — o zoneamento vigente da
            Prefeitura. Quando o serviço não responde, a zona fica <strong>a verificar</strong>: o
            app nunca afirma que o lote não é ZEU sem ter conferido.{" "}
            <Link href="/buscar?diagnostico=1" className="font-medium underline">
              Testar a conexão agora
            </Link>
            .
          </Aviso>
        ) : estado.zoneamento.chave === "geojson" ? (
          <Aviso tom="ok" titulo="Zoneamento carregado de arquivo local">
            As zonas são confirmadas contra <code>{estado.zoneamento.arquivo}</code>, que vale a
            data em que o arquivo foi gerado. Para voltar a consultar o GeoSampa ao vivo, remova a
            variável <code>ZONEAMENTO_GEOJSON</code>.
          </Aviso>
        ) : (
          <Aviso tom="info" titulo="Confirmação automática de zona desligada">
            Com <code>GEOSAMPA_WFS=off</code> e sem GeoJSON local, o app filtra por região de eixo e
            deixa a zona como <strong>a verificar</strong>, com link para o GeoSampa.
          </Aviso>
        )}
      </div>

      {diagnostico ? (
        <div className="mb-6">
          <PainelDiagnostico />
        </div>
      ) : null}

      {podeEditar(usuario.papel) ? (
        <FormBusca
          regioesPorSetor={regioesPorSetor()}
          zoneamentoAtivo={estado.zoneamento.ativo}
          zoneamentoRotulo={estado.zoneamento.rotulo}
        />
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

/**
 * Teste de conexão com a camada de zoneamento.
 *
 * Fica atrás de `?diagnostico=1` porque é diagnóstico, não fluxo de trabalho —
 * mas precisa existir: quando o GeoSampa muda de endereço ou sai do ar, o
 * sintoma numa busca comum é discreto (as zonas viram "a verificar" e a lista
 * encolhe). Aqui a resposta do serviço aparece crua, com a URL usada.
 */
async function PainelDiagnostico() {
  const d = await diagnosticoZoneamento();

  return (
    <Cartao>
      <CartaoCabecalho
        titulo="Teste da camada de zoneamento"
        descricao="Três coordenadas conhecidas, consultadas agora. O que importa é o serviço responder com uma zona — qual zona depende do perímetro vigente."
      />
      <CartaoCorpo className="flex flex-col gap-4">
        {d.ok ? (
          <Aviso tom="ok" titulo="Conexão funcionando">
            O zoneamento respondeu e as zonas abaixo vieram da fonte <strong>{d.fonte.rotulo}</strong>.
          </Aviso>
        ) : (
          <Aviso tom="erro" titulo="Nenhuma zona foi confirmada">
            Nenhum dos pontos voltou com zona. O motivo de cada um está na tabela; a busca continua
            funcionando, só que sem confirmar ZEU.
          </Aviso>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-slate-200 text-left">
              <tr className="text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Ponto</th>
                <th className="py-2 pr-4">Coordenada</th>
                <th className="py-2">Resposta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.linhas.map((linha) => (
                <tr key={linha.nome}>
                  <td className="py-2.5 pr-4 font-medium text-slate-800">{linha.nome}</td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500">
                    {linha.latitude}, {linha.longitude}
                    <span className="block text-slate-400">{linha.utm}</span>
                  </td>
                  <td className="py-2.5">
                    {linha.resultado.estado === "encontrada" ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Etiqueta className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                          {linha.resultado.zona}
                        </Etiqueta>
                        <span className="text-xs text-slate-500">
                          camada devolveu “{linha.resultado.bruto}”
                        </span>
                      </span>
                    ) : linha.resultado.estado === "fora" ? (
                      <span className="text-xs text-slate-500">
                        consultado, nenhum polígono de zona neste ponto
                      </span>
                    ) : (
                      <span className="text-xs text-rose-700">{linha.resultado.motivo}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <p>
            Camada <code>{d.camada}</code> em <code>{d.endpoint}</code>.
          </p>
          <p className="mt-1.5 break-all">
            Requisição do primeiro ponto:{" "}
            <a
              href={d.exemploUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 hover:underline"
            >
              {d.exemploUrl}
            </a>
          </p>
        </div>
      </CartaoCorpo>
    </Cartao>
  );
}
