import type { Database } from "./database";
import type { AlbumKind } from "./music-writes";
import type { BestMoviesOptions, PublicationSummary } from "./queries";
import { allRows, getRow } from "./sql";

export interface AlbumSummary {
  slug: string;
  title: string;
  artistCredit: string;
  artistSlug: string | null;
  kind: AlbumKind | null;
  year: number | null;
  coverThumbnailUrl: string | null;
  score: number;
  reviewCount: number;
  latestReviewAt: string;
}

export interface TopListAlbum extends AlbumSummary {
  firstReviewedAt: string;
}

export interface AlbumReview {
  url: string;
  rawScore: number;
  scaleMax: number;
  normalizedScore: number;
  critic: string | null;
  publishedAt: string | null;
  publicationSlug: string;
  publicationName: string;
  publicationPaywalled: boolean;
}

export interface AlbumDetail extends AlbumSummary {
  mbid: string | null;
  discogsMasterId: number | null;
  discogsReleaseId: number | null;
  coverUrl: string | null;
  trackCount: number | null;
  reviews: AlbumReview[];
}

export interface ArtistDetail {
  slug: string;
  name: string;
  mbid: string;
  albums: AlbumSummary[];
}

export interface MusicPublicationReview {
  url: string;
  rawScore: number;
  scaleMax: number;
  normalizedScore: number;
  critic: string | null;
  publishedAt: string | null;
  albumSlug: string;
  albumTitle: string;
  albumArtist: string;
  albumYear: number | null;
}

export interface MusicPublicationDetail extends PublicationSummary {
  reviews: MusicPublicationReview[];
}

const reviewedAt = "COALESCE(r.published_at, r.scraped_at)";
const matchedAlbum = "a.metadata_source IS NOT NULL";

const albumSummaryColumns = `
  a.slug, a.title, a.artist_credit AS artistCredit, ar.slug AS artistSlug, a.kind, a.year,
    a.cover_thumbnail_url AS coverThumbnailUrl,
    CAST(ROUND(AVG(r.normalized_score)) AS INTEGER) AS score,
    COUNT(r.id) AS reviewCount,
    MAX(${reviewedAt}) AS latestReviewAt`;

const albumSummaryFrom = `
  FROM albums a
  JOIN album_reviews r ON r.album_id = a.id AND ${matchedAlbum}
  LEFT JOIN artists ar ON ar.id = a.artist_id`;

const albumSummarySelect = `SELECT ${albumSummaryColumns} ${albumSummaryFrom}`;

const publicationSummarySelect = `
  SELECT p.slug, p.name, p.url, p.paywalled, COUNT(r.id) AS reviewCount,
    CAST(ROUND(AVG(r.normalized_score)) AS INTEGER) AS averageScore
  FROM music_publications p
  LEFT JOIN (album_reviews r JOIN albums a ON a.id = r.album_id AND ${matchedAlbum})
    ON r.publication_id = p.id`;

export function recentlyReviewedAlbums(db: Database, limit = 12): AlbumSummary[] {
  return allRows(
    db.prepare(`${albumSummarySelect} GROUP BY a.id ORDER BY latestReviewAt DESC, a.title LIMIT ?`),
    limit,
  );
}

export function bestAlbumsRightNow(
  db: Database,
  { limit = 10, minReviews = 2, windowDays = 60 }: BestMoviesOptions = {},
): AlbumSummary[] {
  return allRows(
    db.prepare(
      `${albumSummarySelect}
       GROUP BY a.id
       HAVING COUNT(r.id) >= ?
         AND MIN(${reviewedAt}) >= (
           SELECT strftime('%Y-%m-%dT%H:%M:%fZ', MAX(COALESCE(published_at, scraped_at)), ?)
           FROM album_reviews
         )
       ORDER BY score DESC, reviewCount DESC, a.title
       LIMIT ?`,
    ),
    minReviews,
    `-${windowDays} days`,
    limit,
  );
}

