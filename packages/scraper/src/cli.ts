import path from "node:path";
import { parseArgs } from "node:util";
import { openDatabase } from "@arscritica/db";
import { PoliteFetcher } from "./fetcher";
import { scrape } from "./runner";
import { sources } from "./sources";
import { TmdbClient } from "./tmdb";

const { values } = parseArgs({
  options: {
    source: { type: "string", multiple: true },
    since: { type: "string" },
    limit: { type: "string" },
    db: { type: "string" },
  },
});

const requested = values.source ?? [];
const unknown = requested.filter((slug) => !sources.some((source) => source.slug === slug));
if (unknown.length) {
  const available = sources.map((source) => source.slug).join(", ") || "none";
  console.error(`Unknown source(s): ${unknown.join(", ")}. Available: ${available}.`);
  process.exit(1);
}
const selected = requested.length
  ? sources.filter((source) => requested.includes(source.slug))
  : sources;

const since = values.since ? new Date(values.since) : undefined;
if (since && Number.isNaN(since.getTime())) {
  console.error(`Invalid --since date: ${values.since}`);
  process.exit(1);
}

const limit = values.limit ? Number(values.limit) : undefined;
if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) {
  console.error(`Invalid --limit: ${values.limit}`);
  process.exit(1);
}

const movieLookup = TmdbClient.fromEnv();
if (!movieLookup) console.warn("TMDB_API_KEY is not set; matching movies by title and year only.");

const invocationDir = process.env.INIT_CWD ?? process.cwd();
const db = openDatabase({ path: values.db ? path.resolve(invocationDir, values.db) : undefined });
try {
  if (!selected.length) console.log("No sources registered.");
  const results = await scrape({
    db,
    sources: selected,
    fetcher: new PoliteFetcher(),
    movieLookup,
    since,
    limit,
  });
  if (results.length) console.table(results);
  if (results.some((result) => result.error)) process.exitCode = 1;
} finally {
  db.close();
}
