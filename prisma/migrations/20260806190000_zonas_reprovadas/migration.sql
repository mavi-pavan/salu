-- AlterTable
-- Guarda as siglas que a camada devolveu para os anúncios reprovados pelo
-- filtro de zona. "Reprovou 5" sozinho é ambíguo: pode ser o zoneamento
-- funcionando (eram ZM, ZC, ZR) ou a leitura da camada errada (viraram tudo
-- OUTRA). Com a lista, dá para ver qual dos dois é.
ALTER TABLE "Busca" ADD COLUMN "zonasReprovadas" TEXT[];
