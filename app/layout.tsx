 import type { Metadata } from "next";

// @ts-ignore -> Manda o VS Code ignorar a linha vermelha do CSS
import "./globals.css";

export const metadata: Metadata = {
  title: "DDS ON MASTER - Painel do Proprietário",
  description: "Centro de Controle Multi-Tenant e Inteligência de Dados AM TST",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* MOTOR DO TAILWIND DIRETO NO NAVEGADOR (GARANTIA DE ESTILIZAÇÃO) */}
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="font-sans antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}