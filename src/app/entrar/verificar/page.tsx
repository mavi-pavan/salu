import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Verifique seu e-mail" };

export default function VerificarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-xl">
          ✉️
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Link enviado</h1>
        <p className="mt-2 text-sm text-slate-500">
          Abra seu e-mail e clique no link para entrar. Ele vale por 24 horas e só funciona uma vez.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Não chegou? Confira a caixa de spam ou{" "}
          <Link href="/entrar" className="font-medium text-emerald-600 underline">
            peça outro link
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
