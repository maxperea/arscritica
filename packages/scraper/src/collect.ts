import type { Fetcher, ListContext } from "./source";

export interface CollectOptions {
  fetcher: Fetcher;
  limit?: number;
  history?: boolean;
  deadline?: Date;
  log?: (message: string) => void;
}

export interface CollectSource<R> {
  slug: string;
  listReviewUrls(context: ListContext): Promise<string[]>;
  parseReview(url: string, html: string): R | null;
}

export interface ReviewSink<R> {
  since?: Date;
  exists(url: string): boolean;
  isValid(review: R): boolean;
  save(url: string, review: R): Promise<void>;
}

export interface SourceResult {
  source: string;
  found: number;
  added: number;
  skipped: number;
  failed: number;
  error?: string;
}

export async function collectReviews<R>(
  source: CollectSource<R>,
  options: CollectOptions,
  sink: ReviewSink<R>,
): Promise<SourceResult> {
  const { fetcher, log = console.log } = options;
  const result: SourceResult = { source: source.slug, found: 0, added: 0, skipped: 0, failed: 0 };

  let urls: string[];
  try {
    urls = [
      ...new Set(
        await source.listReviewUrls({
          since: sink.since,
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

  const pending = urls.filter((url) => !sink.exists(url)).slice(0, options.limit);
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
      if (!review || !sink.isValid(review)) {
        result.skipped++;
        log(`[${source.slug}] skipped ${url}`);
        continue;
      }
      await sink.save(url, review);
      result.added++;
    } catch (error) {
      result.failed++;
      log(`[${source.slug}] failed ${url}: ${String(error)}`);
    }
  }
  return result;
}
