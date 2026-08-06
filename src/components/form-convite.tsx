"use client";

import { useActionState, useEffect, useRef } from "react";

import { ESTADO_INICIAL } from "@/lib/form-state";
import { OPCOES_PAPEL } from "@/lib/enums";
import { convidarMembro } from "@/server/actions";
import { BotaoEnvio } from "./botao-envio";
import { Aviso, Campo, Entrada, Selecao } from "./ui";

export function FormConvite() {
  const [estado, acao] = useActionState(convidarMembro, ESTADO_INICIAL);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado]);

  return (
    <form ref={ref} action={acao} className="flex flex-col gap-3">
      {estado.mensagem ? <Aviso tom={estado.ok ? "ok" : "erro"}>{estado.mensagem}</Aviso> : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Campo label="E-mail" htmlFor="email" erro={estado.erros?.email}>
            <Entrada id="email" name="email" type="email" placeholder="socio@exemplo.com" required />
          </Campo>
        </div>
        <div className="w-40">
          <Campo label="Papel" htmlFor="papel">
            <Selecao id="papel" name="papel" defaultValue="MEMBRO">
              {OPCOES_PAPEL.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Selecao>
          </Campo>
        </div>
        <BotaoEnvio carregando="Convidando…">Convidar</BotaoEnvio>
      </div>
    </form>
  );
}
