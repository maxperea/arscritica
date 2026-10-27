import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";
import { listWordPressPostLinks } from "../wordpress";

const BASE_URL = "https://www.gamereactor.se";
const FILMS_SECTION_ID = 6;
const FILMS_SECTION_URL = `${BASE_URL}/blu-ray/`;
const SERIES_TITLE_PATTERN = /\b(säsong|season)\b/i;

interface StructuredData {
  "@type"?: string;
  author?: { name?: string };
  datePublished?: string;
  itemReviewed?: { name?: string };
  reviewRating?: { ratingValue?: number | string; bestRating?: number | string };
  itemListElement?: { position?: number; item?: { "@id"?: string } }[];
}

export const gamereactor: Source = {
  slug: "gamereactor",
  name: "Gamereactor",
  url: `${BASE_URL}/`,

  listReviewUrls(context) {
    const postsUrl = new URL("/wp-json/wp/v2/posts", BASE_URL);
    postsUrl.searchParams.set("gr_section", String(FILMS_SECTION_ID));
    return listWordPressPostLinks(postsUrl.href, context);
  },

  parseReview(_url, html) {
    const data = structuredData(load(html));
    const review = data.find((item) => item["@type"] === "Review");
    const article = data.find((item) => item["@type"] === "NewsArticle");
    const title = decodeEntities(review?.itemReviewed?.name ?? "").trim();
    const rawScore = Number(review?.reviewRating?.ratingValue);
    const scaleMax = Number(review?.reviewRating?.bestRating);
    if (!review || !title || !Number.isFinite(rawScore) || !(scaleMax > 0)) return null;
    if (!isInFilmsSection(data) || SERIES_TITLE_PATTERN.test(title)) return null;

    return {
      title,
      rawScore,
      scaleMax,
      critic: review.author?.name?.trim() || undefined,
      publishedAt: article?.datePublished,
    };
  },
};

function structuredData($: CheerioAPI): StructuredData[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script): unknown[] => {
      try {
        return [JSON.parse($(script).text())].flat();
      } catch {
        return [];
      }
    })
    .filter((data): data is StructuredData => typeof data === "object" && data !== null);
}

function isInFilmsSection(data: StructuredData[]): boolean {
  const section = data
    .find((item) => item["@type"] === "BreadcrumbList")
    ?.itemListElement?.find((element) => element.position === 2)?.item?.["@id"];
  return section === FILMS_SECTION_URL;
}

function decodeEntities(text: string): string {
  return load(text, null, false).text();
}
