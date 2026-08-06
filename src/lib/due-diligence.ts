/**
 * Checklist padrão de due diligence de terreno urbano em São Paulo.
 *
 * Toda vez que um terreno é criado, esta lista é instanciada para ele. As
 * chaves são estáveis: se a lista mudar depois, os itens já existentes
 * continuam válidos e os novos são adicionados sem duplicar (ver
 * `sincronizarChecklist` em server/terrenos.ts).
 *
 * `critico: true` marca o item que, sozinho, derruba o negócio.
 */

import type { CategoriaDD } from "./enums";

export interface ItemTemplate {
  chave: string;
  categoria: CategoriaDD;
  titulo: string;
  descricao?: string;
  critico?: boolean;
}

export const CHECKLIST_PADRAO: ItemTemplate[] = [
  // --- Documental / cartorial ---
  {
    chave: "matricula_atualizada",
    categoria: "DOCUMENTAL",
    titulo: "Matrícula atualizada (até 30 dias)",
    descricao: "Certidão de inteiro teor de todas as matrículas que compõem o terreno.",
    critico: true,
  },
  {
    chave: "onus_reais",
    categoria: "DOCUMENTAL",
    titulo: "Certidão de ônus reais e ações reipersecutórias",
    descricao: "Hipoteca, penhora, alienação fiduciária, indisponibilidade.",
    critico: true,
  },
  {
    chave: "cadeia_dominial",
    categoria: "DOCUMENTAL",
    titulo: "Cadeia dominial dos últimos 20 anos",
    descricao: "Verificar aquisições a non domino e transmissões suspeitas.",
  },
  {
    chave: "iptu_quitado",
    categoria: "DOCUMENTAL",
    titulo: "IPTU quitado e valor venal",
    descricao: "Certidão negativa de tributos mobiliários e imobiliários do imóvel.",
  },
  {
    chave: "conferencia_area",
    categoria: "DOCUMENTAL",
    titulo: "Área da matrícula x área real x área do IPTU",
    descricao: "Divergência de área é motivo comum de retificação demorada.",
    critico: true,
  },
  {
    chave: "unificacao_lotes",
    categoria: "DOCUMENTAL",
    titulo: "Viabilidade de unificação dos lotes",
    descricao: "Necessário quando o terreno é composto por mais de uma matrícula.",
  },

  // --- Vendedor ---
  {
    chave: "certidoes_pessoais",
    categoria: "VENDEDOR",
    titulo: "Certidões dos vendedores (cível, fiscal, trabalhista, criminal)",
    descricao: "Distribuidores das comarcas de domicílio e da situação do imóvel, últimos 10 anos.",
    critico: true,
  },
  {
    chave: "estado_civil",
    categoria: "VENDEDOR",
    titulo: "Estado civil, pacto antenupcial e anuência conjugal",
  },
  {
    chave: "pj_societario",
    categoria: "VENDEDOR",
    titulo: "Se PJ: contrato social, poderes de representação, CND federal e FGTS",
  },
  {
    chave: "fraude_execucao",
    categoria: "VENDEDOR",
    titulo: "Análise de fraude à execução / insolvência",
    descricao: "Cruzar patrimônio remanescente do vendedor com passivos identificados.",
    critico: true,
  },

  // --- Urbanístico ---
  {
    chave: "zoneamento_confirmado",
    categoria: "URBANISTICO",
    titulo: "Zoneamento confirmado no GeoSampa pelo nº do contribuinte",
    descricao: "Conferir ZEU/ZEUa/ZEUP e o perímetro de eixo vigente após as Leis 18.081/2024 e 18.177/2024.",
    critico: true,
  },
  {
    chave: "certidao_zoneamento",
    categoria: "URBANISTICO",
    titulo: "Certidão de zoneamento emitida pela SMUL",
    descricao: "Documento oficial com os parâmetros do lote. Não confiar apenas no mapa.",
    critico: true,
  },
  {
    chave: "melhoramento_viario",
    categoria: "URBANISTICO",
    titulo: "Melhoramentos viários e desapropriações incidentes",
    descricao: "Consultar quadro de melhoramentos e alinhamento viário na SIURB/SMT.",
    critico: true,
  },
  {
    chave: "tombamento",
    categoria: "URBANISTICO",
    titulo: "Tombamento e ZEPEC (CONPRESP, CONDEPHAAT, IPHAN)",
    descricao: "Incluir imóveis vizinhos: entorno de bem tombado gera restrição de gabarito.",
    critico: true,
  },
  {
    chave: "levantamento_planialtimetrico",
    categoria: "URBANISTICO",
    titulo: "Levantamento planialtimétrico cadastral",
    descricao: "Base para estudo de massa e conferência de área real.",
  },
  {
    chave: "estudo_massa",
    categoria: "URBANISTICO",
    titulo: "Estudo de massa preliminar do arquiteto",
    descricao: "Valida o potencial construtivo real considerando recuos, TO e gabarito.",
    critico: true,
  },
  {
    chave: "consulta_diretrizes",
    categoria: "URBANISTICO",
    titulo: "Consulta de diretrizes (SMUL/CET/SIURB)",
    descricao: "Polo gerador de tráfego, acessos e exigências de sistema viário.",
  },
  {
    chave: "edificacao_existente",
    categoria: "URBANISTICO",
    titulo: "Situação da edificação existente (habite-se, alvarás, regularidade)",
  },

  // --- Ambiental ---
  {
    chave: "area_contaminada",
    categoria: "AMBIENTAL",
    titulo: "Consulta de área contaminada (CETESB / SVMA)",
    descricao: "Histórico de posto de combustível, indústria, oficina, tinturaria ou aterro.",
    critico: true,
  },
  {
    chave: "investigacao_ambiental",
    categoria: "AMBIENTAL",
    titulo: "Investigação preliminar/confirmatória, se houver suspeita",
    descricao: "Remediação pode custar mais que o terreno e travar o licenciamento por anos.",
  },
  {
    chave: "app_curso_dagua",
    categoria: "AMBIENTAL",
    titulo: "APP, córrego canalizado, nascente e faixa non aedificandi",
  },
  {
    chave: "vegetacao",
    categoria: "AMBIENTAL",
    titulo: "Inventário arbóreo e compensação ambiental",
    descricao: "Exemplares tombados ou espécies protegidas alteram a implantação.",
  },
  {
    chave: "quota_ambiental",
    categoria: "AMBIENTAL",
    titulo: "Quota ambiental — pontuação exigida para o lote",
    descricao: "Impacta permeabilidade, cobertura vegetal e custo de paisagismo.",
  },

  // --- Infraestrutura ---
  {
    chave: "viabilidade_enel",
    categoria: "INFRAESTRUTURA",
    titulo: "Viabilidade de energia (Enel) para a carga prevista",
  },
  {
    chave: "viabilidade_sabesp",
    categoria: "INFRAESTRUTURA",
    titulo: "Viabilidade de água e esgoto (Sabesp)",
  },
  {
    chave: "drenagem_geotecnia",
    categoria: "INFRAESTRUTURA",
    titulo: "Sondagem geotécnica e histórico de alagamento",
    descricao: "Lençol freático alto inviabiliza subsolo e muda a conta da garagem.",
  },

  // --- Comercial ---
  {
    chave: "proposta_assinada",
    categoria: "COMERCIAL",
    titulo: "Proposta / opção de compra assinada",
  },
  {
    chave: "condicoes_pagamento",
    categoria: "COMERCIAL",
    titulo: "Estrutura de pagamento: permuta, sinal, prazo e condição suspensiva",
    descricao: "Condição suspensiva de aprovação do projeto é o principal mitigador de risco.",
  },
  {
    chave: "comissao_corretagem",
    categoria: "COMERCIAL",
    titulo: "Comissão de corretagem definida por escrito",
  },
  {
    chave: "pesquisa_mercado",
    categoria: "COMERCIAL",
    titulo: "Pesquisa de mercado da região (lançamentos e preço/m²)",
    descricao: "Valida a premissa de preço de venda usada na viabilidade.",
  },

  // --- Financeiro / tributário ---
  {
    chave: "outorga_estimada",
    categoria: "FINANCEIRO",
    titulo: "Outorga onerosa estimada com valor do Quadro 14",
    descricao: "Confirmar o valor de m² do Cadastro de Valor de Terreno para o setor/quadra.",
  },
  {
    chave: "itbi_cartorio",
    categoria: "FINANCEIRO",
    titulo: "ITBI e custos de cartório estimados",
    descricao: "ITBI de 3% sobre o maior valor entre o de transação e o venal de referência.",
  },
  {
    chave: "viabilidade_aprovada",
    categoria: "FINANCEIRO",
    titulo: "Viabilidade econômica aprovada pelos sócios",
    critico: true,
  },
];

export const TOTAL_ITENS_CHECKLIST = CHECKLIST_PADRAO.length;

export function itensPorCategoria(): Array<{ categoria: CategoriaDD; itens: ItemTemplate[] }> {
  const mapa = new Map<CategoriaDD, ItemTemplate[]>();
  for (const item of CHECKLIST_PADRAO) {
    const lista = mapa.get(item.categoria) ?? [];
    lista.push(item);
    mapa.set(item.categoria, lista);
  }
  return [...mapa.entries()].map(([categoria, itens]) => ({ categoria, itens }));
}
