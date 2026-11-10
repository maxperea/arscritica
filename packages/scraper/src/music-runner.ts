import {
  albumReviewDuplicates,
  albumReviewExists,
  insertAlbumReview,
  latestAlbumReviewDate,
  upsertMusicPublication,
  type Database,
} from "@arscritica/db";
import { collectReviews, type CollectOptions, type SourceResult } from "./collect";
import { resolveAlbumId } from "./music-matcher";
import type { AlbumLookup } from "./musicbrainz";
import { serialQueue, toIsoDateTime, type Serialize } from "./runner";
import type { MusicSource, ScrapedAlbumReview } from "./source";

export interface MusicScrapeOptions extends CollectOptions {
  db: Database;
  sources: MusicSource[];
  albumLookup?: AlbumLookup;
  since?: Date;
}

export async function scrapeMusic(options: MusicScrapeOptions): Promise<SourceResult[]> {
  if (options.history) {
    const serialize = serialQueue();
    return Promise.all(options.sources.map((source) => scrapeSource(source, options, serialize)));
  }
  const results: SourceResult[] = [];
  for (const source of options.sources) results.push(await scrapeSource(source, options));
  return results;
}

async function scrapeSource(
  source: MusicSource,
  options: MusicScrapeOptions,
  serialize: Serialize = (task) => task(),
): Promise<SourceResult> {
  const { db } = options;
  const publicationId = upsertMusicPublication(db, {
    slug: source.slug,
    name: source.name,
    url: source.url,
    paywalled: source.paywalled,
  });
  const latest = latestAlbumReviewDate(db, publicationId);
  return collectReviews(source, options, {
    since: options.since ?? (latest ? new Date(latest) : defaultSince(options.history)),
    exists: (url) => albumReviewExists(db, url),
    isValid,
    save: (url, review) =>
      serialize(async () => {
        const publishedAt = toIsoDateTime(review.publishedAt);
        const albumId = await resolveAlbumId(db, { ...review, publishedAt }, options.albumLookup);
        const input = {
          albumId,
          publicationId,
          url,
          sourceArtist: review.artist,
          sourceTitle: review.title,
          rawScore: review.rawScore,
          scaleMax: review.scaleMax,
          critic: review.critic,
          publishedAt,
        };
        if (!albumReviewDuplicates(db, input)) insertAlbumReview(db, input);
      }),
  });
}

function defaultSince(history: boolean | undefined): Date | undefined {
  if (history) return undefined;
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  return since;
}

function isValid(review: ScrapedAlbumReview): boolean {
  return (
    review.artist.trim().length > 0 &&
    review.title.trim().length > 0 &&
    Number.isFinite(review.rawScore) &&
    Number.isFinite(review.scaleMax) &&
    review.scaleMax > 0 &&
    review.rawScore >= 0 &&
    review.rawScore <= review.scaleMax
  );
}
