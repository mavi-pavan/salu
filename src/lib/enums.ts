/**
 * Enums do domínio + rótulos em português.
 *
 * Duplicam de propósito os enums do Prisma: as bibliotecas de cálculo
 * (scoring, viabilidade) ficam puras, sem importar o client do Prisma, o que
 * mantém os testes rápidos e permite usar essas funções no browser. Os valores
 * são idênticos aos do schema, então os tipos são mutuamente atribuíveis.
 */

export type Papel = "ADMIN" | "MEMBRO" | "LEITOR";

export type StatusPipeline =
  | "NOVO"
  | "EM_ANALISE"
  | "VISITADO"
  | "PROPOSTA_ENVIADA"
  | "EM_NEGOCIACAO"
  | "DUE_DILIGENCE"
  | "CONTRATADO"
  | "DESCARTADO"
  | "PERDIDO";

export type Topografia =
  | "PLANA"
  | "ACLIVE_LEVE"
  | "DECLIVE_LEVE"
  | "ACLIVE_ACENTUADO"
  | "DECLIVE_ACENTUADO"
  | "IRREGULAR"
  | "NAO_INFORMADO";

export type Ocupacao =
  | "VAZIO"
  | "EDIFICACAO_SIMPLES"
  | "EDIFICACAO_RELEVANTE"
  | "ALUGADO"
  | "OCUPACAO_IRREGULAR"
  | "NAO_INFORMADO";

export type SituacaoDocumental =
  | "REGULAR"
  | "PENDENCIA_SIMPLES"
  | "ESPOLIO_INVENTARIO"
  | "LITIGIO_USUCAPIAO"
  | "NAO_INFORMADO";

export type OrigemLead =
  | "CORRETOR"
  | "PROPRIETARIO"
  | "PORTAL"
  | "PROSPECCAO_ATIVA"
  | "INDICACAO"
  | "OUTRA";

export type Motivacao = "ALTA" | "MEDIA" | "BAIXA" | "NAO_INFORMADO";

export type CategoriaDD =
  | "DOCUMENTAL"
  | "VENDEDOR"
  | "URBANISTICO"
  | "AMBIENTAL"
  | "INFRAESTRUTURA"
  | "COMERCIAL"
  | "FINANCEIRO";

export type StatusItemDD =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "OK"
  | "PROBLEMA"
  | "NAO_APLICAVEL";

export type TipoNota = "NOTA" | "VISITA" | "LIGACAO" | "REUNIAO" | "PROPOSTA";

export interface Opcao<T extends string> {
  valor: T;
  rotulo: string;
}

function opcoes<T extends string>(mapa: Record<T, string>): Opcao<T>[] {
  return (Object.keys(mapa) as T[]).map((valor) => ({ valor, rotulo: mapa[valor] }));
}

export const PAPEL_ROTULO: Record<Papel, string> = {
  ADMIN: "Administrador",
  MEMBRO: "Membro",
  LEITOR: "Leitor",
};

export const STATUS_ROTULO: Record<StatusPipeline, string> = {
  NOVO: "Novo",
  EM_ANALISE: "Em análise",
  VISITADO: "Visitado",
  PROPOSTA_ENVIADA: "Proposta enviada",
  EM_NEGOCIACAO: "Em negociação",
  DUE_DILIGENCE: "Due diligence",
  CONTRATADO: "Contratado",
  DESCARTADO: "Descartado",
  PERDIDO: "Perdido",
};

/** Classes Tailwind por status — usadas em badges e no mapa. */
export const STATUS_CLASSE: Record<StatusPipeline, string> = {
  NOVO: "bg-slate-100 text-slate-700 ring-slate-200",
  EM_ANALISE: "bg-sky-50 text-sky-700 ring-sky-200",
  VISITADO: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  PROPOSTA_ENVIADA: "bg-violet-50 text-violet-700 ring-violet-200",
  EM_NEGOCIACAO: "bg-amber-50 text-amber-800 ring-amber-200",
  DUE_DILIGENCE: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  CONTRATADO: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DESCARTADO: "bg-slate-100 text-slate-500 ring-slate-200",
  PERDIDO: "bg-rose-50 text-rose-700 ring-rose-200",
};

