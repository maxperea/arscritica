import type { Database } from "./database";
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

export interface MovieReview {
  url: string;
  rawScore: number;
  scaleMax: number;
  normalizedScore: number;
  critic: string | null;
  publishedAt: string | null;
  publicationSlug: string;
  publicationName: string;
}

export interface MovieDetail extends MovieSummary {
  reviews: MovieReview[];
}

export interface PublicationSummary {
  slug: string;
  name: string;
  url: string;
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

const movieSummarySelect = `
  SELECT m.slug, m.title, m.original_title AS originalTitle, m.year, m.poster_path AS posterPath,
    CAST(ROUND(AVG(r.normalized_score)) AS INTEGER) AS score,
    COUNT(r.id) AS reviewCount,
    MAX(${reviewedAt}) AS latestReviewAt
  FROM movies m
  JOIN reviews r ON r.movie_id = m.id`;

const publicationSummarySelect = `
  SELECT p.slug, p.name, p.url, COUNT(r.id) AS reviewCount,
    CAST(ROUND(AVG(r.normalized_score)) AS INTEGER) AS averageScore
  FROM publications p
  LEFT JOIN reviews r ON r.publication_id = p.id`;

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
       ORDER BY score DESC, reviewCount DESC, m.title
       LIMIT ?`,
    ),
    minReviews,
    `-${windowDays} days`,
    limit,
  );
}

export function getMovie(db: Database, slug: string): MovieDetail | undefined {
  const movie = getRow<MovieSummary>(
    db.prepare(`${movieSummarySelect} WHERE m.slug = ? GROUP BY m.id`),
    slug,
  );
  if (!movie) return undefined;
  const reviews = allRows<MovieReview>(
    db.prepare(
      `SELECT r.url, r.raw_score AS rawScore, r.scale_max AS scaleMax,
         r.normalized_score AS normalizedScore, r.critic, r.published_at AS publishedAt,
         p.slug AS publicationSlug, p.name AS publicationName
       FROM reviews r
       JOIN movies m ON m.id = r.movie_id
       JOIN publications p ON p.id = r.publication_id
       WHERE m.slug = ?
       ORDER BY r.normalized_score DESC, p.name`,
    ),
    slug,
  );
  return { ...movie, reviews };
}

export function listPublications(db: Database): PublicationSummary[] {
  return allRows(db.prepare(`${publicationSummarySelect} GROUP BY p.id ORDER BY p.name`));
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
       WHERE p.slug = ?
       ORDER BY ${reviewedAt} DESC, m.title`,
    ),
    slug,
  );
  return { ...publication, reviews };
}

export function movieSlugs(db: Database): string[] {
  return allRows<{ slug: string }>(
    db.prepare("SELECT DISTINCT m.slug FROM movies m JOIN reviews r ON r.movie_id = m.id"),
  ).map((row) => row.slug);
}

export function publicationSlugs(db: Database): string[] {
  return allRows<{ slug: string }>(db.prepare("SELECT slug FROM publications")).map(
    (row) => row.slug,
  );
}

export function searchIndex(db: Database): MovieSummary[] {
  return allRows(db.prepare(`${movieSummarySelect} GROUP BY m.id ORDER BY m.title`));
}
