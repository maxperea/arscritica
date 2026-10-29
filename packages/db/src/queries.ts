import type { Database } from "./database";
import type { WatchKind } from "./writes";
import { allRows, getRow } from "./sql";

export interface MovieSummary {
  slug: string;
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterPath: string | null;
  score: number;
  reviewCount: number;
  latestReviewAt: string;
}

export interface TopListWatchProvider {
  kind: WatchKind;
  name: string;
}

export interface TopListMovie extends MovieSummary {
  firstReviewedAt: string;
  genres: string[];
  watchProviders: TopListWatchProvider[];
}

export interface MovieReview {
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

export interface MovieWatchProvider {
  kind: WatchKind;
  name: string;
  logoPath: string | null;
  url: string | null;
}

export interface MovieDetail extends MovieSummary {
  tmdbId: number;
  imdbId: string | null;
  overview: string | null;
  runtime: number | null;
  watchProviders: MovieWatchProvider[];
  reviews: MovieReview[];
}

export interface PublicationSummary {
  slug: string;
  name: string;
  url: string;
  paywalled: boolean;
  reviewCount: number;
  averageScore: number | null;
}

export interface PublicationReview {
  url: string;
  rawScore: number;
  scaleMax: number;
  normalizedScore: number;
  critic: string | null;
  publishedAt: string | null;
  movieSlug: string;
  movieTitle: string;
  movieYear: number | null;
}

export interface PublicationDetail extends PublicationSummary {
  reviews: PublicationReview[];
}

export interface BestMoviesOptions {
  limit?: number;
  minReviews?: number;
  windowDays?: number;
}

const reviewedAt = "COALESCE(r.published_at, r.scraped_at)";
const matchedMovie = "m.tmdb_id IS NOT NULL";

const movieSummaryColumns = `
  m.slug, m.title, m.original_title AS originalTitle, m.year, m.poster_path AS posterPath,
    CAST(ROUND(AVG(r.normalized_score)) AS INTEGER) AS score,
    COUNT(r.id) AS reviewCount,
    MAX(${reviewedAt}) AS latestReviewAt`;

const movieSummaryFrom = `
  FROM movies m
  JOIN reviews r ON r.movie_id = m.id AND ${matchedMovie}`;

const movieSummarySelect = `SELECT ${movieSummaryColumns} ${movieSummaryFrom}`;

const publicationSummarySelect = `
  SELECT p.slug, p.name, p.url, p.paywalled, COUNT(r.id) AS reviewCount,
    CAST(ROUND(AVG(r.normalized_score)) AS INTEGER) AS averageScore
  FROM publications p
  LEFT JOIN (reviews r JOIN movies m ON m.id = r.movie_id AND ${matchedMovie})
    ON r.publication_id = p.id`;

export function recentlyReviewedMovies(db: Database, limit = 12): MovieSummary[] {
  return allRows(
    db.prepare(`${movieSummarySelect} GROUP BY m.id ORDER BY latestReviewAt DESC, m.title LIMIT ?`),
    limit,
  );
}

export function bestMoviesRightNow(
  db: Database,
  { limit = 10, minReviews = 2, windowDays = 60 }: BestMoviesOptions = {},
): MovieSummary[] {
  return allRows(
    db.prepare(
      `${movieSummarySelect}
       GROUP BY m.id
       HAVING COUNT(r.id) >= ?
         AND MIN(${reviewedAt}) >= (
           SELECT strftime('%Y-%m-%dT%H:%M:%fZ', MAX(COALESCE(published_at, scraped_at)), ?)
           FROM reviews
         )
         AND (m.year IS NULL OR m.year >= (
           SELECT CAST(strftime('%Y', MAX(COALESCE(published_at, scraped_at))) AS INTEGER) - 1
           FROM reviews
         ))
       ORDER BY score DESC, reviewCount DESC, m.title
       LIMIT ?`,
    ),
    minReviews,
    `-${windowDays} days`,
    limit,
  );
}

const watchmodeNames: Record<string, string> = {
  "Amazon Video": "Amazon",
  "Amazon Prime Video": "Prime Video",
  "Apple TV Store": "AppleTV",
  "Apple TV": "AppleTV+",
  "Apple TV Amazon Channel": "AppleTV+ Amazon Channel",
  "Disney Plus": "Disney+",
  "SVT Play": "SVT",
  Cineasterna: "Cineasterna (Library Card)",
  "HBO Max Amazon Channel": "HBO Max (Via Amazon Prime)",
  "MGM Amazon Channel": "MGM+ (Via Amazon Prime)",
  Crunchyroll: "Crunchyroll Premium",
};

function watchOfferName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9+]/g, "");
}

