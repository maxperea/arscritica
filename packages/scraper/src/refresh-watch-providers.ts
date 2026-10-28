import path from "node:path";
import { parseArgs } from "node:util";
import {
  openDatabase,
  setMovieWatchProviders,
  tmdbMoviesDueForWatchProviders,
} from "@arscritica/db";
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
  const movies = tmdbMoviesDueForWatchProviders(db);
  let available = 0;
  for (const movie of movies) {
    try {
      const providers = await tmdb.swedishWatchProviders(movie.tmdbId);
      setMovieWatchProviders(db, movie.id, providers);
      if (providers.length) available++;
    } catch (error) {
      console.warn(
        `TMDB watch providers lookup failed for movie ${movie.tmdbId}: ${String(error)}`,
      );
      process.exitCode = 1;
    }
  }
  console.log(`Refreshed watch providers for ${movies.length} movies, ${available} available.`);
} finally {
  db.close();
}
