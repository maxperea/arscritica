import path from "node:path";
import { parseArgs } from "node:util";
import { openDatabase } from "@arscritica/db";
import { backfillMovieDetails } from "./details";
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
  const result = await backfillMovieDetails(db, tmdb);
  console.log(
    `Added details to ${result.detailsUpdated} of ${result.candidates} movies. ` +
      `Runtime found for ${result.runtimeFound}, unavailable for ${result.runtimeMissing}, ` +
      `failed for ${result.failed}.`,
  );
  if (result.failed) process.exitCode = 1;
} finally {
  db.close();
}
