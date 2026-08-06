-- AlterTable
-- Marca o que já foi visto em busca anterior, para que repetir o mesmo filtro
-- toda semana mostre só o que entrou no mercado desde a última vez.
ALTER TABLE "ResultadoBusca" ADD COLUMN "chaveUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ResultadoBusca" ADD COLUMN "novo" BOOLEAN NOT NULL DEFAULT true;

-- Preenche a chave dos resultados que já existem: host + caminho, sem query
-- string. Feito em SQL para não deixar histórico com chave vazia, que
-- apareceria como novidade em toda busca futura.
UPDATE "ResultadoBusca"
SET "chaveUrl" = lower(
  regexp_replace(
    regexp_replace(split_part(split_part("url", '?', 1), '#', 1), '^https?://(www\.)?', ''),
    '/+$', ''
  )
)
WHERE "chaveUrl" = '';

CREATE INDEX "ResultadoBusca_chaveUrl_idx" ON "ResultadoBusca"("chaveUrl");