export function getAlbum(db: Database, slug: string): AlbumDetail | undefined {
  const album = getRow<AlbumSummary>(
    db.prepare(`${albumSummarySelect} WHERE a.slug = ? GROUP BY a.id`),
    slug,
  );
  if (!album) return undefined;
  const details = getRow<
    Pick<AlbumDetail, "mbid" | "discogsMasterId" | "discogsReleaseId" | "coverUrl" | "trackCount">
  >(
    db.prepare(
      `SELECT mbid, discogs_master_id AS discogsMasterId, discogs_release_id AS discogsReleaseId,
         cover_url AS coverUrl, track_count AS trackCount
       FROM albums WHERE slug = ?`,
    ),
    slug,
  )!;
  const reviews = allRows<AlbumReview>(
    db.prepare(
      `SELECT r.url, r.raw_score AS rawScore, r.scale_max AS scaleMax,
         r.normalized_score AS normalizedScore, r.critic, r.published_at AS publishedAt,
         p.slug AS publicationSlug, p.name AS publicationName,
         p.paywalled AS publicationPaywalled
       FROM album_reviews r
       JOIN albums a ON a.id = r.album_id
       JOIN music_publications p ON p.id = r.publication_id
       WHERE a.slug = ?
       ORDER BY r.normalized_score DESC, p.name`,
    ),
    slug,
  );
  return {
    ...album,
    ...details,
    reviews: reviews.map((review) => ({
      ...review,
      publicationPaywalled: Boolean(review.publicationPaywalled),
    })),
  };
}

export function getArtist(db: Database, slug: string): ArtistDetail | undefined {
  const artist = getRow<{ id: number; slug: string; name: string; mbid: string }>(
    db.prepare("SELECT id, slug, name, mbid FROM artists WHERE slug = ?"),
    slug,
  );
  if (!artist) return undefined;
  const albums = allRows<AlbumSummary>(
    db.prepare(
      `${albumSummarySelect} WHERE a.artist_id = ? GROUP BY a.id
       ORDER BY a.year IS NULL, a.year DESC, latestReviewAt DESC`,
    ),
    artist.id,
  );
  return { slug: artist.slug, name: artist.name, mbid: artist.mbid, albums };
}

export function listMusicPublications(db: Database): PublicationSummary[] {
  return allRows<PublicationSummary>(
    db.prepare(`${publicationSummarySelect} GROUP BY p.id HAVING COUNT(r.id) > 0 ORDER BY p.name`),
  ).map((publication) => ({ ...publication, paywalled: Boolean(publication.paywalled) }));
}

export function getMusicPublication(
  db: Database,
  slug: string,
): MusicPublicationDetail | undefined {
  const publication = getRow<PublicationSummary>(
    db.prepare(`${publicationSummarySelect} WHERE p.slug = ? GROUP BY p.id`),
    slug,
  );
  if (!publication) return undefined;
  const reviews = allRows<MusicPublicationReview>(
    db.prepare(
      `SELECT r.url, r.raw_score AS rawScore, r.scale_max AS scaleMax,
         r.normalized_score AS normalizedScore, r.critic, r.published_at AS publishedAt,
         a.slug AS albumSlug, a.title AS albumTitle, a.artist_credit AS albumArtist,
         a.year AS albumYear
       FROM album_reviews r
       JOIN albums a ON a.id = r.album_id
       JOIN music_publications p ON p.id = r.publication_id
       WHERE p.slug = ? AND ${matchedAlbum}
       ORDER BY ${reviewedAt} DESC, a.title`,
    ),
    slug,
  );
  return { ...publication, paywalled: Boolean(publication.paywalled), reviews };
}

export function albumSlugs(db: Database): string[] {
  return allRows<{ slug: string }>(db.prepare(`SELECT DISTINCT a.slug ${albumSummaryFrom}`)).map(
    (row) => row.slug,
  );
}

export function artistSlugs(db: Database): string[] {
  return allRows<{ slug: string }>(
    db.prepare(`SELECT DISTINCT ar.slug ${albumSummaryFrom} WHERE ar.slug IS NOT NULL`),
  ).map((row) => row.slug);
}

export function musicPublicationSlugs(db: Database): string[] {
  return listMusicPublications(db).map((publication) => publication.slug);
}

export function albumSearchIndex(db: Database): AlbumSummary[] {
  return allRows(db.prepare(`${albumSummarySelect} GROUP BY a.id ORDER BY a.title`));
}

export function topListAlbums(db: Database): TopListAlbum[] {
  return allRows<TopListAlbum>(
    db.prepare(
      `SELECT ${albumSummaryColumns}, MIN(${reviewedAt}) AS firstReviewedAt
       ${albumSummaryFrom}
       GROUP BY a.id
       ORDER BY score DESC, reviewCount DESC, a.title`,
    ),
  );
}
