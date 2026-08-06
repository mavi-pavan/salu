"use client";

import { useFormStatus } from "react-dom";
import clsx from "clsx";

import { Botao } from "./ui";

/**
 * Botão de submit que se desabilita sozinho enquanto a action roda.
 * Busca na web pode levar alguns segundos — sem isso, o usuário clica duas vezes.
 */
export function BotaoEnvio({
  children,
  carregando: rotuloCarregando,
  className,
  variante = "primario",
}: {
  children: React.ReactNode;
  carregando?: string;
  className?: string;
  variante?: "primario" | "secundario" | "fantasma" | "perigo";
}) {
  const { pending } = useFormStatus();

  return (
    <Botao type="submit" variante={variante} disabled={pending} className={className}>
      {pending ? (
        <>
          <span
            className={clsx(
              "h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
            )}
            aria-hidden
          />
          {rotuloCarregando ?? "Enviando…"}
        </>
      ) : (
        children
      )}
    </Botao>
  );
}
