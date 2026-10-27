import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";

const BASE_URL = "https://www.moviezine.se";
const SITEMAP_INDEX_URL = `${BASE_URL}/sitemap_index.xml`;
const SERIES_FACT_PATTERN = /skapad av|avsnitt|säsong/i;

interface SitemapEntry {
  loc: string;
  lastmod?: Date;
}

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

  async listReviewUrls({ since, fetchText }) {
    const reviewSitemaps = parseSitemap(await fetchText(SITEMAP_INDEX_URL), "sitemap")
      .filter((entry) => /\/recensioner-sitemap\d*\.xml$/.test(entry.loc))
      .sort((a, b) => sitemapNumber(b.loc) - sitemapNumber(a.loc));

    const reviews: SitemapEntry[] = [];
    for (const sitemap of reviewSitemaps) {
      if (since && sitemap.lastmod && sitemap.lastmod < since) break;
      const entries = parseSitemap(await fetchText(sitemap.loc), "url");
      reviews.push(
        ...entries.filter((entry) => !since || !entry.lastmod || entry.lastmod >= since),
      );
    }
    return reviews
      .sort((a, b) => (b.lastmod?.getTime() ?? 0) - (a.lastmod?.getTime() ?? 0))
      .map((entry) => entry.loc);
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

function parseSitemap(xml: string, tag: "sitemap" | "url"): SitemapEntry[] {
  const $ = load(xml, { xml: true });
  return $(tag)
    .map((_, element) => {
      const lastmod = new Date($(element).children("lastmod").text().trim());
      return {
        loc: $(element).children("loc").text().trim(),
        lastmod: Number.isNaN(lastmod.getTime()) ? undefined : lastmod,
      };
    })
    .get()
    .filter((entry) => entry.loc);
}

function sitemapNumber(url: string): number {
  return Number(/recensioner-sitemap(\d*)\.xml$/.exec(url)?.[1] || 1);
}

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
