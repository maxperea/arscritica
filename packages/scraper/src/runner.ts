import {
  insertReview,
  latestReviewDate,
  reviewExists,
  upsertPublication,
  type Database,
} from "@arscritica/db";
import { resolveMovieId } from "./matcher";
import type { Fetcher, ScrapedReview, Source } from "./source";
import type { MovieLookup } from "./tmdb";

export interface ScrapeOptions {
  db: Database;
  sources: Source[];
  fetcher: Fetcher;
  movieLookup?: MovieLookup;
  since?: Date;
  limit?: number;
  history?: boolean;
  deadline?: Date;
  log?: (message: string) => void;
}

export interface SourceResult {
  source: string;
  found: number;
  added: number;
  skipped: number;
  failed: number;
  error?: string;
}

export async function scrape(options: ScrapeOptions): Promise<SourceResult[]> {
  if (options.history) {
    const serialize = serialQueue();
    return Promise.all(options.sources.map((source) => scrapeSource(source, options, serialize)));
  }
  const results: SourceResult[] = [];
  for (const source of options.sources) results.push(await scrapeSource(source, options));
  return results;
}

type Serialize = <T>(task: () => Promise<T>) => Promise<T>;

function serialQueue(): Serialize {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}

async function scrapeSource(
  source: Source,
  options: ScrapeOptions,
  serialize: Serialize = (task) => task(),
): Promise<SourceResult> {
  const { db, fetcher, log = console.log } = options;
  const result: SourceResult = { source: source.slug, found: 0, added: 0, skipped: 0, failed: 0 };
  const publicationId = upsertPublication(db, {
    slug: source.slug,
    name: source.name,
    url: source.url,
    paywalled: source.paywalled,
  });
  const latest = latestReviewDate(db, publicationId);
  const since = options.since ?? (latest ? new Date(latest) : undefined);

  let urls: string[];
  try {
    urls = [
      ...new Set(
        await source.listReviewUrls({
          since,
          exhaustive: options.history,
          fetchText: (url) => fetcher.fetchText(url),
        }),
      ),
    ];
  } catch (error) {
    result.error = String(error);
    log(`[${source.slug}] listing failed: ${result.error}`);
    return result;
  }
  result.found = urls.length;

  const pending = urls.filter((url) => !reviewExists(db, url)).slice(0, options.limit);
  if (options.history) log(`[${source.slug}] ${urls.length} listed, ${pending.length} new`);
  for (const [index, url] of pending.entries()) {
    if (options.deadline && Date.now() > options.deadline.getTime()) {
      result.error = "deadline reached";
      log(`[${source.slug}] stopping at the deadline with ${pending.length - index} left`);
      break;
    }
    if (options.history && index > 0 && index % 100 === 0) {
      log(`[${source.slug}] ${index}/${pending.length}: ${result.added} added`);
    }
    try {
      const review = source.parseReview(url, await fetcher.fetchText(url));
      if (!review || !isValid(review)) {
        result.skipped++;
        log(`[${source.slug}] skipped ${url}`);
        continue;
      }
      await serialize(async () => {
        const movieId = await resolveMovieId(db, review, options.movieLookup);
        insertReview(db, {
          movieId,
          publicationId,
          url,
          sourceTitle: review.title,
          sourceYear: review.year,
          rawScore: review.rawScore,
          scaleMax: review.scaleMax,
          critic: review.critic,
          publishedAt: toIsoDateTime(review.publishedAt),
        });
      });
      result.added++;
    } catch (error) {
      result.failed++;
      log(`[${source.slug}] failed ${url}: ${String(error)}`);
    }
  }
  return result;
}

function isValid(review: ScrapedReview): boolean {
  return (
    review.title.trim().length > 0 &&
    Number.isFinite(review.rawScore) &&
    Number.isFinite(review.scaleMax) &&
    review.scaleMax > 0 &&
    review.rawScore >= 0 &&
    review.rawScore <= review.scaleMax
  );
}

function toIsoDateTime(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
