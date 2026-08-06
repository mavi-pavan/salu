/**
 * Seed do banco.
 *
 * Roda com `npm run db:seed`. É idempotente: cria a configuração e o
 * administrador sempre, e os terrenos de exemplo só quando a tabela está
 * vazia — assim dá para rodar de novo em produção sem duplicar nada.
 *
 * Para subir um ambiente limpo, sem os exemplos: SEED_EXEMPLOS=false npm run db:seed
 */

import { PrismaClient, type Prisma } from "@prisma/client";

import { CHECKLIST_PADRAO } from "../src/lib/due-diligence";
import { calcularScore, PESOS_PADRAO } from "../src/lib/scoring";
import { PREMISSAS_PADRAO } from "../src/lib/viabilidade";
import type { ZonaChave } from "../src/lib/zeu";

const prisma = new PrismaClient();

function itensChecklist() {
  return CHECKLIST_PADRAO.map((item, indice) => ({
    chave: item.chave,
    categoria: item.categoria,
    titulo: item.titulo,
    descricao: item.descricao ?? null,
    critico: item.critico ?? false,
    ordem: indice,
  }));
}

/** Endereços reais de corredor de eixo, com números e preços fictícios. */
const EXEMPLOS = [
  {
    codigo: "TER-0001",
    apelido: "Esquina Domingos de Morais x Luís Góis",
    logradouro: "Rua Domingos de Morais",
    numero: "1842",
    bairro: "Vila Mariana",
    distrito: "Vila Mariana",
    cep: "04010-100",
    latitude: -23.5876,
    longitude: -46.6371,
    sqlContribuinte: "040.123.0045-6",
    zona: "ZEU" as ZonaChave,
    areaTerreno: 1480,
    testada: 32,
    profundidade: 46,
    numeroLotes: 2,
    numeroMatriculas: 2,
    topografia: "PLANA" as const,
    ocupacao: "EDIFICACAO_SIMPLES" as const,
    estacaoProxima: "Estação Santa Cruz",
    linhaTransporte: "Linha 1-Azul / Linha 5-Lilás",
    distanciaEstacaoM: 380,
    precoPedido: 5_900_000,
    valorVenalM2: 2_800,
    origem: "CORRETOR" as const,
    motivacaoVendedor: "ALTA" as const,
    situacaoDocumental: "REGULAR" as const,
    status: "EM_ANALISE" as const,
    contatoNome: "Imobiliária Paulista",
    contatoTelefone: "(11) 99999-0001",
    observacoes:
      "Duas matrículas contíguas, mesmo proprietário. Sobrado antigo em uma delas, demolição simples. Vendedor com pressa por inventário concluído.",
  },
  {
    codigo: "TER-0002",
    apelido: "Terreno Av. Jabaquara",
    logradouro: "Avenida Jabaquara",
    numero: "2210",
    bairro: "Saúde",
    distrito: "Saúde",
    cep: "04046-500",
    latitude: -23.6205,
    longitude: -46.6389,
    sqlContribuinte: "045.078.0012-3",
    zona: "ZEU" as ZonaChave,
    areaTerreno: 2350,
    testada: 44,
    profundidade: 53,
    numeroLotes: 1,
    numeroMatriculas: 1,
    topografia: "ACLIVE_LEVE" as const,
    ocupacao: "VAZIO" as const,
    estacaoProxima: "Estação Praça da Árvore",
    linhaTransporte: "Linha 1-Azul",
    distanciaEstacaoM: 520,
    precoPedido: 8_200_000,
    valorVenalM2: 2_400,
    aceitaPermuta: true,
    percentualPermuta: 25,
    origem: "PROPRIETARIO" as const,
    motivacaoVendedor: "MEDIA" as const,
    situacaoDocumental: "REGULAR" as const,
    status: "VISITADO" as const,
    observacoes:
      "Terreno limpo, murado, sem benfeitorias. Proprietário aceita 25% em permuta. Melhor relação preço/potencial do funil até agora.",
  },
  {
    codigo: "TER-0003",
    apelido: "Antigo galpão da Mooca",
    logradouro: "Rua da Mooca",
    numero: "3450",
    bairro: "Mooca",
    distrito: "Mooca",
    cep: "03104-002",
    latitude: -23.5561,
    longitude: -46.5943,
    sqlContribuinte: "030.451.0089-0",
    zona: "ZEUP" as ZonaChave,
    areaTerreno: 3100,
    testada: 58,
    profundidade: 54,
    numeroLotes: 1,
    numeroMatriculas: 1,
    topografia: "PLANA" as const,
    ocupacao: "EDIFICACAO_RELEVANTE" as const,
    estacaoProxima: "Estação Mooca (CPTM)",
    linhaTransporte: "Linha 10-Turquesa",
    distanciaEstacaoM: 640,
    precoPedido: 11_500_000,
    valorVenalM2: 2_100,
    origem: "PROSPECCAO_ATIVA" as const,
    motivacaoVendedor: "BAIXA" as const,
    situacaoDocumental: "PENDENCIA_SIMPLES" as const,
    areaContaminada: true,
    status: "DUE_DILIGENCE" as const,
    restricoesObservacao:
      "Uso industrial por 40 anos (metalúrgica). Exigir investigação confirmatória antes de qualquer proposta vinculante.",
    observacoes:
      "Galpão íntegro, demolição cara. Eixo previsto: confirmar cronograma antes de precificar pelo CA 4.",
  },
  {
    codigo: "TER-0004",
    apelido: "Casa Tucuruvi (perto da estação)",
    logradouro: "Avenida Nova Cantareira",
    numero: "1180",
    bairro: "Tucuruvi",
    distrito: "Tucuruvi",
    cep: "02330-001",
    latitude: -23.4795,
    longitude: -46.6021,
    zona: "ZEU" as ZonaChave,
    areaTerreno: 620,
    testada: 14,
    profundidade: 44,
    numeroLotes: 1,
    numeroMatriculas: 1,
    topografia: "PLANA" as const,
    ocupacao: "ALUGADO" as const,
    estacaoProxima: "Estação Tucuruvi",
    linhaTransporte: "Linha 1-Azul",
    distanciaEstacaoM: 240,
    precoPedido: 2_100_000,
    origem: "PORTAL" as const,
    motivacaoVendedor: "NAO_INFORMADO" as const,
    situacaoDocumental: "ESPOLIO_INVENTARIO" as const,
    status: "NOVO" as const,
    observacoes:
      "Testada curta demais para torre isolada. Só faz sentido junto com o vizinho — verificar disposição do lote ao lado.",
  },
  {
    codigo: "TER-0005",
    apelido: "Lote Santo Amaro (fora de eixo)",
    logradouro: "Rua Barão de Duprat",
    numero: "455",
    bairro: "Santo Amaro",
    distrito: "Santo Amaro",
    zona: "ZC" as ZonaChave,
    areaTerreno: 900,
    testada: 20,
    numeroLotes: 1,
    numeroMatriculas: 1,
    topografia: "DECLIVE_LEVE" as const,
    ocupacao: "VAZIO" as const,
    estacaoProxima: "Estação Largo Treze",
    linhaTransporte: "Linha 5-Lilás",
    distanciaEstacaoM: 900,
    precoPedido: 4_500_000,
    origem: "CORRETOR" as const,
    motivacaoVendedor: "MEDIA" as const,
    situacaoDocumental: "REGULAR" as const,
    status: "DESCARTADO" as const,
    observacoes:
      "Fora do perímetro de eixo — CA máximo 2. Preço pedido de terreno de eixo. Descartado na triagem.",
  },
];

