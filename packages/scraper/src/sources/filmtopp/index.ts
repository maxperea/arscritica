import { load } from "cheerio";
import type { Source } from "../../source";

const listUrl = "https://www.filmtopp.se/nyheter/recensioner/";
const maxPages = 40;
const dayMs = 24 * 60 * 60 * 1000;

const swedishMonths = [
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

function parseListingDate(text: string): Date | undefined {
  const [, day, monthName, year] =
    /^(\d{1,2}) (\p{L}+) (\d{4})$/u.exec(text.trim().toLowerCase()) ?? [];
  const month = monthName ? swedishMonths.indexOf(monthName) : -1;
  if (month < 0) return undefined;
  return new Date(Date.UTC(Number(year), month, Number(day)));
}

interface CriticReviewJson {
  "@type"?: string;
  datePublished?: string;
  alternativeHeadline?: string;
  itemReviewed?: { "@type"?: string; name?: string };
  author?: { name?: string };
  reviewRating?: { ratingValue?: number | string; bestRating?: number | string };
}

function yearAfterTitle(headline: string | undefined, title: string): number | undefined {
  const index = headline?.indexOf(`${title} (`) ?? -1;
  if (!headline || index < 0) return undefined;
  const year = /^\((\d{4})\)/.exec(headline.slice(index + title.length + 1))?.[1];
  return year ? Number(year) : undefined;
}

const seriesPattern = /säsong|serie/iu;
const quotedPattern = /[”"“]([^”"“]+)[”"“]/gu;

export function parseFilmTitle(name: string): { title: string; year?: number } | null {
  if (seriesPattern.test(name)) return null;
  const headline = name.replace(/^recen[sc]ion:\s*/iu, "").trim();
  const [, titleBeforeYear, year] = /^(.+?)\s*\((\d{4})\)(?:\s*[–-].*)?$/u.exec(headline) ?? [];
  const title = titleBeforeYear ?? headline;
  const quoted = [...title.matchAll(quotedPattern)].map((match) => match[1]!.trim());
  return {
    title: quoted.length === 1 ? quoted[0]! : title,
    year: year ? Number(year) : undefined,
  };
}

function findCriticReview(html: string): CriticReviewJson | undefined {
  const $ = load(html);
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      const json = JSON.parse($(script).text()) as CriticReviewJson;
      if (json["@type"] === "CriticReview") return json;
    } catch {
      continue;
    }
  }
  return undefined;
}

export const filmtopp: Source = {
  slug: "filmtopp",
  name: "Filmtopp",
  url: "https://www.filmtopp.se/",

  async listReviewUrls({ since, fetchText }) {
    const urls: string[] = [];
    for (let page = 0; page < maxPages; page++) {
      const pageUrl = `${listUrl}?page=${page}`;
      const $ = load(await fetchText(pageUrl));
      const items = $(".search-results__item").toArray();
      let reachedOlder = false;
      for (const item of items) {
        const href = $(item).find("a.search-results__item__link").attr("href");
        if (!href?.startsWith("/recension/")) continue;
        const date = parseListingDate($(item).find(".search-results__item__meta__date").text());
        if (since && date && date.getTime() + dayMs <= since.getTime()) {
          reachedOlder = true;
          continue;
        }
        urls.push(new URL(href, pageUrl).href);
      }
      if (items.length === 0 || reachedOlder) break;
    }
    return [...new Set(urls)];
  },

  parseReview(_url, html) {
    const review = findCriticReview(html);
    if (review?.itemReviewed?.["@type"] !== "Movie") return null;
    const name = review.itemReviewed.name?.trim();
    const rawScore = Number(review.reviewRating?.ratingValue);
    const scaleMax = Number(review.reviewRating?.bestRating ?? 5);
    if (!name || !Number.isFinite(rawScore) || !(scaleMax > 0)) return null;
    const parsed = parseFilmTitle(name);
    if (!parsed) return null;
    const { title, year } = parsed;
    return {
      title,
      year: year ?? yearAfterTitle(review.alternativeHeadline, title),
      rawScore,
      scaleMax,
      critic: review.author?.name?.trim() || undefined,
      publishedAt: review.datePublished ? new Date(review.datePublished).toISOString() : undefined,
    };
  },
};
