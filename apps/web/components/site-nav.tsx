"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const filmDestinations = [
  { href: "/topplistor/", label: "Topplistor" },
  { href: "/publikationer/", label: "Publikationer" },
  { href: "/sok/", label: "Sök" },
];

const musicDestinations = [
  { href: "/musik/topplistor/", label: "Topplistor" },
  { href: "/musik/publikationer/", label: "Publikationer" },
  { href: "/musik/sok/", label: "Sök" },
];

function isMusic(pathname: string): boolean {
  return pathname.startsWith("/musik/") || pathname === "/musik";
}

export function SectionSwitch() {
  const music = isMusic(usePathname());

  return (
    <nav aria-label="Avdelning" className="section-switch">
      <Link href="/" aria-current={music ? undefined : "true"}>
        Film
      </Link>
      <Link href="/musik/" aria-current={music ? "true" : undefined}>
        Musik
      </Link>
    </nav>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const destinations = isMusic(pathname) ? musicDestinations : filmDestinations;

  return (
    <nav aria-label="Huvudmeny">
      {destinations.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href || pathname.startsWith(href) ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
