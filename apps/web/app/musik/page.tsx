import type { Metadata } from "next";
import Link from "next/link";
import { bestAlbumsRightNow, recentlyReviewedAlbums } from "@arscritica/db";
import { AlbumList } from "@/components/album-list";
import { getDb } from "@/lib/db";
import { pageMetadata, siteName } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: `${siteName} – skivrecensioner från svensk press`,
  absoluteTitle: true,
  description:
    "Betyg från svenska musikkritiker samlade på ett ställe. Se vilka album som får bäst betyg just nu och läs recensionerna.",
  path: "/musik/",
});

export default function MusicHomePage() {
  const db = getDb();
  const best = bestAlbumsRightNow(db);
  const recent = recentlyReviewedAlbums(db);

  return (
    <>
      <h1 className="visually-hidden">Vox Critica – Musik</h1>
      <div className="home">
        <section>
          <div className="home-heading">
            <h2>Bäst just nu</h2>
            <a href="#senast" className="jump-recent">
              Senast recenserade ↓
            </a>
          </div>
          {best.length ? (
            <AlbumList albums={best} />
          ) : (
            <p className="muted">Inga album med tillräckligt många recensioner ännu.</p>
          )}
          <Link href="/musik/topplistor/" className="section-link">
            Utforska topplistor →
          </Link>
        </section>
        <section id="senast" tabIndex={-1}>
          <h2>Senast recenserade</h2>
          {recent.length ? (
            <AlbumList albums={recent} />
          ) : (
            <p className="muted">Inga recensioner ännu.</p>
          )}
        </section>
      </div>
    </>
  );
}
