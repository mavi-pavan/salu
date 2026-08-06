/**
 * Build de produção: gera o client, aplica as migrations e compila.
 *
 * Existe como script em vez de uma linha no package.json por um motivo só:
 * `DIRECT_URL` é fácil de esquecer ao configurar o deploy, e a mensagem que o
 * Prisma dá nesse caso ("Environment variable not found: DIRECT_URL") não
 * ajuda em nada quem está montando o ambiente pela primeira vez.
 *
 * Aqui, se ela faltar, o build continua usando a DATABASE_URL e avisa em alto
 * e bom som — em vez de falhar antes mesmo de ler o schema.
 */

import { spawnSync } from "node:child_process";

/**
 * `prisma migrate deploy` pega um advisory lock no Postgres, e advisory lock
 * não sobrevive ao modo de pooling do Neon: o comando fica esperando para
 * sempre, sem imprimir erro nenhum, e o build morre no timeout.
 *
 * Como o endpoint direto do Neon é exatamente o mesmo host sem o sufixo
 * `-pooler`, dá para consertar sozinho em vez de deixar o build travar.
 */
function enderecoDireto(url) {
  if (!url.includes("-pooler") || !url.includes("neon.tech")) return url;
  return url.replace("-pooler", "");
}

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  console.warn(
    [
      "",
      "┌───────────────────────────────────────────────────────────────────",
      "│ AVISO: DIRECT_URL não está definida.",
      "│ Usando DATABASE_URL também para as migrations.",
      "│",
      "│ Funciona, mas o correto é definir as duas:",
      "│   DATABASE_URL -> conexão COM pool   (a que tem -pooler)",
      "│   DIRECT_URL   -> conexão SEM pool   (usada pelas migrations)",
      "└───────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

if (!process.env.DATABASE_URL) {
  console.error(
    "\nDATABASE_URL não está definida. Configure a string de conexão do Postgres antes de buildar.\n",
  );
  process.exit(1);
}

const direto = enderecoDireto(process.env.DIRECT_URL);
if (direto !== process.env.DIRECT_URL) {
  process.env.DIRECT_URL = direto;
  console.warn(
    [
      "",
      "┌───────────────────────────────────────────────────────────────────",
      "│ AVISO: DIRECT_URL apontava para o endpoint com pool do Neon.",
      "│ Removendo o sufixo -pooler para rodar as migrations.",
      "│",
      "│ Migrations não funcionam através do pool: elas usam advisory lock,",
      "│ e o comando ficaria travado sem mensagem de erro.",
      "└───────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

const etapas = [
  ["prisma", ["generate"]],
  ["prisma", ["migrate", "deploy"]],
  ["next", ["build"]],
];

for (const [comando, argumentos] of etapas) {
  const resultado = spawnSync(comando, argumentos, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (resultado.status !== 0) {
    process.exit(resultado.status ?? 1);
  }
}
