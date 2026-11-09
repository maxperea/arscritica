import path from "node:path";
import { parseArgs } from "node:util";
import { openDatabase } from "@arscritica/db";
import { rematchRecentAlbums } from "./music-matcher";
import { MusicBrainzClient } from "./musicbrainz";

const { values } = parseArgs({
  options: { db: { type: "string" }, days: { type: "string", default: "30" } },
});

const invocationDir = process.env.INIT_CWD ?? process.cwd();
const db = openDatabase({ path: values.db ? path.resolve(invocationDir, values.db) : undefined });
try {
  const result = await rematchRecentAlbums(db, new MusicBrainzClient(), Number(values.days));
  console.log(`Matched ${result.matched} of ${result.checked} recently reviewed unmatched albums.`);
} finally {
  db.close();
}
