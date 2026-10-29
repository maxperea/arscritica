import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";
import { siteName, siteOrigin } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: { default: siteName, template: `%s | ${siteName}` },
  description: "Filmrecensioner från svenska publikationer, samlade på ett ställe.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <a href="#main" className="skip-link">
          Till innehållet
        </a>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="logo">
              Vox Critica
            </Link>
            <SiteNav />
          </div>
        </header>
        <main id="main" className="container" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer container">
          Filmrecensioner från svenska publikationer. Filmdata från{" "}
          <a href="https://www.themoviedb.org/">TMDB</a>. Streamingdata från{" "}
          <a href="https://www.justwatch.com/se">JustWatch</a> och{" "}
          <a href="https://www.watchmode.com/">Watchmode</a>.
        </footer>
      </body>
    </html>
  );
}
