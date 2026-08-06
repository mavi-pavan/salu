const LOCALE = "pt-BR";

export function brl(valor: number | null | undefined, casas = 0): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return valor.toLocaleString(LOCALE, {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** R$ 12,4 mi — para KPIs e cards onde o número inteiro não cabe. */
export function brlCompacto(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  const abs = Math.abs(valor);
  const sinal = valor < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sinal}R$ ${(abs / 1_000_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} bi`;
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toLocaleString(LOCALE, { maximumFractionDigits: 0 })} mil`;
  return brl(valor);
}

export function numero(valor: number | null | undefined, casas = 0): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return valor.toLocaleString(LOCALE, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function m2(valor: number | null | undefined, casas = 0): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return `${numero(valor, casas)} m²`;
}

export function metros(valor: number | null | undefined, casas = 1): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return `${numero(valor, casas)} m`;
}

export function pct(valor: number | null | undefined, casas = 1): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return `${numero(valor, casas)}%`;
}

export function data(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function dataHora(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "há 3 dias" — para o feed de atividade. */
export function tempoRelativo(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return "—";

  const segundos = Math.round((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const faixas: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];

  let valorAtual = segundos;
  for (const [unidade, limite] of faixas) {
    if (Math.abs(valorAtual) < limite) return rtf.format(-Math.round(valorAtual), unidade);
    valorAtual /= limite;
  }
  return rtf.format(-Math.round(valorAtual), "year");
}

/** Endereço em uma linha, pulando o que estiver vazio. */
export function enderecoCurto(t: {
  logradouro: string;
  numero?: string | null;
  bairro?: string | null;
}): string {
  const partes = [t.numero ? `${t.logradouro}, ${t.numero}` : t.logradouro, t.bairro].filter(Boolean);
  return partes.join(" — ");
}

export function iniciais(nome?: string | null, email?: string | null): string {
  const base = (nome ?? email ?? "?").trim();
  const partes = base.split(/[\s@._-]+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "?";
  const segunda = partes.length > 1 ? (partes[1]?.[0] ?? "") : "";
  return (primeira + segunda).toUpperCase();
}
