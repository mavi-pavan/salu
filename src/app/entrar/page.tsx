import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { googleAtivo, signIn } from "@/auth";
import { usuarioAtual } from "@/lib/authz";
import { Botao, Campo, Entrada } from "@/components/ui";

export const metadata: Metadata = { title: "Entrar" };

function LogoGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.26a12 12 0 0 0 0 10.74l4.01-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.26 6.63l4.01 3.09C6.22 6.87 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

export default async function EntrarPage() {
  if (await usuarioAtual()) redirect("/painel");

  const comGoogle = googleAtivo();

  async function entrarComGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/painel" });
  }

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
            Acesso restrito à equipe.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {comGoogle ? (
            <form action={entrarComGoogle}>
              <Botao type="submit" variante="secundario" className="w-full py-2.5">
                <LogoGoogle />
                Entrar com Google
              </Botao>
            </form>
          ) : null}

          {comGoogle ? (
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">ou por e-mail</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          ) : null}

          <form action={enviarLink} className="flex flex-col gap-4">
            <input type="hidden" name="redirectTo" value="/painel" />
            <Campo label="E-mail" htmlFor="email" obrigatorio={!comGoogle}>
              <Entrada
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@exemplo.com"
                autoFocus={!comGoogle}
              />
            </Campo>
            <Botao
              type="submit"
              variante={comGoogle ? "secundario" : "primario"}
              className="w-full"
            >
              Receber link de acesso
            </Botao>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            {comGoogle
              ? "Só entram e-mails convidados, por qualquer um dos caminhos."
              : "Sem senha. O link vale por 24 horas e só funciona uma vez."}
          </p>
        </div>
      </div>
    </main>
  );
}
