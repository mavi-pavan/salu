-- AlterTable
-- Guarda o filtro inteiro da busca. Sem estes campos, repetir uma busca
-- rodaria com parâmetros diferentes dos originais — e comparar o resultado com
-- o da semana passada, que é a razão de repetir, deixaria de fazer sentido.
-- Buscas antigas ficam com o padrão, que é o mesmo que o formulário oferece.
ALTER TABLE "Busca" ADD COLUMN "exigirArea" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Busca" ADD COLUMN "exigirZonaConfirmada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Busca" ADD COLUMN "variacoes" TEXT[];
ALTER TABLE "Busca" ADD COLUMN "maxConsultas" INTEGER NOT NULL DEFAULT 6;
