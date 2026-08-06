-- AlterTable
-- Quantas páginas de busca do portal foram descartadas por não serem anúncio
-- de um lote. Fica junto do total lido para explicar a diferença entre "56
-- anúncios lidos" e o punhado que sobra na lista.
ALTER TABLE "Busca" ADD COLUMN "descartadosListagem" INTEGER NOT NULL DEFAULT 0;
