import type { Metadata } from "next";
import { topListAlbums } from "@arscritica/db";
import { getDb } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
import { AlbumTopLists } from "./top-lists";

export const metadata: Metadata = pageMetadata({
  title: "Topplistor – bästa albumen enligt kritikerna",
  description: "De högst betygsatta albumen enligt svenska musikkritiker. Filtrera på period.",
  path: "/musik/topplistor/",
});

export default function AlbumTopListsPage() {
  return (
    <>
      <h1 className="visually-hidden">Topplistor</h1>
      <AlbumTopLists albums={topListAlbums(getDb())} />
    </>
  );
}