async function main() {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const emailAdmin = emails[0] ?? "admin@exemplo.com";

  const admin = await prisma.user.upsert({
    where: { email: emailAdmin },
    update: { papel: "ADMIN", ativo: true },
    create: { email: emailAdmin, name: "Administrador", papel: "ADMIN" },
  });
  console.log(`Administrador: ${admin.email}`);

  await prisma.configuracao.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      pesos: PESOS_PADRAO as unknown as Prisma.InputJsonValue,
      premissas: PREMISSAS_PADRAO as unknown as Prisma.InputJsonValue,
      atualizadoPor: admin.id,
    },
  });
  console.log("Configuração global pronta.");

  if (process.env.SEED_EXEMPLOS === "false") {
    console.log("SEED_EXEMPLOS=false — pulando terrenos de exemplo.");
    return;
  }

  const existentes = await prisma.terreno.count();
  if (existentes > 0) {
    console.log(`${existentes} terreno(s) já cadastrados — exemplos não foram inseridos.`);
    return;
  }

  for (const exemplo of EXEMPLOS) {
    const score = calcularScore(
      {
        zona: exemplo.zona,
        areaTerreno: exemplo.areaTerreno,
        testada: exemplo.testada,
        precoPedido: exemplo.precoPedido,
        distanciaEstacaoM: exemplo.distanciaEstacaoM,
        topografia: exemplo.topografia,
        ocupacao: exemplo.ocupacao,
        situacaoDocumental: exemplo.situacaoDocumental,
        motivacaoVendedor: exemplo.motivacaoVendedor,
        areaContaminada: exemplo.areaContaminada ?? false,
      },
      PESOS_PADRAO,
    );

    await prisma.terreno.create({
      data: {
        ...exemplo,
        criadoPorId: admin.id,
        responsavelId: admin.id,
        scoreTotal: score.total,
        scoreCobertura: score.cobertura,
        scoreDetalhe: score as unknown as Prisma.InputJsonValue,
        itensDD: { create: itensChecklist() },
        notas: {
          create: {
            autorId: admin.id,
            tipo: "NOTA",
            corpo: "Terreno de exemplo criado pelo seed. Pode apagar quando o funil real começar.",
          },
        },
      },
    });
    console.log(`  ${exemplo.codigo} — ${exemplo.apelido} (score ${score.total})`);
  }

  await prisma.evento.create({
    data: { usuarioId: admin.id, acao: "seed.executado", detalhe: { terrenos: EXEMPLOS.length } },
  });

  console.log(`\n${EXEMPLOS.length} terrenos de exemplo criados.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
