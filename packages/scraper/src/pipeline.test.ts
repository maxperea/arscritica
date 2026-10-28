import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { getMovie, openDatabase } from "@arscritica/db";
import { normalizeTitle } from "@arscritica/db/text";
import { PoliteFetcher } from "./fetcher";
import { scrape } from "./runner";
import { createExampleSource } from "./testing/example-source";
import type { MovieLookup } from "./tmdb";

const reviewPage = (title: string, year: number, score: number) =>
  `<h1>${title}</h1><span data-year="${year}"></span><span data-score="${score}"></span>` +
  `<p class="critic">Test Testsson</p><time datetime="2026-10-01">1 okt</time>`;

const pages: Record<string, string> = {
  "/robots.txt": "User-agent: *\nDisallow: /exempel/privat/\n",
  "/exempel/":
    '<a class="review" href="sommarnatt">1</a><a class="review" href="trasig">2</a>' +
    '<a class="review" href="privat/hemlig">3</a><a class="review" href="/exempel/sommarnatt">4</a>',
  "/exempel/sommarnatt": reviewPage("Sommarnatt", 2026, 4),
  "/exempel/trasig": "<h1>Trasig</h1>",
  "/exempel/privat/hemlig": reviewPage("Hemlig", 2026, 5),
  "/demo/":
    '<a class="review" href="sommarnatt-recension">1</a><a class="review" href="vinterljus">2</a>',
  "/demo/sommarnatt-recension": reviewPage("SOMMARNATT!", 2026, 2),
  "/demo/vinterljus": reviewPage("Vinterljus", 2025, 5),
};

const tmdbIds = new Map<string, number>();
const movieLookup: MovieLookup = {
  async findMovie(title, year) {
    const key = normalizeTitle(title);
    if (!tmdbIds.has(key)) tmdbIds.set(key, tmdbIds.size + 1);
    return { id: tmdbIds.get(key)!, title: key, originalTitle: key, year, genres: [] };
  },
};

const requests: string[] = [];
const server = createServer((request, response) => {
  const path = request.url ?? "";
  requests.push(path);
  const body = pages[path];
  response.writeHead(body === undefined ? 404 : 200, {
    "content-type": "text/html; charset=utf-8",
  });
  response.end(body ?? "");
});
let baseUrl = "";

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

test("scrapes sources politely, dedupes by URL and aggregates scores per movie", async () => {
  const db = openDatabase({ path: ":memory:" });
  const run = () =>
    scrape({
      db,
      sources: [createExampleSource("exempel", baseUrl), createExampleSource("demo", baseUrl)],
      fetcher: new PoliteFetcher({ minDelayMs: 0 }),
      movieLookup,
      log: () => {},
    });

  assert.deepEqual(await run(), [
    { source: "exempel", found: 3, added: 1, skipped: 1, failed: 1 },
    { source: "demo", found: 2, added: 2, skipped: 0, failed: 0 },
  ]);
  assert.ok(!requests.includes("/exempel/privat/hemlig"));

  const movie = getMovie(db, "sommarnatt-2026");
  assert.equal(movie?.score, 60);
  assert.deepEqual(
    movie?.reviews.map((review) => [review.publicationSlug, review.normalizedScore]),
    [
      ["exempel", 80],
      ["demo", 40],
    ],
  );

  const firstRunRequests = requests.length;
  assert.deepEqual(
    (await run()).map((result) => result.added),
    [0, 0],
  );
  assert.ok(!requests.slice(firstRunRequests).includes("/exempel/sommarnatt"));
  db.close();
});
