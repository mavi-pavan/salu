"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const ITENS = [
  { href: "/painel", rotulo: "Painel" },
  { href: "/buscar", rotulo: "Buscar terrenos" },
  { href: "/terrenos", rotulo: "Meus terrenos" },
  { href: "/zonas", rotulo: "Zonas" },
  { href: "/mapa", rotulo: "Mapa" },
  { href: "/configuracoes", rotulo: "Configurações" },
];

export function NavLinks() {
  const caminho = usePathname();

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Navegação principal">
      {ITENS.map((item) => {
        const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={clsx(
              "shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              ativo
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
            )}
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
