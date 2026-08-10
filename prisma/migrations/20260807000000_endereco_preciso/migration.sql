-- AlterTable
-- Número e CEP do anúncio. Geocodificar só o nome da rua devolve o meio dela,
-- e a ZEU é uma faixa: o meio de uma via longa pode estar em zona diferente do
-- lote. Guardados também para já irem preenchidos quando o resultado vira
-- terreno no funil.
ALTER TABLE "ResultadoBusca" ADD COLUMN "numero" TEXT;
ALTER TABLE "ResultadoBusca" ADD COLUMN "cep" TEXT;
