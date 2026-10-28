import path from "node:path";
import { parseArgs } from "node:util";
import {
  openDatabase,
  setMovieGenres,
  setMovieImdbId,
  setMovieEnglishOverview,
  setMovieOverview,
  tmdbMoviesMissingDetails,
  type Database,
} from "@arscritica/db";
import { TmdbClient, type TmdbMovieDetails } from "./tmdb";

const { values } = parseArgs({ options: { db: { type: "string" } } });

const tmdb = TmdbClient.fromEnv();
if (!tmdb) {
  console.error("TMDB_API_KEY is not set.");
  process.exit(1);
}

const invocationDir = process.env.INIT_CWD ?? process.cwd();
const db = openDatabase({ path: values.db ? path.resolve(invocationDir, values.db) : undefined });
try {
  const movies = tmdbMoviesMissingDetails(db);
  let updated = 0;
  for (const movie of movies) {
    try {
      const details = await tmdb.movieDetails(movie.tmdbId);
      setMovieGenres(db, movie.id, details.genres);
      setMovieImdbId(db, movie.id, details.imdbId);
      await updateOverview(db, tmdb, movie, details);
      if (details.genres.length || details.imdbId) updated++;
    } catch (error) {
      console.warn(`TMDB details lookup failed for movie ${movie.tmdbId}: ${String(error)}`);
      process.exitCode = 1;
    }
  }
  console.log(`Added details to ${updated} of ${movies.length} movies.`);
} finally {
  db.close();
}

async function updateOverview(
  db: Database,
  tmdb: TmdbClient,
  movie: { id: number; tmdbId: number },
  details: TmdbMovieDetails,
): Promise<void> {
  if (details.overview) return setMovieOverview(db, movie.id, details.overview);
  const english = await tmdb.englishOverview(movie.tmdbId);
  if (english) setMovieEnglishOverview(db, movie.id, english);
  else setMovieOverview(db, movie.id, "");
}
