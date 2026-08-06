import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { usuarioAtual } from "@/lib/authz";
import { Botao, Campo, Entrada } from "@/components/ui";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage() {
  if (await usuarioAtual()) redirect("/painel");

  async function enviarLink(formData: FormData) {
    "use server";
    // O Auth.js cuida do redirecionamento: vai para /entrar/verificar quando o
    // e-mail é enviado, ou para /entrar/erro quando o endereço não tem convite.
    await signIn("nodemailer", formData);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white">
            S
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Salu</h1>
          <p className="mt-3 text-sm text-slate-500">
            Acesso restrito à equipe. Informe seu e-mail e enviaremos um link de acesso.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <form action={enviarLink} className="flex flex-col gap-4">
            <input type="hidden" name="redirectTo" value="/painel" />
            <Campo label="E-mail" htmlFor="email" obrigatorio>
              <Entrada
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@exemplo.com"
                autoFocus
              />
            </Campo>
            <Botao type="submit" className="w-full">
              Receber link de acesso
            </Botao>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Sem senha. O link vale por 24 horas e só funciona uma vez.
          </p>
        </div>
      </div>
    </main>
  );
}
