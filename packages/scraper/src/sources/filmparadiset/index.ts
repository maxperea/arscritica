import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";
import { listWordPressPostLinks } from "../wordpress";

const BASE_URL = "https://filmparadiset.se";
const REVIEWS_CATEGORY_ID = 77;
const TV_CATEGORY_ID = 83;
const GAMES_CATEGORY_ID = 79;

interface Rating {
  ratingValue?: number | string;
  bestRating?: number | string;
}

interface ReviewLd {
  "@type"?: string;
  author?: { name?: string };
  itemReviewed?: { name?: string; review?: { reviewRating?: Rating } };
}

export const filmparadiset: Source = {
  slug: "filmparadiset",
  name: "Filmparadiset",
  url: `${BASE_URL}/`,

  async listReviewUrls(context) {
    const postsUrl = new URL("/wp-json/wp/v2/posts", BASE_URL);
    postsUrl.searchParams.set("categories", String(REVIEWS_CATEGORY_ID));
    postsUrl.searchParams.set("categories_exclude", `${TV_CATEGORY_ID},${GAMES_CATEGORY_ID}`);
    const links = await listWordPressPostLinks(postsUrl.href, context);
    return links.filter((link) => !/-tv\/?$/.test(link));
  },

  parseReview(_url, html) {
    const $ = load(html);
    const review = findReview($);
    const name = decodeEntities(review?.itemReviewed?.name ?? "").trim();
    const rating = review?.itemReviewed?.review?.reviewRating;
    const rawScore = Number(rating?.ratingValue);
    const scaleMax = Number(rating?.bestRating);
    if (!review || !name || !Number.isFinite(rawScore) || !(scaleMax > 0)) return null;
    if (!isMovieReview($) || /\bTV\)$/i.test(name)) return null;

    const [, titleWithoutYear, year] = /^(.+?)\s*\((\d{4})\)$/.exec(name) ?? [];
    return {
      title: titleWithoutYear ?? name,
      year: year ? Number(year) : undefined,
      rawScore,
      scaleMax,
      critic: review.author?.name?.trim() || undefined,
      publishedAt: $('meta[property="article:published_time"]').attr("content"),
    };
  },
};

function findReview($: CheerioAPI): ReviewLd | undefined {
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
      (data): data is ReviewLd =>
        typeof data === "object" && data !== null && (data as ReviewLd)["@type"] === "Review",
    );
}

function isMovieReview($: CheerioAPI): boolean {
  const categories = $('a[rel~="category"]')
    .toArray()
    .map((link) => /\/category\/([^?#]+)/.exec($(link).attr("href") ?? "")?.[1] ?? "");
  const inSection = (section: string) =>
    categories.some((category) => category.startsWith(`${section}/`));
  return inSection("film") && !inSection("tv") && !inSection("spel");
}

function decodeEntities(text: string): string {
  return load(text, null, false).text();
}
