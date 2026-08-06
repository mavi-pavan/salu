-- AlterTable
-- Quantos anúncios o zoneamento reprovou. Sem esse número, uma busca que
-- encontra 40 lotes e descarta 38 por não serem ZEU aparece como "nada
-- encontrado", que é a leitura errada.
ALTER TABLE "Busca" ADD COLUMN "descartadosZona" INTEGER NOT NULL DEFAULT 0;
