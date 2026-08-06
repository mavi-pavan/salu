import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { exigirUsuario, podeEditar } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listarMembros } from "@/server/queries";
import { atualizarTerreno } from "@/server/actions";
import { FormTerreno } from "@/components/form-terreno";
import { TituloPagina } from "@/components/ui";

export const metadata: Metadata = { title: "Editar terreno" };
export const dynamic = "force-dynamic";

export default async function EditarTerrenoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await exigirUsuario();
  if (!podeEditar(usuario.papel)) redirect(`/terrenos/${id}`);

  const [terreno, membros] = await Promise.all([
    prisma.terreno.findUnique({ where: { id } }),
    listarMembros(),
  ]);
  if (!terreno) notFound();

  return (
    <>
      <TituloPagina
        titulo={`Editar ${terreno.codigo}`}
        descricao={terreno.apelido}
      />
      <FormTerreno
        acao={atualizarTerreno.bind(null, terreno.id)}
        inicial={terreno}
        membros={membros}
        rotuloEnvio="Salvar alterações"
        cancelarHref={`/terrenos/${terreno.id}`}
      />
    </>
  );
}
