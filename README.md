# Vox Critica

Filmrecensioner från svenska publikationer, samlade på ett ställe. A minimal, ad-free review
aggregator: scrapers collect reviews into SQLite, and a static Next.js site is built from it and
published on GitHub Pages.

## Layout

| Path               | What                                                               |
| ------------------ | ------------------------------------------------------------------ |
| `packages/db`      | SQLite schema, migrations, queries and sample seed (`node:sqlite`) |
| `packages/scraper` | Source plug-in interface, polite fetcher, TMDB matching, CLI       |
| `apps/web`         | Next.js static site (Swedish UI)                                   |
| `scripts`          | CI helpers (database persistence on the `data` branch)             |

## Getting started

Requires Node.js 22.13+ (see `.nvmrc`) and pnpm (`corepack enable`).

```sh
pnpm install
pnpm seed      # fictional sample data in data/arscritica.db
pnpm dev       # http://localhost:3000
```

Other commands:

```sh
pnpm scrape [--source <slug>]... [--since 2026-01-01] [--limit 20] [--db path]
pnpm backfill-details [--db path]  # fetch TMDB genres and IMDb ids for matched movies that lack them
pnpm build     # static export to apps/web/out
pnpm test
pnpm lint && pnpm format:check && pnpm typecheck
```

`TMDB_API_KEY` (v3 key or v4 read token) enables movie matching via TMDB (id, original title,
year, poster, genres in Swedish). Without it, movies are matched on normalized title and year.

## Data model

- `publications(id, slug, name, url)`
- `movies(id, tmdb_id?, title, original_title?, year?, poster_path?, slug, title_key, original_title_key?)`
- `movie_genres(movie_id, name)`: TMDB genre names, only for TMDB-matched movies
- `reviews(id, movie_id, publication_id, url UNIQUE, source_title, source_year?, raw_score, scale_max, normalized_score, critic?, published_at?, scraped_at)`

Each review keeps its raw score and scale, plus a normalized 0–100 score
(`round(raw / max * 100)`). A movie's score is the mean of its normalized review scores.
Migrations live in `packages/db/src/migrations.ts`; append new SQL to the array, never edit old
entries.

## Adding a source

A source is a plain object implementing `Source` from `packages/scraper/src/source.ts`:

```ts
interface Source {
  slug: string; // stable id, used in URLs: "aftonbladet"
  name: string; // display name: "Aftonbladet"
  url: string; // publication homepage
  listReviewUrls(context: {
    since?: Date;
    fetchText(url: string): Promise<string>;
  }): Promise<string[]>;
  parseReview(url: string, html: string): ScrapedReview | null;
}

interface ScrapedReview {
  title: string;
  year?: number;
  rawScore: number;
  scaleMax: number;
  critic?: string;
  publishedAt?: string; // anything Date can parse, ISO 8601 preferred
}
```

1. Check the site's robots.txt and terms first. The fetcher enforces robots.txt, but a source that
   is disallowed shouldn't be written at all.
2. Create `packages/scraper/src/sources/<slug>/index.ts` exporting the source. Use `cheerio`
   for HTML parsing. Always fetch through `context.fetchText`; it applies rate limiting, the
   `ArsCriticaBot` User-Agent and robots.txt rules. Use `since` to stop paging through older
   listings.
3. `parseReview` must be pure: no network access. Return `null` for pages that aren't scored
   movie reviews.
4. Register it in `packages/scraper/src/sources/index.ts`.
5. Save a real review page as `packages/scraper/src/sources/<slug>/fixtures/review.html` and add
   a parser test next to it:

```ts
// packages/scraper/src/sources/<slug>/<slug>.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { aftonbladet } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  assert.deepEqual(aftonbladet.parseReview("https://www.aftonbladet.se/…", html), {
    title: "…",
    year: 2026,
    rawScore: 4,
    scaleMax: 5,
    critic: "…",
    publishedAt: "2026-10-23T06:00:00.000Z",
  });
});
```

6. Try it for real with `pnpm scrape --source <slug> --limit 5`.

The pipeline itself (listing, robots.txt, dedupe by URL, movie matching, scoring) is covered by
`packages/scraper/src/pipeline.test.ts`, which uses a fake source against a local HTTP server.

## Deployment

`.github/workflows/scrape-and-deploy.yml` runs twice a day, on manual dispatch and on pushes to
`main`. It restores the database from the `data` branch, scrapes (not on pushes), pushes the
updated database back to `data`, builds the static site and deploys it to GitHub Pages.

One-time setup: set Settings → Pages → Source to "GitHub Actions" and add the `TMDB_API_KEY`
repository secret.

Movie data and posters come from [TMDB](https://www.themoviedb.org/). This product uses the TMDB
API but is not endorsed or certified by TMDB.
