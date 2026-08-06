-- CreateEnum
CREATE TYPE "OrigemZona" AS ENUM ('GEOJSON', 'TEXTO', 'PRESUMIDA', 'DESCONHECIDA');

-- CreateTable
CREATE TABLE "Busca" (
    "id" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "zonas" "Zona"[],
    "areaMin" DOUBLE PRECISION,
    "areaMax" DOUBLE PRECISION,
    "precoMax" DOUBLE PRECISION,
    "regioes" TEXT[],
    "termosExtras" TEXT,
    "provedor" TEXT NOT NULL,
    "consultas" TEXT[],
    "totalBruto" INTEGER NOT NULL DEFAULT 0,
    "totalAceito" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Busca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultadoBusca" (
    "id" TEXT NOT NULL,
    "buscaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "trecho" TEXT,
    "areaM2" DOUBLE PRECISION,
    "precoBRL" DOUBLE PRECISION,
    "endereco" TEXT,
    "bairro" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "zonaDetectada" "Zona",
    "origemZona" "OrigemZona" NOT NULL DEFAULT 'DESCONHECIDA',
    "confianca" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descartado" BOOLEAN NOT NULL DEFAULT false,
    "terrenoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultadoBusca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Geocodificacao" (
    "consulta" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "enderecoNormalizado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Geocodificacao_pkey" PRIMARY KEY ("consulta")
);

-- CreateIndex
CREATE INDEX "Busca_createdAt_idx" ON "Busca"("createdAt");

-- CreateIndex
CREATE INDEX "ResultadoBusca_buscaId_descartado_idx" ON "ResultadoBusca"("buscaId", "descartado");

-- CreateIndex
CREATE UNIQUE INDEX "ResultadoBusca_buscaId_url_key" ON "ResultadoBusca"("buscaId", "url");

-- AddForeignKey
ALTER TABLE "Busca" ADD CONSTRAINT "Busca_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultadoBusca" ADD CONSTRAINT "ResultadoBusca_buscaId_fkey" FOREIGN KEY ("buscaId") REFERENCES "Busca"("id") ON DELETE CASCADE ON UPDATE CASCADE;
