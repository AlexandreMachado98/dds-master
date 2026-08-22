import type { Metadata } from "next";
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
      <body className="font-sans antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}