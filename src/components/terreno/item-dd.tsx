"use client";

import { useRef, useState } from "react";

import { OPCOES_STATUS_DD, STATUS_DD_CLASSE, STATUS_DD_ROTULO, type StatusItemDD } from "@/lib/enums";
import { data as formatarData } from "@/lib/format";
import { atualizarItemDD } from "@/server/actions";
import { Etiqueta } from "../ui";

export interface ItemDD {
  id: string;
  titulo: string;
  descricao: string | null;
  critico: boolean;
  status: StatusItemDD;
  prazo: Date | null;
  observacao: string | null;
  responsavel: { id: string; name: string | null; email: string } | null;
}

export function LinhaItemDD({
  item,
  membros,
  editavel,
}: {
  item: ItemDD;
  membros: Array<{ id: string; name: string | null; email: string }>;
  editavel: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [aberto, setAberto] = useState(false);

  const atrasado =
    item.prazo != null && item.status !== "OK" && item.status !== "NAO_APLICAVEL"
      ? new Date(item.prazo).getTime() < Date.now()
      : false;

  return (
    <li className="px-5 py-3">
      <form ref={formRef} action={atualizarItemDD} className="flex flex-col gap-3">
        <input type="hidden" name="itemId" value={item.id} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
              {item.titulo}
              {item.critico ? (
                <span
                  className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-rose-700 uppercase"
                  title="Item que sozinho derruba o negócio"
                >
                  crítico
                </span>
              ) : null}
            </p>
            {item.descricao ? (
              <p className="mt-0.5 text-xs text-slate-500">{item.descricao}</p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {item.responsavel ? <span>{item.responsavel.name ?? item.responsavel.email}</span> : null}
              {item.prazo ? (
                <span className={atrasado ? "font-medium text-rose-600" : undefined}>
                  prazo {formatarData(item.prazo)}
                  {atrasado ? " (vencido)" : ""}
                </span>
              ) : null}
              {item.observacao ? (
                <span className="truncate italic">“{item.observacao}”</span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {editavel ? (
              <select
                name="status"
                defaultValue={item.status}
                onChange={() => formRef.current?.requestSubmit()}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                aria-label={`Status de ${item.titulo}`}
              >
                {OPCOES_STATUS_DD.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            ) : (
              <Etiqueta className={STATUS_DD_CLASSE[item.status]}>
                {STATUS_DD_ROTULO[item.status]}
              </Etiqueta>
            )}

            {editavel ? (
              <button
                type="button"
                onClick={() => setAberto((a) => !a)}
                className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                aria-expanded={aberto}
              >
                {aberto ? "Fechar" : "Detalhar"}
              </button>
            ) : null}
          </div>
        </div>

        {aberto && editavel ? (
          <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Responsável
              <select
                name="responsavelId"
                defaultValue={item.responsavel?.id ?? ""}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Ninguém</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Prazo
              <input
                type="date"
                name="prazo"
                defaultValue={item.prazo ? new Date(item.prazo).toISOString().slice(0, 10) : ""}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600 sm:col-span-3">
              Observação
              <input
                type="text"
                name="observacao"
                defaultValue={item.observacao ?? ""}
                maxLength={2000}
                placeholder="o que foi verificado, o que falta, onde está o documento…"
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <div className="sm:col-span-3">
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Salvar item
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </li>
  );
}
