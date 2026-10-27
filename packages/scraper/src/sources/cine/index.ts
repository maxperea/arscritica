import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";

const BASE_URL = "https://cine.se";
const REVIEW_URL = /^https:\/\/cine\.se\/recensioner\/[^/]+\/$/;
const REVIEW_SITEMAPS = [`${BASE_URL}/review-sitemap.xml`, `${BASE_URL}/review-sitemap2.xml`];

interface SitemapEntry {
  loc: string;
  lastmod?: Date;
}

interface ReviewLd {
  "@type"?: string;
  datePublished?: string;
  author?: { name?: string };
  itemReviewed?: { "@type"?: string; name?: string; dateCreated?: string };
  reviewRating?: { ratingValue?: number | string; bestRating?: number | string };
}

export const cine: Source = {
  slug: "cine",
  name: "Ciné",
  url: `${BASE_URL}/`,

  async listReviewUrls({ since, fetchText }) {
    const entries: SitemapEntry[] = [];
    for (const sitemap of REVIEW_SITEMAPS) {
      entries.push(...parseSitemap(await fetchText(sitemap)));
    }
    return entries
      .filter((entry) => REVIEW_URL.test(entry.loc))
      .filter((entry) => !since || !entry.lastmod || entry.lastmod >= since)
      .sort((a, b) => (b.lastmod?.getTime() ?? 0) - (a.lastmod?.getTime() ?? 0))
      .map((entry) => entry.loc);
  },

  parseReview(_url, html) {
    const review = findReview(load(html));
    if (review?.itemReviewed?.["@type"] !== "Movie") return null;
    const title = decodeEntities(review.itemReviewed.name ?? "").trim();
    const rawScore = Number(review.reviewRating?.ratingValue);
    if (!title || review.reviewRating?.ratingValue === undefined || !Number.isFinite(rawScore)) {
      return null;
    }
    const year = Number(review.itemReviewed.dateCreated?.slice(0, 4));
    return {
      title,
      year: year || undefined,
      rawScore,
      scaleMax: Number(review.reviewRating.bestRating) || 5,
      critic: review.author?.name?.trim() || undefined,
      publishedAt: review.datePublished ? new Date(review.datePublished).toISOString() : undefined,
    };
  },
};

function parseSitemap(xml: string): SitemapEntry[] {
  const $ = load(xml, { xml: true });
  return $("url")
    .map((_, element) => {
      const lastmod = new Date($(element).children("lastmod").text().trim());
      return {
        loc: $(element).children("loc").text().trim(),
        lastmod: Number.isNaN(lastmod.getTime()) ? undefined : lastmod,
      };
    })
    .get();
}

function findReview($: CheerioAPI): ReviewLd | undefined {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script): unknown[] => {
      try {
        return [JSON.parse($(script).text())];
      } catch {
        return [];
      }
    })
    .find(
      (data): data is ReviewLd =>
        typeof data === "object" && data !== null && (data as ReviewLd)["@type"] === "Review",
    );
}

function decodeEntities(text: string): string {
  return load(text, null, false).text();
}
