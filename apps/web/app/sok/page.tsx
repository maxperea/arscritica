import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Search } from "./search";

export const metadata: Metadata = pageMetadata({
  title: "Sök",
  description: "Sök bland filmerna och albumen som recenserats i svensk press.",
  path: "/sok/",
  robots: { index: false, follow: true },
});

export default function SearchPage() {
  return (
    <>
      <h1 className="visually-hidden">Sök</h1>
      <Search />
    </>
  );
}
