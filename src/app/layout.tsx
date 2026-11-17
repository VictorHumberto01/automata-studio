import type { Metadata } from "next";
import { THEME_INIT_SCRIPT, accentCss } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Automata Studio",
  description: "Editor e simulador de autômatos finitos, de pilha e máquinas de Turing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: accentCss() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
