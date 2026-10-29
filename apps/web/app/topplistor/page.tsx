import type { Metadata } from "next";
import { topListMovies } from "@arscritica/db";
import { getDb } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
import { TopLists } from "./top-lists";

export const metadata: Metadata = pageMetadata({
  title: "Topplistor – bästa filmerna enligt kritikerna",
  description:
    "De högst betygsatta filmerna enligt svenska kritiker. Filtrera på period, genre och var filmen går att se.",
  path: "/topplistor/",
});

export default function TopListsPage() {
  return (
    <>
      <h1 className="visually-hidden">Topplistor</h1>
      <TopLists movies={topListMovies(getDb())} />
    </>
  );
}
