import {
  insertReview,
  latestReviewDate,
  reviewExists,
  upsertPublication,
  type Database,
} from "@arscritica/db";
import { collectReviews, type CollectOptions, type SourceResult } from "./collect";
import { resolveMovieId } from "./matcher";
import type { ScrapedReview, Source } from "./source";

export type { SourceResult } from "./collect";
import type { MovieLookup } from "./tmdb";

export interface ScrapeOptions extends CollectOptions {
  db: Database;
  sources: Source[];
  movieLookup?: MovieLookup;
  since?: Date;
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

export type Serialize = <T>(task: () => Promise<T>) => Promise<T>;

export function serialQueue(): Serialize {
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
  const { db } = options;
  const publicationId = upsertPublication(db, {
    slug: source.slug,
    name: source.name,
    url: source.url,
    paywalled: source.paywalled,
  });
  const latest = latestReviewDate(db, publicationId);
  return collectReviews(source, options, {
    since: options.since ?? (latest ? new Date(latest) : undefined),
    exists: (url) => reviewExists(db, url),
    isValid,
    save: (url, review) =>
      serialize(async () => {
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
      }),
  });
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

export function toIsoDateTime(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
