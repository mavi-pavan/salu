import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { Papel } from "./enums";

export interface UsuarioSessao {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  papel: Papel;
  ativo: boolean;
}

export async function usuarioAtual(): Promise<UsuarioSessao | null> {
  const sessao = await auth();
  if (!sessao?.user?.id) return null;
  return {
    id: sessao.user.id,
    name: sessao.user.name,
    email: sessao.user.email,
    image: sessao.user.image,
    papel: sessao.user.papel ?? "MEMBRO",
    ativo: sessao.user.ativo ?? true,
  };
}

/**
 * Usado no layout protegido e no começo de toda server action.
 * Não existe checagem em middleware: com sessão em banco, o middleware rodaria
 * no edge sem acesso ao Prisma. A verificação fica onde os dados são lidos.
 */
export async function exigirUsuario(): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  if (!usuario.ativo) redirect("/entrar/erro?error=AccessDenied");
  return usuario;
}

export function podeEditar(papel: Papel): boolean {
  return papel === "ADMIN" || papel === "MEMBRO";
}

export function ehAdmin(papel: Papel): boolean {
  return papel === "ADMIN";
}

export class SemPermissaoError extends Error {
  constructor(mensagem = "Você não tem permissão para esta ação.") {
    super(mensagem);
    this.name = "SemPermissaoError";
  }
}

export async function exigirEdicao(): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario();
  if (!podeEditar(usuario.papel)) {
    throw new SemPermissaoError("Seu perfil é somente leitura.");
  }
  return usuario;
}

export async function exigirAdmin(): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario();
  if (!ehAdmin(usuario.papel)) {
    throw new SemPermissaoError("Apenas administradores podem alterar esta configuração.");
  }
  return usuario;
}
