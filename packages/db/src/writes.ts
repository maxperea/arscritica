import type { Database } from "./database";
import { normalizeScore } from "./score";
import { allRows, getRow } from "./sql";
import { normalizeTitle, slugify } from "./text";

export interface PublicationInput {
  slug: string;
  name: string;
  url: string;
}

export interface MovieInput {
  tmdbId?: number;
  title: string;
  originalTitle?: string;
  year?: number;
  posterPath?: string;
  genres?: string[];
}

export interface MovieCandidate {
  id: number;
  tmdbId: number | null;
  year: number | null;
}

export interface ReviewInput {
  movieId: number;
  publicationId: number;
  url: string;
  sourceTitle: string;
  sourceYear?: number;
  rawScore: number;
  scaleMax: number;
  critic?: string;
  publishedAt?: string;
  scrapedAt?: string;
}

export function upsertPublication(db: Database, publication: PublicationInput): number {
  db.prepare(
    `INSERT INTO publications (slug, name, url) VALUES (:slug, :name, :url)
     ON CONFLICT (slug) DO UPDATE SET name = excluded.name, url = excluded.url`,
  ).run({ slug: publication.slug, name: publication.name, url: publication.url });
  return getRow<{ id: number }>(
    db.prepare("SELECT id FROM publications WHERE slug = ?"),
    publication.slug,
  )!.id;
}

export function findMovieIdByTmdbId(db: Database, tmdbId: number): number | undefined {
  return getRow<{ id: number }>(db.prepare("SELECT id FROM movies WHERE tmdb_id = ?"), tmdbId)?.id;
}

export function findMoviesByTitle(db: Database, title: string): MovieCandidate[] {
  const key = normalizeTitle(title);
  return allRows<MovieCandidate>(
    db.prepare(
      "SELECT id, tmdb_id AS tmdbId, year FROM movies WHERE title_key = ? OR original_title_key = ?",
    ),
    key,
    key,
  );
}

export function insertMovie(db: Database, movie: MovieInput): number {
  const result = db
    .prepare(
      `INSERT INTO movies (tmdb_id, title, original_title, year, poster_path, slug, title_key, original_title_key)
       VALUES (:tmdbId, :title, :originalTitle, :year, :posterPath, :slug, :titleKey, :originalTitleKey)`,
    )
    .run({ ...movieColumns(movie), slug: uniqueMovieSlug(db, movie) });
  const movieId = Number(result.lastInsertRowid);
  if (movie.genres) setMovieGenres(db, movieId, movie.genres);
  return movieId;
}

export function attachTmdbData(db: Database, movieId: number, movie: MovieInput): void {
  db.prepare(
    `UPDATE movies SET tmdb_id = :tmdbId, title = :title, original_title = :originalTitle,
       year = COALESCE(:year, year), poster_path = :posterPath, title_key = :titleKey,
       original_title_key = :originalTitleKey
     WHERE id = :id`,
  ).run({ ...movieColumns(movie), id: movieId });
  if (movie.genres) setMovieGenres(db, movieId, movie.genres);
}

export function setMovieGenres(db: Database, movieId: number, genres: string[]): void {
  db.prepare("DELETE FROM movie_genres WHERE movie_id = ?").run(movieId);
  const insert = db.prepare("INSERT OR IGNORE INTO movie_genres (movie_id, name) VALUES (?, ?)");
  for (const genre of genres) insert.run(movieId, genre);
}

export function tmdbMoviesWithoutGenres(db: Database): { id: number; tmdbId: number }[] {
  return allRows(
    db.prepare(
      `SELECT id, tmdb_id AS tmdbId FROM movies m
       WHERE tmdb_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM movie_genres g WHERE g.movie_id = m.id)`,
    ),
  );
}

export function reviewExists(db: Database, url: string): boolean {
  return getRow(db.prepare("SELECT 1 AS found FROM reviews WHERE url = ?"), url) !== undefined;
}

export function latestReviewDate(db: Database, publicationId: number): string | undefined {
  const row = getRow<{ latest: string | null }>(
    db.prepare(
      "SELECT MAX(COALESCE(published_at, scraped_at)) AS latest FROM reviews WHERE publication_id = ?",
    ),
    publicationId,
  );
  return row?.latest ?? undefined;
}

export function insertReview(db: Database, review: ReviewInput): number {
  const result = db
    .prepare(
      `INSERT INTO reviews (movie_id, publication_id, url, source_title, source_year, raw_score,
         scale_max, normalized_score, critic, published_at, scraped_at)
       VALUES (:movieId, :publicationId, :url, :sourceTitle, :sourceYear, :rawScore,
         :scaleMax, :normalizedScore, :critic, :publishedAt, :scrapedAt)`,
    )
    .run({
      movieId: review.movieId,
      publicationId: review.publicationId,
      url: review.url,
      sourceTitle: review.sourceTitle,
      sourceYear: review.sourceYear ?? null,
      rawScore: review.rawScore,
      scaleMax: review.scaleMax,
      normalizedScore: normalizeScore(review.rawScore, review.scaleMax),
      critic: review.critic ?? null,
      publishedAt: review.publishedAt ?? null,
      scrapedAt: review.scrapedAt ?? new Date().toISOString(),
    });
  return Number(result.lastInsertRowid);
}

function movieColumns(movie: MovieInput) {
  return {
    tmdbId: movie.tmdbId ?? null,
    title: movie.title,
    originalTitle: movie.originalTitle ?? null,
    year: movie.year ?? null,
    posterPath: movie.posterPath ?? null,
    titleKey: normalizeTitle(movie.title),
    originalTitleKey: movie.originalTitle ? normalizeTitle(movie.originalTitle) : null,
  };
}

function uniqueMovieSlug(db: Database, movie: MovieInput): string {
  const base = slugify(`${movie.title} ${movie.year ?? ""}`) || "film";
  const taken = db.prepare("SELECT 1 AS taken FROM movies WHERE slug = ?");
  let slug = base;
  for (let suffix = 2; getRow(taken, slug); suffix++) slug = `${base}-${suffix}`;
  return slug;
}
