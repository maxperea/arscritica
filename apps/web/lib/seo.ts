import type { Metadata } from "next";
import type { AlbumDetail, MovieDetail } from "@arscritica/db";
import { posterUrl, reviewCountLabel } from "./format";

export const siteName = "Vox Critica";
export const siteOrigin = "https://voxcritica.se";

export function absoluteUrl(path: string): string {
  return `${siteOrigin}${process.env.ARSCRITICA_BASE_PATH ?? ""}${path}`;
}

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  image?: string;
  robots?: Metadata["robots"];
}

export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  image,
  robots,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const images = image ? [image] : undefined;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    robots,
    openGraph: {
      type: "website",
      siteName,
      locale: "sv_SE",
      url,
      title,
      description,
      images,
    },
    twitter: { card: "summary", title, description, images },
  };
}

export function moviePageTitle(movie: Pick<MovieDetail, "title" | "year">): string {
  const name = movie.year ? `${movie.title} (${movie.year})` : movie.title;
  const full = `${name} – recensioner och betyg`;
  return full.length <= 60 ? full : `${name} – recensioner`;
}

export function movieDescription(
  movie: Pick<MovieDetail, "title" | "year" | "score" | "reviewCount" | "watchProviders">,
): string {
  const name = movie.year ? `${movie.title} (${movie.year})` : movie.title;
  const scoreLabel = movie.reviewCount === 1 ? "betyget" : "kritikersnittet";
  const kinds = new Set(movie.watchProviders.map((provider) => provider.kind));
  const where = kinds.has("stream")
    ? " och se var filmen streamas"
    : kinds.size
      ? " och se var filmen kan hyras eller köpas"
      : "";
  const read = movie.reviewCount === 1 ? "Läs recensionen" : "Läs recensionerna";
  return (
    `${name} har ${scoreLabel} ${movie.score} från ${reviewCountLabel(movie.reviewCount)} ` +
    `i svensk press. ${read}${where}.`
  );
}

export function movieJsonLd(movie: MovieDetail, path: string): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    url: absoluteUrl(path),
    ...(movie.year ? { datePublished: String(movie.year) } : {}),
    ...(movie.posterPath ? { image: posterUrl(movie.posterPath, "w500") } : {}),
    ...(movie.imdbId ? { sameAs: `https://www.imdb.com/title/${movie.imdbId}/` } : {}),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: movie.score,
      bestRating: 100,
      worstRating: 0,
      reviewCount: movie.reviewCount,
    },
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function albumPageTitle(album: Pick<AlbumDetail, "title" | "artistCredit">): string {
  const name = `${album.title} av ${album.artistCredit}`;
  const full = `${name} – recensioner och betyg`;
  if (full.length <= 60) return full;
  return name.length <= 48 ? `${name} – recensioner` : `${album.title} – recensioner`;
}

export function albumDescription(
  album: Pick<AlbumDetail, "title" | "artistCredit" | "year" | "score" | "reviewCount">,
): string {
  const name = `${album.title} av ${album.artistCredit}${album.year ? ` (${album.year})` : ""}`;
  const scoreLabel = album.reviewCount === 1 ? "betyget" : "kritikersnittet";
  const read = album.reviewCount === 1 ? "Läs recensionen" : "Läs recensionerna";
  return (
    `${name} har ${scoreLabel} ${album.score} från ${reviewCountLabel(album.reviewCount)} ` +
    `i svensk press. ${read}.`
  );
}

function albumSourceUrl(
  album: Pick<AlbumDetail, "mbid" | "discogsMasterId" | "discogsReleaseId">,
): string | undefined {
  if (album.mbid) return `https://musicbrainz.org/release-group/${album.mbid}`;
  if (album.discogsMasterId) return `https://www.discogs.com/master/${album.discogsMasterId}`;
  if (album.discogsReleaseId) return `https://www.discogs.com/release/${album.discogsReleaseId}`;
  return undefined;
}

export function albumJsonLd(album: AlbumDetail, path: string): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    name: album.title,
    url: absoluteUrl(path),
    byArtist: { "@type": "MusicGroup", name: album.artistCredit },
    albumReleaseType: album.kind === "ep" ? "EPRelease" : "AlbumRelease",
    ...(album.year ? { datePublished: String(album.year) } : {}),
    ...(album.coverUrl ? { image: album.coverUrl } : {}),
    ...(album.trackCount ? { numTracks: album.trackCount } : {}),
    ...(albumSourceUrl(album) ? { sameAs: albumSourceUrl(album) } : {}),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: album.score,
      bestRating: 100,
      worstRating: 0,
      reviewCount: album.reviewCount,
    },
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
