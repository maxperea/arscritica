import type { Database } from "./database";
import { normalizeScore } from "./score";
import { allRows, getRow } from "./sql";
import { normalizeTitle, slugify } from "./text";
import type { PublicationInput } from "./writes";

export type AlbumKind = "album" | "ep";

export interface ArtistInput {
  mbid: string;
  name: string;
}

export interface AlbumInput {
  mbid?: string;
  artist?: ArtistInput;
  artistCredit: string;
  title: string;
  kind?: AlbumKind;
  year?: number;
  trackCount?: number;
  coverUrl?: string;
  coverThumbnailUrl?: string;
}

export interface AlbumCandidate {
  id: number;
  mbid: string | null;
  year: number | null;
  firstReviewedYear: number | null;
}

export interface AlbumReviewInput {
  albumId: number;
  publicationId: number;
  url: string;
  sourceArtist: string;
  sourceTitle: string;
  rawScore: number;
  scaleMax: number;
  critic?: string;
  publishedAt?: string;
  scrapedAt?: string;
}

export function upsertMusicPublication(db: Database, publication: PublicationInput): number {
  db.prepare(
    `INSERT INTO music_publications (slug, name, url, paywalled)
     VALUES (:slug, :name, :url, :paywalled)
     ON CONFLICT (slug) DO UPDATE SET
       name = excluded.name, url = excluded.url, paywalled = excluded.paywalled`,
  ).run({
    slug: publication.slug,
    name: publication.name,
    url: publication.url,
    paywalled: publication.paywalled ? 1 : 0,
  });
  return getRow<{ id: number }>(
    db.prepare("SELECT id FROM music_publications WHERE slug = ?"),
    publication.slug,
  )!.id;
}

export function albumReviewExists(db: Database, url: string): boolean {
  return (
    getRow(db.prepare("SELECT 1 AS found FROM album_reviews WHERE url = ?"), url) !== undefined
  );
}

export function latestAlbumReviewDate(db: Database, publicationId: number): string | undefined {
  const row = getRow<{ latest: string | null }>(
    db.prepare(
      `SELECT MAX(COALESCE(published_at, scraped_at)) AS latest FROM album_reviews
       WHERE publication_id = ?`,
    ),
    publicationId,
  );
  return row?.latest ?? undefined;
}

export function albumReviewDuplicates(db: Database, review: AlbumReviewInput): boolean {
  if (!review.critic) return false;
  return (
    getRow(
      db.prepare(
        `SELECT 1 AS found FROM album_reviews
         WHERE publication_id = ? AND album_id = ? AND critic = ? AND raw_score = ?`,
      ),
      review.publicationId,
      review.albumId,
      review.critic,
      review.rawScore,
    ) !== undefined
  );
}

export function findAlbumIdByMbid(db: Database, mbid: string): number | undefined {
  return getRow<{ id: number }>(db.prepare("SELECT id FROM albums WHERE mbid = ?"), mbid)?.id;
}

export function findAlbums(db: Database, artist: string, title: string): AlbumCandidate[] {
  return allRows<AlbumCandidate>(
    db.prepare(
      `SELECT id, mbid, year,
         (SELECT CAST(MIN(strftime('%Y', COALESCE(published_at, scraped_at))) AS INTEGER)
          FROM album_reviews WHERE album_id = albums.id) AS firstReviewedYear
       FROM albums WHERE artist_key = ? AND title_key = ?`,
    ),
    normalizeTitle(artist),
    normalizeTitle(title),
  );
}

export function insertAlbum(db: Database, album: AlbumInput): number {
  const result = db
    .prepare(
      `INSERT INTO albums (mbid, artist_id, artist_credit, title, kind, year, track_count,
         cover_url, cover_thumbnail_url, slug, artist_key, title_key)
       VALUES (:mbid, :artistId, :artistCredit, :title, :kind, :year, :trackCount,
         :coverUrl, :coverThumbnailUrl, :slug, :artistKey, :titleKey)`,
    )
    .run({
      ...albumColumns(db, album),
      slug: uniqueSlug(db, "albums", `${album.artistCredit} ${album.title}`, "album"),
    });
  return Number(result.lastInsertRowid);
}

