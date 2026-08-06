import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import Google from "next-auth/providers/google";
import { createTransport } from "nodemailer";

import { prisma } from "@/lib/prisma";
import type { Papel } from "@/lib/enums";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * App privado: só entra quem foi convidado. A checagem acontece ANTES do envio
 * do e-mail, então um endereço desconhecido nem recebe o link.
 */
async function emailAutorizado(email: string): Promise<boolean> {
  const alvo = email.trim().toLowerCase();
  if (!alvo) return false;
  if (adminEmails().includes(alvo)) return true;

  const [convite, usuario] = await Promise.all([
    prisma.convite.findUnique({ where: { email: alvo } }),
    prisma.user.findUnique({ where: { email: alvo }, select: { ativo: true } }),
  ]);

  if (convite) return true;
  return Boolean(usuario?.ativo);
}

function corpoEmail(url: string, host: string) {
  const texto = [
    "Salu",
    "",
    "Use o link abaixo para entrar. Ele vale por 24 horas e só pode ser usado uma vez.",
    url,
    "",
    "Se você não pediu este acesso, ignore este e-mail.",
  ].join("\n");

  const html = `
  <div style="background:#f8fafc;padding:32px 0;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
          <tr><td>
            <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#059669;font-weight:600">
              Salu
            </p>
            <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a">
              Seu link de acesso
            </h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569">
              Clique no botão para entrar em <strong>${host}</strong>. O link vale por 24 horas
              e só funciona uma vez.
            </p>
            <a href="${url}"
               style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;
                      padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
              Entrar
            </a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8">
              Se o botão não funcionar, copie e cole este endereço no navegador:<br>
              <span style="word-break:break-all;color:#64748b">${url}</span>
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">
              Não pediu este acesso? Pode ignorar este e-mail.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;

  return { texto, html };
}

/** O botão do Google só aparece quando as credenciais estão configuradas. */
export function googleAtivo(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

const provedores: NextAuthConfig["providers"] = [];

if (googleAtivo()) {
  provedores.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,

      /**
       * Sem isto, quem já entrou alguma vez pelo link mágico levaria
       * `OAuthAccountNotLinked` ao tentar o Google: o Auth.js se recusa a
       * juntar duas formas de entrar no mesmo e-mail.
       *
       * O risco clássico dessa flag é alguém forjar um provedor que afirme ser
       * dono de um e-mail alheio. Aqui isso não se aplica: o único provedor é o
       * Google, que verifica a posse do endereço, o `signIn` abaixo recusa
       * e-mail não verificado, e nada disso entra sem estar na lista de
       * convidados.
       */
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: "/entrar",
    verifyRequest: "/entrar/verificar",
    error: "/entrar/erro",
  },
  providers: [
    ...provedores,
    Nodemailer({
      // O valor real só é usado quando EMAIL_SERVER existe; o placeholder evita
      // que o provider quebre na inicialização em ambiente de desenvolvimento.
      server: process.env.EMAIL_SERVER || "smtp://localhost:1025",
      from: process.env.EMAIL_FROM || "Salu <nao-responda@localhost>",
      maxAge: 24 * 60 * 60,

      async sendVerificationRequest({ identifier, url, provider }) {
        const host = new URL(url).host;

        // Sem SMTP configurado, o link vai para o terminal. É o que permite
        // rodar o app localmente sem criar conta em serviço de e-mail.
        if (!process.env.EMAIL_SERVER) {
          console.log(
            [
              "",
              "┌───────────────────────────────────────────────────────────────",
              "│ EMAIL_SERVER não configurado — link de acesso no terminal:",
              `│ para: ${identifier}`,
              `│ ${url}`,
              "└───────────────────────────────────────────────────────────────",
              "",
            ].join("\n"),
          );
          return;
        }

        const { texto, html } = corpoEmail(url, host);
        const transport = createTransport(provider.server);
        const resultado = await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: `Entrar no Salu`,
          text: texto,
          html,
        });

        const falhas = resultado.rejected.concat(resultado.pending).filter(Boolean);
        if (falhas.length) {
          throw new Error(`E-mail não pôde ser enviado para ${falhas.join(", ")}`);
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      // Conta Google sem e-mail verificado não prova posse do endereço — e é
      // justamente a posse que a lista de convidados assume.
      if (account?.provider === "google") {
        const verificado = (profile as { email_verified?: boolean } | undefined)?.email_verified;
        if (verificado === false) return "/entrar/erro?error=AccessDenied";
      }

      const autorizado = await emailAutorizado(user.email);
      // Redireciona para a página de erro com um motivo legível.
      return autorizado ? true : "/entrar/erro?error=AccessDenied";
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.papel = (user as { papel?: Papel }).papel ?? "MEMBRO";
        session.user.ativo = (user as { ativo?: boolean }).ativo ?? true;
      }
      return session;
    },
  },
  events: {
    /**
     * Primeiro login: define o papel a partir do convite (ou de ADMIN_EMAILS) e
     * dá um nome inicial para não ficar "null" na interface.
     */
    async createUser({ user }) {
      if (!user.email || !user.id) return;
      const email = user.email.toLowerCase();
      const convite = await prisma.convite.findUnique({ where: { email } });
      const papel: Papel = adminEmails().includes(email)
        ? "ADMIN"
        : ((convite?.papel as Papel | undefined) ?? "MEMBRO");

      const nomePadrao =
        user.name ??
        (email.split("@")[0] ?? "")
          .split(/[._-]+/)
          .filter(Boolean)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(" ");

      await prisma.user.update({
        where: { id: user.id },
        data: { papel, name: nomePadrao || null },
      });

      await prisma.evento.create({
        data: { usuarioId: user.id, acao: "usuario.primeiro_acesso", detalhe: { email, papel } },
      });
    },
  },
});
