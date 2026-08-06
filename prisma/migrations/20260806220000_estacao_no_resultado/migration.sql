-- AlterTable
-- Estação citada no anúncio e distância declarada até ela: o melhor indício de
-- eixo que um anúncio oferece, e um dos critérios de pontuação do terreno.
ALTER TABLE "ResultadoBusca" ADD COLUMN "estacaoProxima" TEXT;
ALTER TABLE "ResultadoBusca" ADD COLUMN "distanciaEstacaoM" INTEGER;