export function attachAlbumData(db: Database, albumId: number, album: AlbumInput): void {
  db.prepare(
    `UPDATE albums SET mbid = :mbid, artist_id = :artistId, artist_credit = :artistCredit,
       title = :title, kind = :kind, year = :year, track_count = :trackCount,
       cover_url = :coverUrl, cover_thumbnail_url = :coverThumbnailUrl,
       artist_key = :artistKey, title_key = :titleKey
     WHERE id = :id`,
  ).run({ ...albumColumns(db, album), id: albumId });
}

export function insertAlbumReview(db: Database, review: AlbumReviewInput): number {
  const result = db
    .prepare(
      `INSERT INTO album_reviews (album_id, publication_id, url, source_artist, source_title,
         raw_score, scale_max, normalized_score, critic, published_at, scraped_at)
       VALUES (:albumId, :publicationId, :url, :sourceArtist, :sourceTitle,
         :rawScore, :scaleMax, :normalizedScore, :critic, :publishedAt, :scrapedAt)`,
    )
    .run({
      albumId: review.albumId,
      publicationId: review.publicationId,
      url: review.url,
      sourceArtist: review.sourceArtist,
      sourceTitle: review.sourceTitle,
      rawScore: review.rawScore,
      scaleMax: review.scaleMax,
      normalizedScore: normalizeScore(review.rawScore, review.scaleMax),
      critic: review.critic ?? null,
      publishedAt: review.publishedAt ?? null,
      scrapedAt: review.scrapedAt ?? new Date().toISOString(),
    });
  return Number(result.lastInsertRowid);
}

function upsertArtist(db: Database, artist: ArtistInput): number {
  const known = getRow<{ id: number }>(
    db.prepare("SELECT id FROM artists WHERE mbid = ?"),
    artist.mbid,
  );
  if (known) {
    db.prepare("UPDATE artists SET name = ? WHERE id = ?").run(artist.name, known.id);
    return known.id;
  }
  const result = db
    .prepare("INSERT INTO artists (mbid, name, slug) VALUES (?, ?, ?)")
    .run(artist.mbid, artist.name, uniqueSlug(db, "artists", artist.name, "artist"));
  return Number(result.lastInsertRowid);
}

function albumColumns(db: Database, album: AlbumInput) {
  return {
    mbid: album.mbid ?? null,
    artistId: album.artist ? upsertArtist(db, album.artist) : null,
    artistCredit: album.artistCredit,
    title: album.title,
    kind: album.kind ?? null,
    year: album.year ?? null,
    trackCount: album.trackCount ?? null,
    coverUrl: album.coverUrl ?? null,
    coverThumbnailUrl: album.coverThumbnailUrl ?? null,
    artistKey: normalizeTitle(album.artistCredit),
    titleKey: normalizeTitle(album.title),
  };
}

function uniqueSlug(db: Database, table: "albums" | "artists", text: string, fallback: string) {
  const base = slugify(text) || fallback;
  const taken = db.prepare(`SELECT 1 AS taken FROM ${table} WHERE slug = ?`);
  let slug = base;
  for (let suffix = 2; getRow(taken, slug); suffix++) slug = `${base}-${suffix}`;
  return slug;
}

export interface UnmatchedAlbum {
  id: number;
  artist: string;
  title: string;
  reviewedAt: string;
}

export function recentUnmatchedAlbums(db: Database, days: number): UnmatchedAlbum[] {
  return allRows<UnmatchedAlbum>(
    db.prepare(
      `SELECT a.id, a.artist_credit AS artist, a.title,
         MIN(COALESCE(r.published_at, r.scraped_at)) AS reviewedAt
       FROM albums a JOIN album_reviews r ON r.album_id = a.id
       WHERE a.mbid IS NULL
       GROUP BY a.id
       HAVING reviewedAt >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)`,
    ),
    `-${days} days`,
  );
}

export function mergeAlbumInto(db: Database, fromId: number, toId: number): void {
  db.prepare("UPDATE album_reviews SET album_id = ? WHERE album_id = ?").run(toId, fromId);
  db.prepare("DELETE FROM albums WHERE id = ?").run(fromId);
}
