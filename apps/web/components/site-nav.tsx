"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/topplistor/", label: "Topplistor" },
  { href: "/publikationer/", label: "Publikationer" },
  { href: "/sok/", label: "Sök" },
];

export function SiteNav() {
  const pathname = usePathname();

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
