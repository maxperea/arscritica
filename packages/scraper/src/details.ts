import {
  setMovieEnglishOverview,
  setMovieGenres,
  setMovieImdbId,
  setMovieOverview,
  setMovieRuntime,
  tmdbMoviesMissingDetails,
  type Database,
  type DetailsCandidate,
} from "@arscritica/db";
import type { TmdbMovieDetails } from "./tmdb";

export interface DetailsClient {
  movieDetails(tmdbId: number): Promise<TmdbMovieDetails>;
  englishOverview(tmdbId: number): Promise<string | undefined>;
}

export interface DetailsBackfillResult {
  candidates: number;
  detailsUpdated: number;
  runtimeFound: number;
  runtimeMissing: number;
  failed: number;
}

export async function backfillMovieDetails(
  db: Database,
  tmdb: DetailsClient,
): Promise<DetailsBackfillResult> {
  const movies = tmdbMoviesMissingDetails(db);
  const result: DetailsBackfillResult = {
    candidates: movies.length,
    detailsUpdated: 0,
    runtimeFound: 0,
    runtimeMissing: 0,
    failed: 0,
  };
  for (const movie of movies) {
    try {
      const details = await tmdb.movieDetails(movie.tmdbId);
      if (!movie.runtimeOnly) {
        await updateDetails(db, tmdb, movie, details);
        if (details.genres.length || details.imdbId) result.detailsUpdated++;
      }
      setMovieRuntime(db, movie.id, details.runtime);
      if (details.runtime) result.runtimeFound++;
      else result.runtimeMissing++;
    } catch (error) {
      console.warn(`TMDB details lookup failed for movie ${movie.tmdbId}: ${String(error)}`);
      result.failed++;
    }
  }
  return result;
}

async function updateDetails(
  db: Database,
  tmdb: DetailsClient,
  movie: DetailsCandidate,
  details: TmdbMovieDetails,
): Promise<void> {
  const englishOverview = details.overview ? undefined : await tmdb.englishOverview(movie.tmdbId);
  setMovieGenres(db, movie.id, details.genres);
  setMovieImdbId(db, movie.id, details.imdbId);
  if (details.overview) setMovieOverview(db, movie.id, details.overview);
  else if (englishOverview) setMovieEnglishOverview(db, movie.id, englishOverview);
  else setMovieOverview(db, movie.id, "");
}
