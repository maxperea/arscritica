import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";
import { listWordPressPostLinks } from "../wordpress";

const BASE_URL = "https://www.moviezine.se";
const REVIEWS_API_URL = `${BASE_URL}/wp-json/wp/v2/recensioner`;
const SERIES_FACT_PATTERN = /skapad av|avsnitt|säsong/i;

interface CriticReviewLd {
  "@type"?: string;
  author?: { name?: string };
  datePublished?: string;
  itemReviewed?: { name?: string; datePublished?: string };
  reviewRating?: { ratingValue?: number | string; bestRating?: number | string };
}

export const moviezine: Source = {
  slug: "moviezine",
  name: "MovieZine",
  url: BASE_URL,

  listReviewUrls(context) {
    return listWordPressPostLinks(REVIEWS_API_URL, context);
  },

  parseReview(_url, html) {
    const $ = load(html);
    const review = findCriticReview($);
    const title = decodeEntities(review?.itemReviewed?.name ?? "").trim();
    const rawScore = Number(review?.reviewRating?.ratingValue);
    if (!review || !title || !Number.isFinite(rawScore) || isSeriesReview($)) return null;

    const releaseYear = new Date(review.itemReviewed?.datePublished ?? "").getUTCFullYear();
    return {
      title,
      year: Number.isNaN(releaseYear) ? undefined : releaseYear,
      rawScore,
      scaleMax: Number(review.reviewRating?.bestRating) || 5,
      critic: review.author?.name?.trim() || undefined,
      publishedAt: review.datePublished,
    };
  },
};

function findCriticReview($: CheerioAPI): CriticReviewLd | undefined {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script): unknown[] => {
      try {
        return [JSON.parse($(script).text())].flat();
      } catch {
        return [];
      }
    })
    .find(
      (data): data is CriticReviewLd =>
        typeof data === "object" &&
        data !== null &&
        ["CriticReview", "Review"].includes((data as CriticReviewLd)["@type"] ?? ""),
    );
}

function isSeriesReview($: CheerioAPI): boolean {
  if ($("article.typ-serie, article.typ-serier").length > 0) return true;
  return $(".entry-content p")
    .toArray()
    .filter((paragraph) => $(paragraph).find("strong").text().includes("Genre"))
    .some((factBox) => SERIES_FACT_PATTERN.test($(factBox).text()));
}

function decodeEntities(text: string): string {
  return load(text, null, false).text();
}
