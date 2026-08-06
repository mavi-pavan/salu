import { redirect } from "next/navigation";

import { usuarioAtual } from "@/lib/authz";

export default async function Home() {
  const usuario = await usuarioAtual();
  redirect(usuario ? "/painel" : "/entrar");
}
