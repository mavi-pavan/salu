import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Salu",
    template: "%s · Salu",
  },
  description:
    "Salu — triagem, pontuação e due diligence de terrenos em Zona Eixo (ZEU) na cidade de São Paulo.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
