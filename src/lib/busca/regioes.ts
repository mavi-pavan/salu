/**
 * Bairros de São Paulo com presença relevante de eixo (ZEU e equivalentes).
 *
 * Serve para montar as consultas de busca: portal de imóvel não entende
 * "ZEU", entende bairro. A lista é curada a partir dos corredores de metrô,
 * trem e monotrilho, que é onde os eixos foram desenhados.
 *
 * Não é uma lista oficial de perímetro de ZEU — é onde vale a pena procurar.
 * A confirmação de zona acontece depois, no cruzamento com o zoneamento.
 */

export interface Regiao {
  nome: string;
  setor: "Centro" | "Zona Sul" | "Zona Oeste" | "Zona Norte" | "Zona Leste";
  eixos: string[];
}

export const REGIOES: Regiao[] = [
  // --- Centro ---
  { nome: "Santa Cecília", setor: "Centro", eixos: ["Linha 3-Vermelha", "Linha 7/11-CPTM"] },
  { nome: "Consolação", setor: "Centro", eixos: ["Linha 2-Verde", "Linha 4-Amarela"] },
  { nome: "Higienópolis", setor: "Centro", eixos: ["Linha 4-Amarela"] },
  { nome: "República", setor: "Centro", eixos: ["Linha 3-Vermelha", "Linha 4-Amarela"] },
  { nome: "Bela Vista", setor: "Centro", eixos: ["Linha 2-Verde"] },
  { nome: "Liberdade", setor: "Centro", eixos: ["Linha 1-Azul"] },
  { nome: "Aclimação", setor: "Centro", eixos: ["Linha 1-Azul"] },
  { nome: "Campos Elíseos", setor: "Centro", eixos: ["Linha 7/11-CPTM"] },
  { nome: "Barra Funda", setor: "Centro", eixos: ["Linha 3-Vermelha", "Linha 8/7-CPTM"] },

  // --- Zona Sul ---
  { nome: "Vila Mariana", setor: "Zona Sul", eixos: ["Linha 1-Azul", "Linha 2-Verde"] },
  { nome: "Paraíso", setor: "Zona Sul", eixos: ["Linha 1-Azul", "Linha 2-Verde"] },
  { nome: "Ana Rosa", setor: "Zona Sul", eixos: ["Linha 1-Azul", "Linha 2-Verde"] },
  { nome: "Saúde", setor: "Zona Sul", eixos: ["Linha 1-Azul"] },
  { nome: "Praça da Árvore", setor: "Zona Sul", eixos: ["Linha 1-Azul"] },
  { nome: "Jabaquara", setor: "Zona Sul", eixos: ["Linha 1-Azul"] },
  { nome: "Cursino", setor: "Zona Sul", eixos: ["Linha 2-Verde"] },
  { nome: "Ipiranga", setor: "Zona Sul", eixos: ["Linha 10-CPTM", "Linha 2-Verde"] },
  { nome: "Sacomã", setor: "Zona Sul", eixos: ["Linha 2-Verde"] },
  { nome: "Moema", setor: "Zona Sul", eixos: ["Linha 5-Lilás"] },
  { nome: "Campo Belo", setor: "Zona Sul", eixos: ["Linha 5-Lilás"] },
  { nome: "Brooklin", setor: "Zona Sul", eixos: ["Linha 5-Lilás", "Linha 9-CPTM"] },
  { nome: "Santo Amaro", setor: "Zona Sul", eixos: ["Linha 5-Lilás", "Linha 9-CPTM"] },
  { nome: "Vila Olímpia", setor: "Zona Sul", eixos: ["Linha 9-CPTM"] },
  { nome: "Chácara Santo Antônio", setor: "Zona Sul", eixos: ["Linha 9-CPTM"] },
  { nome: "Granja Julieta", setor: "Zona Sul", eixos: ["Linha 9-CPTM"] },
  { nome: "Jurubatuba", setor: "Zona Sul", eixos: ["Linha 9-CPTM"] },
  { nome: "Campo Limpo", setor: "Zona Sul", eixos: ["Linha 5-Lilás"] },
  { nome: "Capão Redondo", setor: "Zona Sul", eixos: ["Linha 5-Lilás"] },
  { nome: "Vila Sônia", setor: "Zona Sul", eixos: ["Linha 4-Amarela"] },

  // --- Zona Oeste ---
  { nome: "Pinheiros", setor: "Zona Oeste", eixos: ["Linha 4-Amarela", "Linha 9-CPTM"] },
  { nome: "Vila Madalena", setor: "Zona Oeste", eixos: ["Linha 2-Verde"] },
  { nome: "Sumaré", setor: "Zona Oeste", eixos: ["Linha 2-Verde"] },
  { nome: "Perdizes", setor: "Zona Oeste", eixos: ["Linha 2-Verde"] },
  { nome: "Pompeia", setor: "Zona Oeste", eixos: ["Linha 6-Laranja (obra)"] },
  { nome: "Água Branca", setor: "Zona Oeste", eixos: ["Linha 8-CPTM"] },
  { nome: "Lapa", setor: "Zona Oeste", eixos: ["Linha 8-CPTM", "Linha 6-Laranja (obra)"] },
  { nome: "Vila Leopoldina", setor: "Zona Oeste", eixos: ["Linha 8-CPTM"] },
  { nome: "Butantã", setor: "Zona Oeste", eixos: ["Linha 4-Amarela"] },
  { nome: "Rio Pequeno", setor: "Zona Oeste", eixos: ["Linha 4-Amarela"] },
  { nome: "Freguesia do Ó", setor: "Zona Oeste", eixos: ["Linha 6-Laranja (obra)"] },

  // --- Zona Norte ---
  { nome: "Santana", setor: "Zona Norte", eixos: ["Linha 1-Azul"] },
  { nome: "Carandiru", setor: "Zona Norte", eixos: ["Linha 1-Azul"] },
  { nome: "Jardim São Paulo", setor: "Zona Norte", eixos: ["Linha 1-Azul"] },
  { nome: "Tucuruvi", setor: "Zona Norte", eixos: ["Linha 1-Azul"] },
  { nome: "Casa Verde", setor: "Zona Norte", eixos: ["Linha 6-Laranja (obra)"] },
  { nome: "Vila Guilherme", setor: "Zona Norte", eixos: ["Linha 6-Laranja (obra)"] },
  { nome: "Tremembé", setor: "Zona Norte", eixos: ["Linha 6-Laranja (obra)"] },
  { nome: "Brasilândia", setor: "Zona Norte", eixos: ["Linha 6-Laranja (obra)"] },

  // --- Zona Leste ---
  { nome: "Tatuapé", setor: "Zona Leste", eixos: ["Linha 3-Vermelha", "Linha 11/12-CPTM"] },
  { nome: "Mooca", setor: "Zona Leste", eixos: ["Linha 3-Vermelha", "Linha 10-CPTM"] },
  { nome: "Belém", setor: "Zona Leste", eixos: ["Linha 3-Vermelha"] },
  { nome: "Brás", setor: "Zona Leste", eixos: ["Linha 3-Vermelha", "Linha 10/11/12-CPTM"] },
  { nome: "Carrão", setor: "Zona Leste", eixos: ["Linha 3-Vermelha"] },
  { nome: "Penha", setor: "Zona Leste", eixos: ["Linha 3-Vermelha"] },
  { nome: "Vila Matilde", setor: "Zona Leste", eixos: ["Linha 3-Vermelha"] },
  { nome: "Artur Alvim", setor: "Zona Leste", eixos: ["Linha 3-Vermelha"] },
  { nome: "Itaquera", setor: "Zona Leste", eixos: ["Linha 3-Vermelha", "Linha 11-CPTM"] },
  { nome: "Vila Prudente", setor: "Zona Leste", eixos: ["Linha 2-Verde", "Linha 15-Prata"] },
  { nome: "Sapopemba", setor: "Zona Leste", eixos: ["Linha 15-Prata"] },
  { nome: "São Mateus", setor: "Zona Leste", eixos: ["Linha 15-Prata"] },
  { nome: "Guaianases", setor: "Zona Leste", eixos: ["Linha 11-CPTM"] },
  { nome: "São Miguel Paulista", setor: "Zona Leste", eixos: ["Linha 12-CPTM"] },
];

export const SETORES = ["Centro", "Zona Sul", "Zona Oeste", "Zona Norte", "Zona Leste"] as const;

export function regioesPorSetor() {
  return SETORES.map((setor) => ({
    setor,
    regioes: REGIOES.filter((r) => r.setor === setor),
  }));
}

const NOMES_NORMALIZADOS = REGIOES.map((r) => ({
  nome: r.nome,
  normalizado: normalizar(r.nome),
}));

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Encontra no texto do anúncio um bairro conhecido. */
export function detectarRegiao(texto: string): string | null {
  const alvo = normalizar(texto);
  // Nomes longos primeiro: "Chácara Santo Antônio" antes de "Santo Amaro".
  const ordenados = [...NOMES_NORMALIZADOS].sort(
    (a, b) => b.normalizado.length - a.normalizado.length,
  );
  for (const r of ordenados) {
    if (alvo.includes(r.normalizado)) return r.nome;
  }
  return null;
}
