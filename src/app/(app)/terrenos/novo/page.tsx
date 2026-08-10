import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { exigirUsuario, podeEditar } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listarMembros } from "@/server/queries";
import { criarTerreno } from "@/server/actions";
import { FormTerreno, type ValoresTerreno } from "@/components/form-terreno";
import { Aviso, TituloPagina } from "@/components/ui";

export const metadata: Metadata = { title: "Novo terreno" };
export const dynamic = "force-dynamic";

export default async function NovoTerrenoPage({
  searchParams,
}: {
  searchParams: Promise<{ resultado?: string }>;
}) {
  const usuario = await exigirUsuario();
  if (!podeEditar(usuario.papel)) redirect("/terrenos");

  const { resultado: resultadoId } = await searchParams;
  const [membros, resultado] = await Promise.all([
    listarMembros(),
    resultadoId
      ? prisma.resultadoBusca.findUnique({ where: { id: resultadoId } })
      : Promise.resolve(null),
  ]);

  const inicial: ValoresTerreno = resultado
    ? {
        apelido: [resultado.endereco, resultado.bairro].filter(Boolean).join(" — ") ||
          resultado.titulo.slice(0, 100),
        logradouro: resultado.endereco ?? "",
        numero: resultado.numero ?? "",
        cep: resultado.cep ?? "",
        bairro: resultado.bairro ?? "",
        areaTerreno: resultado.areaM2,
        precoPedido: resultado.precoBRL,
        latitude: resultado.latitude,
        longitude: resultado.longitude,
        estacaoProxima: resultado.estacaoProxima ?? "",
        distanciaEstacaoM: resultado.distanciaEstacaoM,
        zona: resultado.zonaDetectada ?? "A_VERIFICAR",
        origem: "PORTAL",
        responsavelId: usuario.id,
      }
    : { responsavelId: usuario.id };

  return (
    <>
      <TituloPagina
        titulo="Novo terreno"
        descricao="A pontuação e o checklist de due diligence são criados automaticamente ao salvar."
      />

      {resultado ? (
        <div className="mb-5">
          <Aviso tom="info" titulo="Dados vindos de um anúncio">
            Preenchemos o que deu para ler de{" "}
            <a href={resultado.url} target="_blank" rel="noopener noreferrer nofollow">
              {resultado.fonte}
            </a>
            . Confira tudo antes de salvar — extração automática erra, principalmente em área e
            endereço. O link do anúncio fica salvo em Documentos.
          </Aviso>
        </div>
      ) : null}

      <FormTerreno
        acao={criarTerreno}
        inicial={inicial}
        membros={membros}
        resultadoId={resultado?.id}
        rotuloEnvio="Criar terreno"
        cancelarHref={resultado ? `/buscar/${resultado.buscaId}` : "/terrenos"}
      />
    </>
  );
}
