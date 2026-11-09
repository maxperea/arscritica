import path from "node:path";
import { parseArgs } from "node:util";
import { openDatabase } from "@arscritica/db";
import { PoliteFetcher } from "./fetcher";
import { MusicBrainzClient } from "./musicbrainz";
import { scrapeMusic } from "./music-runner";
import { musicSources } from "./music-sources";
import { scrape } from "./runner";
import { sources as filmSources } from "./sources";
import { TmdbClient } from "./tmdb";

const { values } = parseArgs({
  options: {
    source: { type: "string", multiple: true },
    since: { type: "string" },
    limit: { type: "string" },
    history: { type: "boolean", default: false },
    music: { type: "boolean", default: false },
    "max-minutes": { type: "string" },
    db: { type: "string" },
  },
});

const sources: { slug: string }[] = values.music ? musicSources : filmSources;
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

const historyStart = "2010-01-01";
const sinceText = values.since ?? (values.history ? historyStart : undefined);
const since = sinceText ? new Date(sinceText) : undefined;
if (since && Number.isNaN(since.getTime())) {
  console.error(`Invalid --since date: ${values.since}`);
  process.exit(1);
}

const limit = values.limit ? Number(values.limit) : undefined;
if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) {
  console.error(`Invalid --limit: ${values.limit}`);
  process.exit(1);
}

const maxMinutes = values["max-minutes"] ? Number(values["max-minutes"]) : undefined;
if (maxMinutes !== undefined && !(maxMinutes > 0)) {
  console.error(`Invalid --max-minutes: ${values["max-minutes"]}`);
  process.exit(1);
}
const deadline = maxMinutes ? new Date(Date.now() + maxMinutes * 60_000) : undefined;

const movieLookup = values.music ? undefined : TmdbClient.fromEnv();
if (!values.music && !movieLookup) {
  console.warn("TMDB_API_KEY is not set; matching movies by title and year only.");
}

const invocationDir = process.env.INIT_CWD ?? process.cwd();
const db = openDatabase({ path: values.db ? path.resolve(invocationDir, values.db) : undefined });
try {
  if (!selected.length) console.log("No sources registered.");
  const options = {
    db,
    fetcher: new PoliteFetcher(),
    since,
    limit,
    history: values.history,
    deadline,
  };
  const results = values.music
    ? await scrapeMusic({
        ...options,
        sources: musicSources.filter((source) => selected.includes(source)),
        albumLookup: new MusicBrainzClient(),
      })
    : await scrape({
        ...options,
        sources: filmSources.filter((source) => selected.includes(source)),
        movieLookup,
      });
  if (results.length) console.table(results);
  if (results.some((result) => result.error)) process.exitCode = 1;
} finally {
  db.close();
}
