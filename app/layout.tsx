import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DDS ON MASTER - Painel do Proprietário",
  description: "Centro de Controle Multi-Tenant e Inteligência de Dados AM TST",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
    shortcut: "/logo.jpg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DDS MASTER",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="bg-slate-950 text-slate-100">
      <head>
        <link rel="apple-touch-icon" href="/logo.jpg" />
        {/* MOTOR DO TAILWIND DIRETO NO NAVEGADOR (GARANTIA DE ESTILIZAÇÃO) */}
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="font-sans antialiased bg-slate-950 text-slate-100 min-h-screen min-h-[100dvh] overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}