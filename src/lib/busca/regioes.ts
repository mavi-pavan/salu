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
  /** Linhas que passam pela região — contexto para quem escolhe onde procurar. */
  eixos: string[];
  /**
   * Estações que ancoram o eixo dentro da região, e é o que o anúncio cita.
   *
   * A ZEU é uma faixa em torno da estação, não o bairro inteiro: procurar
   * "Vila Mariana" traz o bairro todo, procurar "estação Praça da Árvore" traz
   * quem está na faixa. Anúncio de terreno de incorporação quase sempre
   * menciona a estação — é o argumento de venda.
   *
   * Lista curada, não oficial. Estação errada só gasta uma consulta à toa;
   * editar aqui é o suficiente para corrigir.
   */
  estacoes: string[];
}

export const REGIOES: Regiao[] = [
  // --- Centro ---
  { nome: "Santa Cecília", setor: "Centro", eixos: ["Linha 3-Vermelha", "Linha 7/11-CPTM"] , estacoes: ["Santa Cecília", "Marechal Deodoro"] },
  { nome: "Consolação", setor: "Centro", eixos: ["Linha 2-Verde", "Linha 4-Amarela"] , estacoes: ["Consolação", "Paulista"] },
  { nome: "Higienópolis", setor: "Centro", eixos: ["Linha 4-Amarela"] , estacoes: ["Higienópolis-Mackenzie"] },
  { nome: "República", setor: "Centro", eixos: ["Linha 3-Vermelha", "Linha 4-Amarela"] , estacoes: ["República", "Anhangabaú"] },
  { nome: "Bela Vista", setor: "Centro", eixos: ["Linha 2-Verde"] , estacoes: ["Trianon-Masp", "Brigadeiro"] },
  { nome: "Liberdade", setor: "Centro", eixos: ["Linha 1-Azul"] , estacoes: ["Liberdade", "São Joaquim"] },
  { nome: "Aclimação", setor: "Centro", eixos: ["Linha 1-Azul"] , estacoes: ["Vergueiro", "São Joaquim"] },
  { nome: "Campos Elíseos", setor: "Centro", eixos: ["Linha 7/11-CPTM"] , estacoes: ["Luz", "Júlio Prestes"] },
  { nome: "Barra Funda", setor: "Centro", eixos: ["Linha 3-Vermelha", "Linha 8/7-CPTM"] , estacoes: ["Palmeiras-Barra Funda", "Marechal Deodoro"] },

  // --- Zona Sul ---
  { nome: "Vila Mariana", setor: "Zona Sul", eixos: ["Linha 1-Azul", "Linha 2-Verde"] , estacoes: ["Vila Mariana", "Ana Rosa", "Santa Cruz"] },
  { nome: "Paraíso", setor: "Zona Sul", eixos: ["Linha 1-Azul", "Linha 2-Verde"] , estacoes: ["Paraíso", "Brigadeiro"] },
  { nome: "Ana Rosa", setor: "Zona Sul", eixos: ["Linha 1-Azul", "Linha 2-Verde"] , estacoes: ["Ana Rosa", "Chácara Klabin"] },
  { nome: "Saúde", setor: "Zona Sul", eixos: ["Linha 1-Azul"] , estacoes: ["Saúde", "Praça da Árvore"] },
  { nome: "Praça da Árvore", setor: "Zona Sul", eixos: ["Linha 1-Azul"] , estacoes: ["Praça da Árvore"] },
  { nome: "Jabaquara", setor: "Zona Sul", eixos: ["Linha 1-Azul"] , estacoes: ["Jabaquara", "Conceição", "São Judas"] },
  { nome: "Cursino", setor: "Zona Sul", eixos: ["Linha 2-Verde"] , estacoes: ["Alto do Ipiranga", "Santos-Imigrantes"] },
  { nome: "Ipiranga", setor: "Zona Sul", eixos: ["Linha 10-CPTM", "Linha 2-Verde"] , estacoes: ["Ipiranga", "Alto do Ipiranga", "Tamanduateí"] },
  { nome: "Sacomã", setor: "Zona Sul", eixos: ["Linha 2-Verde"] , estacoes: ["Sacomã"] },
  { nome: "Moema", setor: "Zona Sul", eixos: ["Linha 5-Lilás"] , estacoes: ["Moema", "Eucaliptos", "AACD-Servidor"] },
  { nome: "Campo Belo", setor: "Zona Sul", eixos: ["Linha 5-Lilás"] , estacoes: ["Campo Belo", "Brooklin"] },
  { nome: "Brooklin", setor: "Zona Sul", eixos: ["Linha 5-Lilás", "Linha 9-CPTM"] , estacoes: ["Brooklin", "Borba Gato", "Berrini"] },
  { nome: "Santo Amaro", setor: "Zona Sul", eixos: ["Linha 5-Lilás", "Linha 9-CPTM"] , estacoes: ["Santo Amaro", "Largo Treze", "Adolfo Pinheiro"] },
  { nome: "Vila Olímpia", setor: "Zona Sul", eixos: ["Linha 9-CPTM"] , estacoes: ["Vila Olímpia", "Berrini"] },
  { nome: "Chácara Santo Antônio", setor: "Zona Sul", eixos: ["Linha 9-CPTM"] , estacoes: ["João Dias", "Santo Amaro"] },
  { nome: "Granja Julieta", setor: "Zona Sul", eixos: ["Linha 9-CPTM"] , estacoes: ["Granja Julieta"] },
  { nome: "Jurubatuba", setor: "Zona Sul", eixos: ["Linha 9-CPTM"] , estacoes: ["Jurubatuba", "Socorro"] },
  { nome: "Campo Limpo", setor: "Zona Sul", eixos: ["Linha 5-Lilás"] , estacoes: ["Campo Limpo", "Vila das Belezas"] },
  { nome: "Capão Redondo", setor: "Zona Sul", eixos: ["Linha 5-Lilás"] , estacoes: ["Capão Redondo"] },
  { nome: "Vila Sônia", setor: "Zona Sul", eixos: ["Linha 4-Amarela"] , estacoes: ["Vila Sônia", "São Paulo-Morumbi"] },

  // --- Zona Oeste ---
  { nome: "Pinheiros", setor: "Zona Oeste", eixos: ["Linha 4-Amarela", "Linha 9-CPTM"] , estacoes: ["Pinheiros", "Faria Lima", "Fradique Coutinho"] },
  { nome: "Vila Madalena", setor: "Zona Oeste", eixos: ["Linha 2-Verde"] , estacoes: ["Vila Madalena", "Sumaré"] },
  { nome: "Sumaré", setor: "Zona Oeste", eixos: ["Linha 2-Verde"] , estacoes: ["Sumaré", "Clínicas"] },
  { nome: "Perdizes", setor: "Zona Oeste", eixos: ["Linha 2-Verde"] , estacoes: ["Perdizes", "Clínicas"] },
  { nome: "Pompeia", setor: "Zona Oeste", eixos: ["Linha 6-Laranja (obra)"] , estacoes: ["Água Branca", "Perdizes"] },
  { nome: "Água Branca", setor: "Zona Oeste", eixos: ["Linha 8-CPTM"] , estacoes: ["Água Branca", "Lapa"] },
  { nome: "Lapa", setor: "Zona Oeste", eixos: ["Linha 8-CPTM", "Linha 6-Laranja (obra)"] , estacoes: ["Lapa"] },
  { nome: "Vila Leopoldina", setor: "Zona Oeste", eixos: ["Linha 8-CPTM"] , estacoes: ["Imperatriz Leopoldina", "Ceasa"] },
  { nome: "Butantã", setor: "Zona Oeste", eixos: ["Linha 4-Amarela"] , estacoes: ["Butantã", "Cidade Universitária"] },
  { nome: "Rio Pequeno", setor: "Zona Oeste", eixos: ["Linha 4-Amarela"] , estacoes: ["Butantã"] },
  { nome: "Freguesia do Ó", setor: "Zona Oeste", eixos: ["Linha 6-Laranja (obra)"] , estacoes: ["Freguesia do Ó"] },

  // --- Zona Norte ---
  { nome: "Santana", setor: "Zona Norte", eixos: ["Linha 1-Azul"] , estacoes: ["Santana", "Carandiru"] },
  { nome: "Carandiru", setor: "Zona Norte", eixos: ["Linha 1-Azul"] , estacoes: ["Carandiru", "Portuguesa-Tietê"] },
  { nome: "Jardim São Paulo", setor: "Zona Norte", eixos: ["Linha 1-Azul"] , estacoes: ["Jardim São Paulo-Ayrosa Galvão", "Parada Inglesa"] },
  { nome: "Tucuruvi", setor: "Zona Norte", eixos: ["Linha 1-Azul"] , estacoes: ["Tucuruvi", "Parada Inglesa"] },
  { nome: "Casa Verde", setor: "Zona Norte", eixos: ["Linha 6-Laranja (obra)"] , estacoes: ["Santa Marina"] },
  { nome: "Vila Guilherme", setor: "Zona Norte", eixos: ["Linha 6-Laranja (obra)"] , estacoes: ["Portuguesa-Tietê"] },
  { nome: "Tremembé", setor: "Zona Norte", eixos: ["Linha 6-Laranja (obra)"] , estacoes: ["Tucuruvi"] },
  { nome: "Brasilândia", setor: "Zona Norte", eixos: ["Linha 6-Laranja (obra)"] , estacoes: ["Brasilândia", "Vila Cardoso"] },

  // --- Zona Leste ---
  { nome: "Tatuapé", setor: "Zona Leste", eixos: ["Linha 3-Vermelha", "Linha 11/12-CPTM"] , estacoes: ["Tatuapé", "Carrão"] },
  { nome: "Mooca", setor: "Zona Leste", eixos: ["Linha 3-Vermelha", "Linha 10-CPTM"] , estacoes: ["Bresser-Mooca", "Mooca"] },
  { nome: "Belém", setor: "Zona Leste", eixos: ["Linha 3-Vermelha"] , estacoes: ["Belém", "Bresser-Mooca"] },
  { nome: "Brás", setor: "Zona Leste", eixos: ["Linha 3-Vermelha", "Linha 10/11/12-CPTM"] , estacoes: ["Brás", "Pedro II"] },
  { nome: "Carrão", setor: "Zona Leste", eixos: ["Linha 3-Vermelha"] , estacoes: ["Carrão", "Penha"] },
  { nome: "Penha", setor: "Zona Leste", eixos: ["Linha 3-Vermelha"] , estacoes: ["Penha", "Vila Matilde"] },
  { nome: "Vila Matilde", setor: "Zona Leste", eixos: ["Linha 3-Vermelha"] , estacoes: ["Vila Matilde", "Guilhermina-Esperança"] },
  { nome: "Artur Alvim", setor: "Zona Leste", eixos: ["Linha 3-Vermelha"] , estacoes: ["Artur Alvim", "Patriarca"] },
  { nome: "Itaquera", setor: "Zona Leste", eixos: ["Linha 3-Vermelha", "Linha 11-CPTM"] , estacoes: ["Corinthians-Itaquera", "Dom Bosco"] },
  { nome: "Vila Prudente", setor: "Zona Leste", eixos: ["Linha 2-Verde", "Linha 15-Prata"] , estacoes: ["Vila Prudente", "Oratório"] },
  { nome: "Sapopemba", setor: "Zona Leste", eixos: ["Linha 15-Prata"] , estacoes: ["Sapopemba", "Fazenda da Juta"] },
  { nome: "São Mateus", setor: "Zona Leste", eixos: ["Linha 15-Prata"] , estacoes: ["São Mateus", "Jardim Colonial"] },
  { nome: "Guaianases", setor: "Zona Leste", eixos: ["Linha 11-CPTM"] , estacoes: ["Guaianases"] },
  { nome: "São Miguel Paulista", setor: "Zona Leste", eixos: ["Linha 12-CPTM"] , estacoes: ["São Miguel Paulista"] },
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
