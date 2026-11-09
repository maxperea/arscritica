import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { albumSlugs, getAlbum } from "@arscritica/db";
import { Cover } from "@/components/cover";
import { PaywallIcon } from "@/components/paywall-icon";
import { ScoreBadge } from "@/components/score-badge";
import { getDb } from "@/lib/db";
import { formatDate, formatRawScore, reviewCountLabel } from "@/lib/format";
import { albumDescription, albumJsonLd, albumPageTitle, pageMetadata } from "@/lib/seo";
import { slugParams } from "@/lib/static-params";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return slugParams(albumSlugs(getDb()));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const album = getAlbum(getDb(), slug);
  if (!album) return { title: "Albumet hittades inte" };
  return pageMetadata({
    title: albumPageTitle(album),
    description: albumDescription(album),
    path: `/musik/album/${slug}/`,
    image: album.coverUrl ?? undefined,
  });
}

export default async function AlbumPage({ params }: Props) {
  const { slug } = await params;
  const album = getAlbum(getDb(), slug);
  if (!album) notFound();
  const facts = [
    album.kind === "ep" ? "EP" : null,
    album.year,
    album.trackCount ? `${album.trackCount} spår` : null,
  ].filter(Boolean);

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: albumJsonLd(album, `/musik/album/${slug}/`) }}
      />
      <header className="movie-header">
        <Cover url={album.coverUrl} title={album.title} large />
        <div className="movie-heading">
          <h1>{album.title}</h1>
          <p className="album-artist">
            {album.artistSlug ? (
              <Link href={`/musik/artist/${album.artistSlug}/`}>{album.artistCredit}</Link>
            ) : (
              album.artistCredit
            )}
          </p>
          {facts.length ? <p className="muted movie-year">{facts.join(" · ")}</p> : null}
        </div>
        <div className="aggregate">
          <ScoreBadge score={album.score} large />
          <div>
            <strong>{album.reviewCount === 1 ? "Kritikerbetyg" : "Kritikersnitt"}</strong>
            <div className="muted">{reviewCountLabel(album.reviewCount)}</div>
          </div>
        </div>
      </header>

      <h2>Recensioner</h2>
      <ul className="list review-list">
        {album.reviews.map((review) => (
          <li key={review.url} className="review-item">
            <div className="item-body">
              <a href={review.url} className="item-title" target="_blank" rel="noopener noreferrer">
                {review.publicationPaywalled && <PaywallIcon />}
                {review.publicationName} ↗
              </a>
              <div className="muted">
                {[review.critic, formatDate(review.publishedAt)].filter(Boolean).join(" · ")}
                <span className="review-publication">
                  {review.critic || review.publishedAt ? (
                    <span className="review-divider"> · </span>
                  ) : null}
                  <Link
                    href={`/musik/publikationer/${review.publicationSlug}/`}
                    className="quiet-link"
                  >
                    Alla från {review.publicationName}
                  </Link>
                </span>
              </div>
            </div>
            <div className="review-rating">
              <ScoreBadge score={review.normalizedScore} />
              <span className="muted">{formatRawScore(review.rawScore, review.scaleMax)}</span>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
