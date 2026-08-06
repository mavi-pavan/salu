import type { ErrosCampo } from "./validation";

/**
 * Estado compartilhado dos formulários (useActionState).
 *
 * Vive fora de "use server" porque módulos de server action só podem exportar
 * funções assíncronas — constantes e tipos precisam morar em outro arquivo.
 */
export interface EstadoForm {
  ok: boolean;
  mensagem?: string;
  erros?: ErrosCampo;
}

export const ESTADO_INICIAL: EstadoForm = { ok: false };
