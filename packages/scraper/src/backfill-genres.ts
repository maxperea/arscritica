import path from "node:path";
import { parseArgs } from "node:util";
import { openDatabase, setMovieGenres, tmdbMoviesWithoutGenres } from "@arscritica/db";
import { TmdbClient } from "./tmdb";

const { values } = parseArgs({ options: { db: { type: "string" } } });

const tmdb = TmdbClient.fromEnv();
if (!tmdb) {
  console.error("TMDB_API_KEY is not set.");
  process.exit(1);
}

const invocationDir = process.env.INIT_CWD ?? process.cwd();
const db = openDatabase({ path: values.db ? path.resolve(invocationDir, values.db) : undefined });
try {
  const movies = tmdbMoviesWithoutGenres(db);
  let updated = 0;
  for (const movie of movies) {
    try {
      const genres = await tmdb.movieGenres(movie.tmdbId);
      setMovieGenres(db, movie.id, genres);
      if (genres.length) updated++;
    } catch (error) {
      console.warn(`TMDB genre lookup failed for movie ${movie.tmdbId}: ${String(error)}`);
      process.exitCode = 1;
    }
  }
  console.log(`Added genres to ${updated} of ${movies.length} movies.`);
} finally {
  db.close();
}
