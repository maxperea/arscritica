import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Search } from "../../sok/search";

export const metadata: Metadata = pageMetadata({
  title: "Sök",
  description: "Sök bland filmerna och albumen som recenserats i svensk press.",
  path: "/musik/sok/",
  robots: { index: false, follow: true },
});

export default function MusicSearchPage() {
  return (
    <>
      <h1 className="visually-hidden">Sök</h1>
      <Search />
    </>
  );
}