export function getMovie(db: Database, slug: string): MovieDetail | undefined {
  const movie = getRow<MovieSummary>(
    db.prepare(`${movieSummarySelect} WHERE m.slug = ? GROUP BY m.id`),
    slug,
  );
  if (!movie) return undefined;
  const details = getRow<{
    id: number;
    tmdbId: number;
    imdbId: string | null;
    overview: string | null;
    runtime: number | null;
  }>(
    db.prepare(
      "SELECT id, tmdb_id AS tmdbId, imdb_id AS imdbId, overview, runtime FROM movies WHERE slug = ?",
    ),
    slug,
  );
  if (!details) return undefined;
  const offers = allRows<{ name: string; url: string }>(
    db.prepare(
      `SELECT o.name, o.url FROM movie_watch_offers o
       JOIN movies m ON m.id = o.movie_id
       WHERE o.movie_id = ? AND m.watchmode_checked_at >= datetime('now', '-30 days')`,
    ),
    details.id,
  );
  const urlsByService = new Map(offers.map((offer) => [watchOfferName(offer.name), offer.url]));
  const watchProviders = allRows<Omit<MovieWatchProvider, "url">>(
    db.prepare(
      `SELECT kind, name, logo_path AS logoPath FROM movie_watch_providers
       WHERE movie_id = ? ORDER BY display_priority, name`,
    ),
    details.id,
  ).map((provider) => {
    const name = watchOfferName(watchmodeNames[provider.name] ?? provider.name);
    return {
      ...provider,
      url: urlsByService.get(name) ?? null,
    };
  });
  const reviews = allRows<MovieReview>(
    db.prepare(
      `SELECT r.url, r.raw_score AS rawScore, r.scale_max AS scaleMax,
         r.normalized_score AS normalizedScore, r.critic, r.published_at AS publishedAt,
         p.slug AS publicationSlug, p.name AS publicationName,
         p.paywalled AS publicationPaywalled
       FROM reviews r
       JOIN movies m ON m.id = r.movie_id
       JOIN publications p ON p.id = r.publication_id
       WHERE m.slug = ?
       ORDER BY r.normalized_score DESC, p.name`,
    ),
    slug,
  );
  return {
    ...movie,
    tmdbId: details.tmdbId,
    imdbId: details.imdbId,
    overview: details.overview || null,
    runtime: details.runtime,
    watchProviders,
    reviews: reviews.map((review) => ({
      ...review,
      publicationPaywalled: Boolean(review.publicationPaywalled),
    })),
  };
}

export function listPublications(db: Database): PublicationSummary[] {
  return allRows<PublicationSummary>(
    db.prepare(`${publicationSummarySelect} GROUP BY p.id ORDER BY p.name`),
  ).map(withPaywalledFlag);
}

export function getPublication(db: Database, slug: string): PublicationDetail | undefined {
  const publication = getRow<PublicationSummary>(
    db.prepare(`${publicationSummarySelect} WHERE p.slug = ? GROUP BY p.id`),
    slug,
  );
  if (!publication) return undefined;
  const reviews = allRows<PublicationReview>(
    db.prepare(
      `SELECT r.url, r.raw_score AS rawScore, r.scale_max AS scaleMax,
         r.normalized_score AS normalizedScore, r.critic, r.published_at AS publishedAt,
         m.slug AS movieSlug, m.title AS movieTitle, m.year AS movieYear
       FROM reviews r
       JOIN movies m ON m.id = r.movie_id
       JOIN publications p ON p.id = r.publication_id
       WHERE p.slug = ? AND ${matchedMovie}
       ORDER BY ${reviewedAt} DESC, m.title`,
    ),
    slug,
  );
  return { ...withPaywalledFlag(publication), reviews };
}

function withPaywalledFlag(publication: PublicationSummary): PublicationSummary {
  return { ...publication, paywalled: Boolean(publication.paywalled) };
}

export function movieSlugs(db: Database): string[] {
  return allRows<{ slug: string }>(db.prepare(`SELECT DISTINCT m.slug ${movieSummaryFrom}`)).map(
    (row) => row.slug,
  );
}

export function publicationSlugs(db: Database): string[] {
  return allRows<{ slug: string }>(db.prepare("SELECT slug FROM publications")).map(
    (row) => row.slug,
  );
}

export function searchIndex(db: Database): MovieSummary[] {
  return allRows(db.prepare(`${movieSummarySelect} GROUP BY m.id ORDER BY m.title`));
}

export function topListMovies(db: Database): TopListMovie[] {
  return allRows<
    Omit<TopListMovie, "genres" | "watchProviders"> & { genres: string; watchProviders: string }
  >(
    db.prepare(
      `SELECT ${movieSummaryColumns}, MIN(${reviewedAt}) AS firstReviewedAt,
         (SELECT json_group_array(name) FROM
           (SELECT name FROM movie_genres g WHERE g.movie_id = m.id ORDER BY name)) AS genres,
         (SELECT json_group_array(json_object('kind', kind, 'name', name))
           FROM movie_watch_providers w WHERE w.movie_id = m.id) AS watchProviders
       ${movieSummaryFrom}
       GROUP BY m.id
       ORDER BY score DESC, reviewCount DESC, m.title`,
    ),
  ).map((movie) => ({
    ...movie,
    genres: JSON.parse(movie.genres) as string[],
    watchProviders: JSON.parse(movie.watchProviders) as TopListWatchProvider[],
  }));
}
