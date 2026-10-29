import type { Database } from "./database";
import { normalizeScore } from "./score";
import { allRows, getRow } from "./sql";
import { normalizeTitle, slugify } from "./text";

export interface PublicationInput {
  slug: string;
  name: string;
  url: string;
  paywalled?: boolean;
}

export interface MovieInput {
  tmdbId?: number;
  title: string;
  originalTitle?: string;
  year?: number;
  posterPath?: string;
  genres?: string[];
}

export type WatchKind = "stream" | "rent" | "buy";

export interface WatchProvider {
  kind: WatchKind;
  providerId: number;
  name: string;
  logoPath?: string;
  displayPriority: number;
}

export interface WatchOffer {
  kind: WatchKind;
  name: string;
  url: string;
  price?: number;
}

export interface WatchmodeCandidate {
  id: number;
  tmdbId: number;
  watchmodeId: number | null;
  signature: string;
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
    `INSERT INTO publications (slug, name, url, paywalled) VALUES (:slug, :name, :url, :paywalled)
     ON CONFLICT (slug) DO UPDATE SET
       name = excluded.name, url = excluded.url, paywalled = excluded.paywalled`,
  ).run({
    slug: publication.slug,
    name: publication.name,
    url: publication.url,
    paywalled: publication.paywalled ? 1 : 0,
  });
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

export function setMovieImdbId(db: Database, movieId: number, imdbId: string | undefined): void {
  db.prepare("UPDATE movies SET imdb_id = ? WHERE id = ?").run(imdbId ?? null, movieId);
}

export function setMovieOverview(db: Database, movieId: number, overview: string): void {
  db.prepare("UPDATE movies SET overview = ? WHERE id = ?").run(overview, movieId);
}

export function setMovieEnglishOverview(db: Database, movieId: number, overview: string): void {
  db.prepare("UPDATE movies SET overview_en = ? WHERE id = ?").run(overview, movieId);
}

export function setMovieRuntime(db: Database, movieId: number, runtime: number | undefined): void {
  db.prepare(
    "UPDATE movies SET runtime = ?, runtime_checked_at = datetime('now') WHERE id = ?",
  ).run(runtime ?? null, movieId);
}

export function setMovieWatchProviders(
  db: Database,
  movieId: number,
  providers: WatchProvider[],
): void {
  db.prepare("DELETE FROM movie_watch_providers WHERE movie_id = ?").run(movieId);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO movie_watch_providers
       (movie_id, kind, provider_id, name, logo_path, display_priority)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const provider of providers) {
    insert.run(
      movieId,
      provider.kind,
      provider.providerId,
      provider.name,
      provider.logoPath ?? null,
      provider.displayPriority,
    );
  }
  db.prepare("UPDATE movies SET watch_providers_checked_at = datetime('now') WHERE id = ?").run(
    movieId,
  );
}

export function tmdbMoviesDueForWatchProviders(db: Database): { id: number; tmdbId: number }[] {
  return allRows(
    db.prepare(
      `SELECT id, tmdb_id AS tmdbId FROM movies
       WHERE tmdb_id IS NOT NULL
         AND (watch_providers_checked_at IS NULL
           OR watch_providers_checked_at < datetime('now',
             CASE WHEN year >= CAST(strftime('%Y', 'now') AS INTEGER) - 1
               THEN '-20 hours' ELSE '-7 days' END))
       ORDER BY watch_providers_checked_at IS NOT NULL, watch_providers_checked_at`,
    ),
  );
}

export function setMovieWatchmodeId(db: Database, movieId: number, watchmodeId: number): void {
  db.prepare("UPDATE movies SET watchmode_id = ? WHERE id = ?").run(watchmodeId, movieId);
}

export function setMovieWatchOffers(
  db: Database,
  movieId: number,
  offers: WatchOffer[],
  signature: string,
): void {
  db.prepare("DELETE FROM movie_watch_offers WHERE movie_id = ?").run(movieId);
  const insert = db.prepare(
    "INSERT OR IGNORE INTO movie_watch_offers (movie_id, kind, name, url, price) VALUES (?, ?, ?, ?, ?)",
  );
  for (const offer of offers) {
    insert.run(movieId, offer.kind, offer.name, offer.url, offer.price ?? null);
  }
  db.prepare(
    "UPDATE movies SET watchmode_checked_at = datetime('now'), watchmode_signature = ? WHERE id = ?",
  ).run(signature, movieId);
}

export function deleteExpiredWatchOffers(db: Database): void {
  db.prepare(
    `DELETE FROM movie_watch_offers WHERE movie_id IN (
       SELECT id FROM movies WHERE watchmode_checked_at < datetime('now', '-30 days'))`,
  ).run();
}

export function moviesDueForWatchmode(db: Database): WatchmodeCandidate[] {
  return allRows(
    db.prepare(
      `WITH current AS (
         SELECT movie_id, group_concat(kind || ':' || provider_id, ',') AS signature
         FROM (SELECT movie_id, kind, provider_id FROM movie_watch_providers
               ORDER BY movie_id, kind, provider_id)
         GROUP BY movie_id
       ), reviewed AS (
         SELECT movie_id, MAX(COALESCE(published_at, scraped_at)) AS latest
         FROM reviews GROUP BY movie_id
       )
       SELECT m.id, m.tmdb_id AS tmdbId, m.watchmode_id AS watchmodeId, c.signature
       FROM movies m
       JOIN current c ON c.movie_id = m.id
       LEFT JOIN reviewed r ON r.movie_id = m.id
       WHERE m.tmdb_id IS NOT NULL
         AND (m.watchmode_checked_at IS NULL
           OR m.watchmode_checked_at < datetime('now', '-25 days')
           OR (m.watchmode_signature IS NOT c.signature
             AND m.watchmode_checked_at < datetime('now', '-1 day')))
       ORDER BY m.watchmode_checked_at IS NOT NULL, r.latest DESC`,
    ),
  );
}

export interface DetailsCandidate {
  id: number;
  tmdbId: number;
  runtimeOnly: boolean;
}

export function tmdbMoviesMissingDetails(db: Database): DetailsCandidate[] {
  return allRows<{ id: number; tmdbId: number; runtimeOnly: number }>(
    db.prepare(
      `SELECT id, tmdb_id AS tmdbId, NOT (${missingOtherDetails}) AS runtimeOnly FROM movies m
       WHERE tmdb_id IS NOT NULL
         AND ((${missingOtherDetails})
           OR runtime_checked_at IS NULL
           OR (runtime IS NULL AND runtime_checked_at < datetime('now', '-30 days')))`,
    ),
  ).map((movie) => ({ ...movie, runtimeOnly: Boolean(movie.runtimeOnly) }));
}

const missingOtherDetails = `imdb_id IS NULL OR (overview IS NULL AND overview_en IS NULL)
  OR NOT EXISTS (SELECT 1 FROM movie_genres g WHERE g.movie_id = m.id)`;

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
