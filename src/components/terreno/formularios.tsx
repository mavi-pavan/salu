"use client";

import { useActionState, useEffect, useRef } from "react";

import { ESTADO_INICIAL } from "@/lib/form-state";
import { OPCOES_CATEGORIA_DD, OPCOES_TIPO_NOTA } from "@/lib/enums";
import { adicionarDocumento, adicionarNota } from "@/server/actions";
import { BotaoEnvio } from "../botao-envio";
import { Aviso, AreaTexto, Campo, Entrada, Selecao } from "../ui";

export function FormNota({ terrenoId }: { terrenoId: string }) {
  const [estado, acao] = useActionState(adicionarNota, ESTADO_INICIAL);
  const ref = useRef<HTMLFormElement>(null);

  // Limpa o campo depois de gravar para o próximo registro começar em branco.
  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado]);

  return (
    <form ref={ref} action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="terrenoId" value={terrenoId} />
      {estado.mensagem && !estado.ok ? <Aviso tom="erro">{estado.mensagem}</Aviso> : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-40">
          <Campo label="Tipo" htmlFor="tipo">
            <Selecao id="tipo" name="tipo" defaultValue="NOTA">
              {OPCOES_TIPO_NOTA.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Selecao>
          </Campo>
        </div>
        <div className="flex-1">
          <Campo label="Registro" htmlFor="corpo" erro={estado.erros?.corpo}>
            <AreaTexto
              id="corpo"
              name="corpo"
              rows={3}
              placeholder="O que aconteceu, o que ficou combinado, o que precisa ser confirmado…"
            />
          </Campo>
        </div>
      </div>
      <div className="flex justify-end">
        <BotaoEnvio carregando="Registrando…">Registrar</BotaoEnvio>
      </div>
    </form>
  );
}

export function FormDocumento({ terrenoId }: { terrenoId: string }) {
  const [estado, acao] = useActionState(adicionarDocumento, ESTADO_INICIAL);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado]);

  return (
    <form ref={ref} action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="terrenoId" value={terrenoId} />
      {estado.mensagem && !estado.ok ? <Aviso tom="erro">{estado.mensagem}</Aviso> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Nome" htmlFor="nome" erro={estado.erros?.nome}>
          <Entrada id="nome" name="nome" placeholder="Matrícula 123.456 — 15º CRI" />
        </Campo>
        <Campo
          label="Link"
          htmlFor="url"
          erro={estado.erros?.url}
          ajuda="Drive, Dropbox ou portal da prefeitura."
        >
          <Entrada id="url" name="url" type="url" placeholder="https://" />
        </Campo>
        <Campo label="Categoria" htmlFor="categoria">
          <Selecao id="categoria" name="categoria" defaultValue="">
            <option value="">Sem categoria</option>
            {OPCOES_CATEGORIA_DD.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </Selecao>
        </Campo>
      </div>
      <div className="flex justify-end">
        <BotaoEnvio carregando="Salvando…">Adicionar documento</BotaoEnvio>
      </div>
    </form>
  );
}
