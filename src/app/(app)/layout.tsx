import Link from "next/link";

import { exigirUsuario, podeEditar } from "@/lib/authz";
import { PAPEL_ROTULO } from "@/lib/enums";
import { iniciais } from "@/lib/format";
import { sair } from "@/server/actions";
import { NavLinks } from "@/components/nav-links";
import { BotaoLink, Etiqueta } from "@/components/ui";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pt-3 sm:px-6">
          <Link href="/painel" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
              S
            </span>
            <span className="text-base font-semibold text-slate-900">Salu</span>
          </Link>

          <div className="flex items-center gap-3">
            {podeEditar(usuario.papel) ? (
              <BotaoLink href="/terrenos/novo" className="hidden sm:inline-flex">
                + Novo terreno
              </BotaoLink>
            ) : null}

            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600"
                title={usuario.email ?? undefined}
              >
                {iniciais(usuario.name, usuario.email)}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="max-w-[160px] truncate text-sm font-medium text-slate-800">
                  {usuario.name ?? usuario.email}
                </p>
                <Etiqueta className="mt-0.5 bg-slate-100 text-slate-500 ring-slate-200">
                  {PAPEL_ROTULO[usuario.papel]}
                </Etiqueta>
              </div>
              <form action={sair}>
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                >
                  Sair
                </button>
              </form>
            </div>
          </div>

          <div className="order-last w-full">
            <NavLinks />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
