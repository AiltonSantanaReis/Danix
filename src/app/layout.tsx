import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Danix - Gestao, Controle e Resultados",
  description: "Dashboard profissional para gestao imobiliaria, contas, custos e resultados.",
  icons: {
    icon: "/danix-logo.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-zinc-950 text-zinc-200 antialiased">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
