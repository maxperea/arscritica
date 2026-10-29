import type { Metadata } from "next";
import type { MovieDetail } from "@arscritica/db";
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
