import {
  attachAlbumData,
  findAlbumIdByMbid,
  findAlbums,
  insertAlbum,
  type AlbumCandidate,
  type Database,
} from "@arscritica/db";
import type { AlbumLookup, MusicBrainzAlbum } from "./musicbrainz";
import type { ScrapedAlbumReview } from "./source";

export async function resolveAlbumId(
  db: Database,
  review: ScrapedAlbumReview,
  lookup?: AlbumLookup,
): Promise<number> {
  const reviewedYear = review.publishedAt
    ? new Date(review.publishedAt).getUTCFullYear()
    : undefined;
  const candidates = findAlbums(db, review.artist, review.title);
  const known = candidates.filter(
    (album) =>
      album.mbid !== null &&
      album.year !== null &&
      reviewedYear !== undefined &&
      album.year <= reviewedYear &&
      album.year >= reviewedYear - 2,
  );
  if (known.length === 1) return known[0]!.id;

  const found = await lookupSafely(review, reviewedYear, lookup);
  const untracked = candidates.filter((album) => album.mbid === null);
  if (!found) {
    const sameRelease = untracked.filter((album) =>
      reviewedWithin(album, reviewedYear === undefined ? undefined : reviewedYear - 1, 2),
    );
    return sameRelease[0]?.id ?? insertAlbum(db, toUntracked(review));
  }

  const knownId = findAlbumIdByMbid(db, found.mbid);
  if (knownId !== undefined) return knownId;
  const attachable = untracked.filter((album) => reviewedWithin(album, found.year, 2));
  if (attachable.length !== 1) return insertAlbum(db, found);
  attachAlbumData(db, attachable[0]!.id, found);
  return attachable[0]!.id;
}

async function lookupSafely(
  review: ScrapedAlbumReview,
  reviewedYear: number | undefined,
  lookup?: AlbumLookup,
): Promise<MusicBrainzAlbum | undefined> {
  try {
    return await lookup?.findAlbum(review.artist, review.title, reviewedYear);
  } catch (error) {
    console.warn(
      `MusicBrainz lookup failed for "${review.artist} – ${review.title}": ${String(error)}`,
    );
    return undefined;
  }
}

function reviewedWithin(album: AlbumCandidate, from: number | undefined, years: number): boolean {
  return (
    from === undefined ||
    album.firstReviewedYear === null ||
    (album.firstReviewedYear >= from && album.firstReviewedYear <= from + years)
  );
}

function toUntracked(review: ScrapedAlbumReview) {
  return { artistCredit: review.artist, title: review.title };
}
