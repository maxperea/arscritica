import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";

const BASE_URL = "https://filmbladet.se";
const LIST_URL = `${BASE_URL}/recension?kategori=filmer`;
const MAX_PAGES = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const SWEDISH_MONTHS = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];

interface ReviewLd {
  "@type"?: string;
  headline?: string;
  datePublished?: string;
  author?: { name?: string };
  itemReviewed?: { "@type"?: string; name?: string };
  reviewRating?: { ratingValue?: number | string; bestRating?: number | string };
}

export const filmbladet: Source = {
  slug: "filmbladet",
  name: "Filmbladet",
  url: `${BASE_URL}/`,

  async listReviewUrls({ since, fetchText }) {
    const urls: string[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const $ = load(await fetchText(page === 1 ? LIST_URL : `${LIST_URL}&sida=${page}`));
      const teasers = $(".reviews-grid a.rev")
        .toArray()
        .map((link) => ({
          url: $(link).attr("href") ?? "",
          date: parseListingDate($(link).find(".meta span").first().text()),
        }));
      const recent = teasers.filter(
        (teaser) => !(since && teaser.date && teaser.date.getTime() + DAY_MS <= since.getTime()),
      );
      urls.push(...recent.map((teaser) => new URL(teaser.url, BASE_URL).href));
      if (recent.length < teasers.length || teasers.length === 0) break;
    }
    return [...new Set(urls)];
  },

  parseReview(_url, html) {
    const $ = load(html);
    if (!/·\s*Film$/.test($(".article-head .kicker").text().trim())) return null;
    const review = findReview($);
    if (review?.itemReviewed?.["@type"] !== "Movie") return null;
    const title = decodeEntities(review.itemReviewed.name ?? "").trim();
    const rawScore = Number(review.reviewRating?.ratingValue);
    if (!title || review.reviewRating?.ratingValue === undefined || !Number.isFinite(rawScore)) {
      return null;
    }
    const year = Number(/(\d{4})$/.exec(review.headline?.trim() ?? "")?.[1]);
    return {
      title,
      year: year || undefined,
      rawScore,
      scaleMax: Number(review.reviewRating.bestRating) || 10,
      critic: review.author?.name?.trim() || undefined,
      publishedAt: review.datePublished ? new Date(review.datePublished).toISOString() : undefined,
    };
  },
};

function parseListingDate(text: string): Date | undefined {
  const [, day, monthName, year] =
    /^(\d{1,2}) (\p{L}+) (\d{4})$/u.exec(text.trim().toLowerCase()) ?? [];
  const month = monthName ? SWEDISH_MONTHS.indexOf(monthName) : -1;
  if (month < 0) return undefined;
  return new Date(Date.UTC(Number(year), month, Number(day)));
}

function findReview($: CheerioAPI): ReviewLd | undefined {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script): unknown[] => {
      try {
        return [JSON.parse(fillMissingValues($(script).text()))];
      } catch {
        return [];
      }
    })
    .find(
      (data): data is ReviewLd =>
        typeof data === "object" && data !== null && (data as ReviewLd)["@type"] === "Review",
    );
}

function fillMissingValues(json: string): string {
  return json.replace(/:\s*(?=[}\],])/g, ": null");
}

function decodeEntities(text: string): string {
  return load(text, null, false).text();
}
