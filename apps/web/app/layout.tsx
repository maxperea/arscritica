import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ars Critica", template: "%s – Ars Critica" },
  description: "Filmrecensioner från svenska publikationer, samlade på ett ställe.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="logo">
              Ars Critica
            </Link>
            <nav>
              <Link href="/publikationer/">Publikationer</Link>
              <Link href="/sok/">Sök</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer container">
          Betyg från svenska publikationer, omräknade till en skala 0–100. Filmdata från{" "}
          <a href="https://www.themoviedb.org/">TMDB</a>.
        </footer>
      </body>
    </html>
  );
}
