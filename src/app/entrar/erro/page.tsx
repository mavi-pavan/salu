import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Não foi possível entrar" };

const MENSAGENS: Record<string, { titulo: string; texto: string }> = {
  AccessDenied: {
    titulo: "E-mail sem acesso",
    texto:
      "Este endereço não está na lista da equipe. Peça a um administrador para convidar seu e-mail em Configurações → Equipe.",
  },
  Verification: {
    titulo: "Link expirado",
    texto: "O link já foi usado ou passou das 24 horas. Peça um novo para continuar.",
  },
  Configuration: {
    titulo: "Configuração incompleta",
    texto:
      "O servidor de e-mail ou o AUTH_SECRET não estão configurados. Verifique as variáveis de ambiente.",
  },
};

const PADRAO = {
  titulo: "Não foi possível entrar",
  texto: "Tente novamente. Se persistir, avise um administrador.",
};

export default async function ErroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const mensagem = (error && MENSAGENS[error]) || PADRAO;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-xl">
          🔒
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">{mensagem.titulo}</h1>
        <p className="mt-2 text-sm text-slate-500">{mensagem.texto}</p>
        <Link
          href="/entrar"
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Voltar
        </Link>
      </div>
    </main>
  );
}
