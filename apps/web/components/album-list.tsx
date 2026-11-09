import Link from "next/link";
import type { AlbumSummary } from "@arscritica/db";
import { reviewCountLabel } from "@/lib/format";
import { Cover } from "./cover";
import { ScoreBadge } from "./score-badge";

export function AlbumList({ albums }: { albums: AlbumSummary[] }) {
  return (
    <ul className="list movie-list">
      {albums.map((album) => (
        <li key={album.slug}>
          <AlbumLink album={album} />
        </li>
      ))}
    </ul>
  );
}

export function AlbumLink({ album, label }: { album: AlbumSummary; label?: string }) {
  const meta = [
    label,
    album.artistCredit,
    album.kind === "ep" ? "EP" : null,
    album.year,
    reviewCountLabel(album.reviewCount),
  ];
  return (
    <Link href={`/musik/album/${album.slug}/`} className="movie-link">
      <Cover url={album.coverThumbnailUrl} title={album.title} decorative />
      <span className="item-body">
        <span className="item-title">{album.title}</span>
        <span className="item-meta muted">{meta.filter(Boolean).join(" · ")}</span>
      </span>
      <ScoreBadge score={album.score} />
    </Link>
  );
}