/** Ordem do funil, do primeiro contato ao fechamento. */
export const STATUS_ORDEM: StatusPipeline[] = [
  "NOVO",
  "EM_ANALISE",
  "VISITADO",
  "PROPOSTA_ENVIADA",
  "EM_NEGOCIACAO",
  "DUE_DILIGENCE",
  "CONTRATADO",
];

/** Status que tiram o terreno do funil ativo. */
export const STATUS_ENCERRADOS: StatusPipeline[] = ["DESCARTADO", "PERDIDO"];

export const TOPOGRAFIA_ROTULO: Record<Topografia, string> = {
  PLANA: "Plana",
  ACLIVE_LEVE: "Aclive leve",
  DECLIVE_LEVE: "Declive leve",
  ACLIVE_ACENTUADO: "Aclive acentuado",
  DECLIVE_ACENTUADO: "Declive acentuado",
  IRREGULAR: "Irregular",
  NAO_INFORMADO: "Não informado",
};

export const OCUPACAO_ROTULO: Record<Ocupacao, string> = {
  VAZIO: "Vazio / demolido",
  EDIFICACAO_SIMPLES: "Edificação simples",
  EDIFICACAO_RELEVANTE: "Edificação relevante",
  ALUGADO: "Alugado / com contrato",
  OCUPACAO_IRREGULAR: "Ocupação irregular",
  NAO_INFORMADO: "Não informado",
};

export const DOCUMENTAL_ROTULO: Record<SituacaoDocumental, string> = {
  REGULAR: "Regular",
  PENDENCIA_SIMPLES: "Pendência simples",
  ESPOLIO_INVENTARIO: "Espólio / inventário",
  LITIGIO_USUCAPIAO: "Litígio / usucapião",
  NAO_INFORMADO: "Não informado",
};

export const ORIGEM_ROTULO: Record<OrigemLead, string> = {
  CORRETOR: "Corretor",
  PROPRIETARIO: "Proprietário",
  PORTAL: "Portal / anúncio",
  PROSPECCAO_ATIVA: "Prospecção ativa",
  INDICACAO: "Indicação",
  OUTRA: "Outra",
};

export const MOTIVACAO_ROTULO: Record<Motivacao, string> = {
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
  NAO_INFORMADO: "Não informada",
};

export const CATEGORIA_DD_ROTULO: Record<CategoriaDD, string> = {
  DOCUMENTAL: "Documental / cartorial",
  VENDEDOR: "Vendedor",
  URBANISTICO: "Urbanístico",
  AMBIENTAL: "Ambiental",
  INFRAESTRUTURA: "Infraestrutura",
  COMERCIAL: "Comercial",
  FINANCEIRO: "Financeiro / tributário",
};

export const STATUS_DD_ROTULO: Record<StatusItemDD, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  OK: "OK",
  PROBLEMA: "Problema",
  NAO_APLICAVEL: "Não se aplica",
};

export const STATUS_DD_CLASSE: Record<StatusItemDD, string> = {
  PENDENTE: "bg-slate-100 text-slate-600 ring-slate-200",
  EM_ANDAMENTO: "bg-amber-50 text-amber-800 ring-amber-200",
  OK: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PROBLEMA: "bg-rose-50 text-rose-700 ring-rose-200",
  NAO_APLICAVEL: "bg-slate-50 text-slate-400 ring-slate-200",
};

export const TIPO_NOTA_ROTULO: Record<TipoNota, string> = {
  NOTA: "Nota",
  VISITA: "Visita",
  LIGACAO: "Ligação",
  REUNIAO: "Reunião",
  PROPOSTA: "Proposta",
};

export const OPCOES_PAPEL = opcoes(PAPEL_ROTULO);
export const OPCOES_STATUS = opcoes(STATUS_ROTULO);
export const OPCOES_TOPOGRAFIA = opcoes(TOPOGRAFIA_ROTULO);
export const OPCOES_OCUPACAO = opcoes(OCUPACAO_ROTULO);
export const OPCOES_DOCUMENTAL = opcoes(DOCUMENTAL_ROTULO);
export const OPCOES_ORIGEM = opcoes(ORIGEM_ROTULO);
export const OPCOES_MOTIVACAO = opcoes(MOTIVACAO_ROTULO);
export const OPCOES_CATEGORIA_DD = opcoes(CATEGORIA_DD_ROTULO);
export const OPCOES_STATUS_DD = opcoes(STATUS_DD_ROTULO);
export const OPCOES_TIPO_NOTA = opcoes(TIPO_NOTA_ROTULO);
