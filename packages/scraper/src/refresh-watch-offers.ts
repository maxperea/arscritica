import path from "node:path";
import { parseArgs } from "node:util";
import {
  deleteExpiredWatchOffers,
  moviesDueForWatchmode,
  openDatabase,
  setMovieWatchmodeId,
  setMovieWatchOffers,
} from "@arscritica/db";
import { WatchmodeClient, WatchmodeQuotaExhausted } from "./watchmode";

const { values } = parseArgs({
  options: {
    db: { type: "string" },
    limit: { type: "string", default: "400" },
    reserve: { type: "string", default: "100" },
  },
});

const watchmode = WatchmodeClient.fromEnv();
if (!watchmode) {
  console.error("WATCHMODE_API_KEY is not set.");
  process.exit(1);
}

const invocationDir = process.env.INIT_CWD ?? process.cwd();
const db = openDatabase({ path: values.db ? path.resolve(invocationDir, values.db) : undefined });
try {
  deleteExpiredWatchOffers(db);
  const movies = moviesDueForWatchmode(db).slice(0, Number(values.limit));
  const unmapped = movies.filter((movie) => movie.watchmodeId === null);
  if (unmapped.length) {
    const ids = await watchmode.watchmodeIds(new Set(unmapped.map((movie) => movie.tmdbId)));
    for (const movie of unmapped) {
      const watchmodeId = ids.get(movie.tmdbId);
      if (watchmodeId === undefined) continue;
      setMovieWatchmodeId(db, movie.id, watchmodeId);
      movie.watchmodeId = watchmodeId;
    }
  }
  let refreshed = 0;
  for (const movie of movies) {
    if (watchmode.creditsLeft < Number(values.reserve)) {
      console.log(`Stopping with ${watchmode.creditsLeft} Watchmode credits left.`);
      break;
    }
    try {
      const offers = await watchmode.swedishOffers(movie.watchmodeId ?? `movie-${movie.tmdbId}`);
      setMovieWatchOffers(db, movie.id, offers, movie.signature);
      refreshed++;
    } catch (error) {
      console.warn(`Watchmode lookup failed for movie ${movie.tmdbId}: ${String(error)}`);
      process.exitCode = 1;
      if (error instanceof WatchmodeQuotaExhausted) break;
    }
  }
  console.log(
    `Refreshed watch links for ${refreshed} of ${movies.length} movies, ${watchmode.creditsLeft} credits left.`,
  );
} finally {
  db.close();
}
