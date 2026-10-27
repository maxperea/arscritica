import {
  attachTmdbData,
  findMovieIdByTmdbId,
  findMoviesByTitle,
  insertMovie,
  type Database,
  type MovieInput,
} from "@arscritica/db";
import type { ScrapedReview } from "./source";
import type { MovieLookup, TmdbMovie } from "./tmdb";

export async function resolveMovieId(
  db: Database,
  review: ScrapedReview,
  lookup?: MovieLookup,
): Promise<number> {
  const tmdbMovie = await lookupSafely(review, lookup);
  if (!tmdbMovie) {
    return (
      findByTitle(db, review.title, review.year, false) ??
      insertMovie(db, { title: review.title, year: review.year })
    );
  }

  const knownId = findMovieIdByTmdbId(db, tmdbMovie.id);
  if (knownId !== undefined) return knownId;

  const movie = toMovieInput(tmdbMovie);
  const untrackedId = findByTitle(db, review.title, tmdbMovie.year ?? review.year, true);
  if (untrackedId === undefined) return insertMovie(db, movie);
  attachTmdbData(db, untrackedId, movie);
  return untrackedId;
}

async function lookupSafely(
  review: ScrapedReview,
  lookup?: MovieLookup,
): Promise<TmdbMovie | undefined> {
  try {
    return await lookup?.findMovie(review.title, review.year);
  } catch (error) {
    console.warn(`TMDB lookup failed for "${review.title}": ${String(error)}`);
    return undefined;
  }
}

function findByTitle(
  db: Database,
  title: string,
  year: number | undefined,
  untrackedOnly: boolean,
): number | undefined {
  const candidates = findMoviesByTitle(db, title).filter(
    (movie) =>
      (!untrackedOnly || movie.tmdbId === null) &&
      (year === undefined || movie.year === null || movie.year === year),
  );
  const sameYear = candidates.filter((movie) => year !== undefined && movie.year === year);
  const pool = sameYear.length ? sameYear : candidates;
  return pool.length === 1 ? pool[0]!.id : undefined;
}

function toMovieInput(movie: TmdbMovie): MovieInput {
  return {
    tmdbId: movie.id,
    title: movie.title,
    originalTitle: movie.originalTitle,
    year: movie.year,
    posterPath: movie.posterPath,
  };
}
