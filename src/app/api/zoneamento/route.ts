import { NextResponse } from "next/server";

import { usuarioAtual } from "@/lib/authz";
import { zonasNaArea } from "@/server/zonas-mapa";

/**
 * Os polígonos de zoneamento da área visível do mapa.
 *
 * Por que passa pelo servidor em vez de o navegador falar direto com a
 * Prefeitura: o GeoSampa não manda cabeçalho de CORS, então uma requisição
 * feita da página é bloqueada pelo navegador antes mesmo de sair. Do servidor
 * não há essa restrição — e de quebra a reprojeção de metros para grau acontece
 * uma vez só, no mesmo código já testado que a busca usa.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numeroDe(valor: string | null): number {
  return valor == null ? NaN : Number(valor);
}

export async function GET(requisicao: Request) {
  // Não é segredo nenhum — a camada é pública — mas a rota fala com um serviço
  // de terceiro em nome do app, e isso não fica aberto para a internet.
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ estado: "indisponivel", motivo: "sessão expirada" }, { status: 401 });
  }

  const parametros = new URL(requisicao.url).searchParams;
  const resposta = await zonasNaArea({
    sul: numeroDe(parametros.get("sul")),
    oeste: numeroDe(parametros.get("oeste")),
    norte: numeroDe(parametros.get("norte")),
    leste: numeroDe(parametros.get("leste")),
  });

  // Erro do serviço externo não é erro desta rota: o corpo diz o que houve e o
  // mapa mostra o motivo no botão. Um 500 aqui só apagaria a explicação.
  return NextResponse.json(resposta, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
