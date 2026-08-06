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
      "O servidor de e-mail, o AUTH_SECRET ou as credenciais do Google não estão configurados. Verifique as variáveis de ambiente.",
  },
  OAuthAccountNotLinked: {
    titulo: "E-mail já usado por outro caminho",
    texto:
      "Esse endereço já entrou no Salu por outro método. Use o mesmo de antes, ou peça a um administrador para verificar a conta.",
  },
  OAuthSignin: {
    titulo: "Falha ao falar com o Google",
    texto:
      "Não foi possível iniciar o login com o Google. Tente de novo; se persistir, use o link por e-mail.",
  },
  OAuthCallback: {
    titulo: "O Google recusou o retorno",
    texto:
      "Normalmente é a URL de redirecionamento cadastrada no Google Cloud que não bate com o endereço do site.",
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
