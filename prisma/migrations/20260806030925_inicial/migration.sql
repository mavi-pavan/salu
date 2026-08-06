-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'MEMBRO', 'LEITOR');

-- CreateEnum
CREATE TYPE "Zona" AS ENUM ('ZEU', 'ZEUa', 'ZEUP', 'ZEUPa', 'ZEM', 'ZEMP', 'ZC', 'ZM', 'ZR', 'ZEIS', 'OUTRA', 'A_VERIFICAR');

-- CreateEnum
CREATE TYPE "StatusPipeline" AS ENUM ('NOVO', 'EM_ANALISE', 'VISITADO', 'PROPOSTA_ENVIADA', 'EM_NEGOCIACAO', 'DUE_DILIGENCE', 'CONTRATADO', 'DESCARTADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "Topografia" AS ENUM ('PLANA', 'ACLIVE_LEVE', 'DECLIVE_LEVE', 'ACLIVE_ACENTUADO', 'DECLIVE_ACENTUADO', 'IRREGULAR', 'NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "Ocupacao" AS ENUM ('VAZIO', 'EDIFICACAO_SIMPLES', 'EDIFICACAO_RELEVANTE', 'ALUGADO', 'OCUPACAO_IRREGULAR', 'NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "SituacaoDocumental" AS ENUM ('REGULAR', 'PENDENCIA_SIMPLES', 'ESPOLIO_INVENTARIO', 'LITIGIO_USUCAPIAO', 'NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "OrigemLead" AS ENUM ('CORRETOR', 'PROPRIETARIO', 'PORTAL', 'PROSPECCAO_ATIVA', 'INDICACAO', 'OUTRA');

-- CreateEnum
CREATE TYPE "Motivacao" AS ENUM ('ALTA', 'MEDIA', 'BAIXA', 'NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "CategoriaDD" AS ENUM ('DOCUMENTAL', 'VENDEDOR', 'URBANISTICO', 'AMBIENTAL', 'INFRAESTRUTURA', 'COMERCIAL', 'FINANCEIRO');

-- CreateEnum
CREATE TYPE "StatusItemDD" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'OK', 'PROBLEMA', 'NAO_APLICAVEL');

-- CreateEnum
CREATE TYPE "TipoNota" AS ENUM ('NOTA', 'VISITA', 'LIGACAO', 'REUNIAO', 'PROPOSTA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "papel" "Papel" NOT NULL DEFAULT 'MEMBRO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Convite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'MEMBRO',
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Terreno" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "apelido" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "distrito" TEXT,
    "cep" TEXT,
    "cidade" TEXT NOT NULL DEFAULT 'São Paulo',
    "uf" TEXT NOT NULL DEFAULT 'SP',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sqlContribuinte" TEXT,
    "zona" "Zona" NOT NULL DEFAULT 'A_VERIFICAR',
    "zonaObservacao" TEXT,
    "caBasico" DOUBLE PRECISION,
    "caMaximo" DOUBLE PRECISION,
    "areaTerreno" DOUBLE PRECISION NOT NULL,
    "testada" DOUBLE PRECISION,
    "profundidade" DOUBLE PRECISION,
    "numeroLotes" INTEGER NOT NULL DEFAULT 1,
    "numeroMatriculas" INTEGER NOT NULL DEFAULT 1,
    "topografia" "Topografia" NOT NULL DEFAULT 'NAO_INFORMADO',
    "ocupacao" "Ocupacao" NOT NULL DEFAULT 'NAO_INFORMADO',
    "estacaoProxima" TEXT,
    "linhaTransporte" TEXT,
    "distanciaEstacaoM" INTEGER,
    "precoPedido" DOUBLE PRECISION,
    "valorVenalM2" DOUBLE PRECISION,
    "aceitaPermuta" BOOLEAN NOT NULL DEFAULT false,
    "percentualPermuta" DOUBLE PRECISION,
    "origem" "OrigemLead" NOT NULL DEFAULT 'OUTRA',
    "motivacaoVendedor" "Motivacao" NOT NULL DEFAULT 'NAO_INFORMADO',
    "contatoNome" TEXT,
    "contatoTelefone" TEXT,
    "contatoEmail" TEXT,
    "situacaoDocumental" "SituacaoDocumental" NOT NULL DEFAULT 'NAO_INFORMADO',
    "tombado" BOOLEAN NOT NULL DEFAULT false,
    "zepecEntorno" BOOLEAN NOT NULL DEFAULT false,
    "areaContaminada" BOOLEAN NOT NULL DEFAULT false,
    "melhoramentoViario" BOOLEAN NOT NULL DEFAULT false,
    "areaPreservacao" BOOLEAN NOT NULL DEFAULT false,
    "servidao" BOOLEAN NOT NULL DEFAULT false,
    "restricaoAeroportuaria" BOOLEAN NOT NULL DEFAULT false,
    "restricoesObservacao" TEXT,
    "status" "StatusPipeline" NOT NULL DEFAULT 'NOVO',
    "responsavelId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "scoreTotal" DOUBLE PRECISION,
    "scoreCobertura" DOUBLE PRECISION,
    "scoreDetalhe" JSONB,
    "premissas" JSONB,
    "observacoes" TEXT,
    "arquivado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Terreno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDueDiligence" (
    "id" TEXT NOT NULL,
    "terrenoId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "categoria" "CategoriaDD" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "critico" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusItemDD" NOT NULL DEFAULT 'PENDENTE',
    "responsavelId" TEXT,
    "prazo" TIMESTAMP(3),
    "observacao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "concluidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemDueDiligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nota" (
    "id" TEXT NOT NULL,
    "terrenoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" "TipoNota" NOT NULL DEFAULT 'NOTA',
    "corpo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "terrenoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "categoria" "CategoriaDD",
    "adicionadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "terrenoId" TEXT,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "detalhe" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "pesos" JSONB NOT NULL,
    "premissas" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPor" TEXT,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Convite_email_key" ON "Convite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Terreno_codigo_key" ON "Terreno"("codigo");

-- CreateIndex
CREATE INDEX "Terreno_status_idx" ON "Terreno"("status");

-- CreateIndex
CREATE INDEX "Terreno_zona_idx" ON "Terreno"("zona");

-- CreateIndex
CREATE INDEX "Terreno_scoreTotal_idx" ON "Terreno"("scoreTotal");

-- CreateIndex
CREATE INDEX "Terreno_arquivado_status_idx" ON "Terreno"("arquivado", "status");

-- CreateIndex
CREATE INDEX "ItemDueDiligence_terrenoId_categoria_idx" ON "ItemDueDiligence"("terrenoId", "categoria");

-- CreateIndex
CREATE INDEX "ItemDueDiligence_status_idx" ON "ItemDueDiligence"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ItemDueDiligence_terrenoId_chave_key" ON "ItemDueDiligence"("terrenoId", "chave");

-- CreateIndex
CREATE INDEX "Nota_terrenoId_createdAt_idx" ON "Nota"("terrenoId", "createdAt");

-- CreateIndex
CREATE INDEX "Documento_terrenoId_idx" ON "Documento"("terrenoId");

-- CreateIndex
CREATE INDEX "Evento_terrenoId_createdAt_idx" ON "Evento"("terrenoId", "createdAt");

-- CreateIndex
CREATE INDEX "Evento_createdAt_idx" ON "Evento"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terreno" ADD CONSTRAINT "Terreno_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terreno" ADD CONSTRAINT "Terreno_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDueDiligence" ADD CONSTRAINT "ItemDueDiligence_terrenoId_fkey" FOREIGN KEY ("terrenoId") REFERENCES "Terreno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDueDiligence" ADD CONSTRAINT "ItemDueDiligence_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_terrenoId_fkey" FOREIGN KEY ("terrenoId") REFERENCES "Terreno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_terrenoId_fkey" FOREIGN KEY ("terrenoId") REFERENCES "Terreno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_adicionadoPorId_fkey" FOREIGN KEY ("adicionadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_terrenoId_fkey" FOREIGN KEY ("terrenoId") REFERENCES "Terreno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
