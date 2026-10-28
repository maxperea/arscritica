import type { Metadata } from "next";
import { topListMovies } from "@arscritica/db";
import { getDb } from "@/lib/db";
import { TopLists } from "./top-lists";

export const metadata: Metadata = { title: "Topplistor" };

export default function TopListsPage() {
  return (
    <>
      <h1 className="visually-hidden">Topplistor</h1>
      <TopLists movies={topListMovies(getDb())} />
    </>
  );
}
