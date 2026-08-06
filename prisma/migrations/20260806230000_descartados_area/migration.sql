-- AlterTable
-- Fecha a conta do funil da busca: páginas lidas menos listagens, menos
-- anúncios sem área, menos reprovados pela zona, dá os candidatos. Sem esse
-- número, "só achou 2" fica sem explicação na tela.
ALTER TABLE "Busca" ADD COLUMN "descartadosArea" INTEGER NOT NULL DEFAULT 0;
