import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import { STATUS_CLASSE, STATUS_ROTULO, type StatusPipeline } from "@/lib/enums";
import { faixaScore } from "@/lib/scoring";
import { numero } from "@/lib/format";

// ---------------------------------------------------------------------------
// Estrutura
// ---------------------------------------------------------------------------

export function Cartao({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CartaoCabecalho({
  titulo,
  descricao,
  acao,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
        {descricao ? <p className="mt-1 text-sm text-slate-500">{descricao}</p> : null}
      </div>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </header>
  );
}

export function CartaoCorpo({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("px-5 py-4", className)}>{children}</div>;
}

export function TituloPagina({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
        {descricao ? <p className="mt-1 text-sm text-slate-500">{descricao}</p> : null}
      </div>
      {acao}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sinalização
// ---------------------------------------------------------------------------

export function Etiqueta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        className ?? "bg-slate-100 text-slate-700 ring-slate-200",
      )}
    >
      {children}
    </span>
  );
}

export function EtiquetaStatus({ status }: { status: StatusPipeline }) {
  return <Etiqueta className={STATUS_CLASSE[status]}>{STATUS_ROTULO[status]}</Etiqueta>;
}

export function EtiquetaScore({
  total,
  cobertura,
}: {
  total: number | null | undefined;
  cobertura?: number | null;
}) {
  if (total == null) {
    return <Etiqueta className="bg-slate-100 text-slate-400 ring-slate-200">sem score</Etiqueta>;
  }
  const faixa = faixaScore(total);
  return (
    <span className="inline-flex items-center gap-2">
      <Etiqueta className={faixa.classe}>
        <span className={clsx("h-1.5 w-1.5 rounded-full", faixa.classePonto)} />
        <span className="tnum font-semibold">{numero(total, 0)}</span>
      </Etiqueta>
      {cobertura != null && cobertura < 70 ? (
        <span className="text-xs text-slate-400" title="Percentual dos critérios com dado preenchido">
          {numero(cobertura, 0)}% dos dados
        </span>
      ) : null}
    </span>
  );
}

export function Aviso({
  tom = "info",
  titulo,
  children,
}: {
  tom?: "info" | "atencao" | "erro" | "ok";
  titulo?: string;
  children: ReactNode;
}) {
  const tons = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    atencao: "border-amber-200 bg-amber-50 text-amber-900",
    erro: "border-rose-200 bg-rose-50 text-rose-900",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  } as const;

  return (
    <div className={clsx("rounded-lg border px-4 py-3 text-sm", tons[tom])}>
      {titulo ? <p className="mb-0.5 font-semibold">{titulo}</p> : null}
      <div className="[&_a]:underline">{children}</div>
    </div>
  );
}

export function Metrica({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  destaque?: "positivo" | "negativo";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/40">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p
        className={clsx(
          "tnum mt-1 text-xl font-semibold",
          destaque === "positivo" && "text-emerald-600",
          destaque === "negativo" && "text-rose-600",
          !destaque && "text-slate-900",
        )}
      >
        {valor}
      </p>
      {detalhe ? <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p> : null}
    </div>
  );
}

export function Barra({
  percentual,
  className,
}: {
  percentual: number;
  className?: string;
}) {
  const valor = Math.max(0, Math.min(100, percentual));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={clsx("h-full rounded-full transition-all", className ?? "bg-emerald-500")}
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}

export function LinhaInfo({
  rotulo,
  valor,
  className,
}: {
  rotulo: string;
  valor: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <dt className="shrink-0 text-sm text-slate-500">{rotulo}</dt>
      <dd className="tnum min-w-0 text-right text-sm font-medium text-slate-900">{valor}</dd>
    </div>
  );
}

export function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-900">{titulo}</p>
      {descricao ? <p className="mt-1 max-w-md text-sm text-slate-500">{descricao}</p> : null}
      {acao ? <div className="mt-4">{acao}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

type Variante = "primario" | "secundario" | "fantasma" | "perigo";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600/50",
  secundario:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50",
  fantasma: "text-slate-600 hover:bg-slate-100 disabled:opacity-50",
  perigo: "bg-white text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50",
};

const BASE_BOTAO =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed";

export function Botao({
  variante = "primario",
  className,
  ...props
}: ComponentProps<"button"> & { variante?: Variante }) {
  return <button {...props} className={clsx(BASE_BOTAO, VARIANTES[variante], className)} />;
}

export function BotaoLink({
  variante = "primario",
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link {...props} className={clsx(BASE_BOTAO, VARIANTES[variante], className)} />;
}

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------

export function Campo({
  label,
  htmlFor,
  ajuda,
  erro,
  obrigatorio,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  ajuda?: ReactNode;
  erro?: string;
  obrigatorio?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {obrigatorio ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </label>
      {children}
      {erro ? (
        <p className="text-xs font-medium text-rose-600">{erro}</p>
      ) : ajuda ? (
        <p className="text-xs text-slate-500">{ajuda}</p>
      ) : null}
    </div>
  );
}

const BASE_CONTROLE =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500";

export function Entrada({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={clsx(BASE_CONTROLE, className)} />;
}

export function AreaTexto({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={clsx(BASE_CONTROLE, "min-h-[80px]", className)} />;
}

export function Selecao({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={clsx(BASE_CONTROLE, "pr-8", className)}>
      {children}
    </select>
  );
}

export function Caixa({
  label,
  descricao,
  className,
  ...props
}: ComponentProps<"input"> & { label: string; descricao?: string }) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50 has-checked:border-emerald-300 has-checked:bg-emerald-50/50",
        className,
      )}
    >
      <input
        type="checkbox"
        {...props}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {descricao ? <span className="block text-xs text-slate-500">{descricao}</span> : null}
      </span>
    </label>
  );
}

export function GrupoCampos({
  titulo,
  descricao,
  children,
  className,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={clsx("border-t border-slate-200 pt-5", className)}>
      <legend className="sr-only">{titulo}</legend>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        {descricao ? <p className="mt-0.5 text-sm text-slate-500">{descricao}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}
