import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { openDatabase } from "@arscritica/db";
import { coverThumbnailKey } from "@arscritica/db/text";
import { MUSICBRAINZ_USER_AGENT } from "./musicbrainz";

const SIZE = 88;
const RETRY_AFTER_DAYS = 30;
const FAILURES_FILE = "failures.json";

const { values } = parseArgs({
  options: {
    db: { type: "string" },
    dir: { type: "string", default: "apps/web/public/covers" },
    limit: { type: "string" },
    "delay-ms": { type: "string", default: "1500" },
  },
});

const invocationDir = process.env.INIT_CWD ?? process.cwd();
const dir = path.resolve(invocationDir, values.dir!);
mkdirSync(dir, { recursive: true });
const db = openDatabase({ path: values.db ? path.resolve(invocationDir, values.db) : undefined });
const urls = (
  db
    .prepare(
      "SELECT DISTINCT cover_thumbnail_url AS url FROM albums WHERE cover_thumbnail_url IS NOT NULL ORDER BY id DESC",
    )
    .all() as {
    url: string;
  }[]
).map((row) => row.url);
db.close();

const failuresPath = path.join(dir, FAILURES_FILE);
const failures: Record<string, string> = existsSync(failuresPath)
  ? JSON.parse(readFileSync(failuresPath, "utf8"))
  : {};
const retryBefore = Date.now() - RETRY_AFTER_DAYS * 24 * 60 * 60 * 1000;
const pending = urls.filter((url) => {
  const key = coverThumbnailKey(url);
  if (!key || existsSync(path.join(dir, `${key}.webp`))) return false;
  return !failures[key] || Date.parse(failures[key]) < retryBefore;
});
const queue = values.limit ? pending.slice(0, Number(values.limit)) : pending;
const delayMs = Number(values["delay-ms"]);

let created = 0;
let failed = 0;
for (const [index, url] of queue.entries()) {
  const key = coverThumbnailKey(url)!;
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: { "user-agent": MUSICBRAINZ_USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const image = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(SIZE, SIZE, { fit: "cover" })
      .webp({ quality: 72 })
      .toBuffer();
    writeFileSync(path.join(dir, `${key}.webp`), image);
    delete failures[key];
    created++;
  } catch (error) {
    failures[key] = new Date().toISOString();
    failed++;
    console.warn(`Cover thumbnail failed for ${url}: ${String(error)}`);
  }
  if ((index + 1) % 100 === 0) {
    writeFileSync(failuresPath, `${JSON.stringify(failures, null, 1)}\n`);
    console.log(`${index + 1}/${queue.length}: ${created} created, ${failed} failed`);
  }
  await sleep(Math.max(0, delayMs - (Date.now() - started)));
}
writeFileSync(failuresPath, `${JSON.stringify(failures, null, 1)}\n`);
console.log(`Created ${created} and failed ${failed} of ${queue.length} missing cover thumbnails.`);
