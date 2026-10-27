import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";

const LIST_URL = "https://www.svd.se/tagg/filmrecensioner";
const ARTICLE_URL = /^https:\/\/www\.svd\.se\/a\//;
const MAX_PAGES = 12;

interface LinkedData {
  "@type"?: string;
  datePublished?: string;
  author?: { name?: string }[];
  itemReviewed?: { "@type"?: string; name?: string };
  reviewRating?: { ratingValue?: number | string; bestRating?: number | string };
}

export const svd: Source = {
  slug: "svd",
  name: "SvD",
  url: "https://www.svd.se/tagg/filmrecensioner",
  paywalled: true,

  async listReviewUrls({ since, fetchText }) {
    const urls: string[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const $ = load(await fetchText(page === 1 ? LIST_URL : `${LIST_URL}?page=${page}`));
      const teasers = $("article a.teaser")
        .toArray()
        .map((link) => ({
          url: $(link).attr("href") ?? "",
          date: new Date($(link).find("time[datetime]").attr("datetime") ?? ""),
        }));
      const recent = teasers.filter((teaser) => !(since && teaser.date < since));
      urls.push(...recent.map((teaser) => teaser.url).filter((url) => ARTICLE_URL.test(url)));
      if (recent.length < teasers.length || teasers.length === 0) break;
    }
    return urls;
  },

  parseReview(_url, html) {
    const linkedData = readLinkedData(load(html));
    const review = linkedData.find((entry) => entry["@type"] === "Review");
    const article = linkedData.find((entry) => entry["@type"]?.endsWith("Article"));
    const title = review?.itemReviewed?.name?.trim();
    const rawScore = Number(review?.reviewRating?.ratingValue);
    if (review?.itemReviewed?.["@type"] !== "Movie" || !title || !Number.isFinite(rawScore)) {
      return null;
    }

    return {
      title,
      rawScore,
      scaleMax: Number(review.reviewRating?.bestRating) || 6,
      critic: review.author?.[0]?.name?.trim() || undefined,
      publishedAt: review.datePublished ?? article?.datePublished,
    };
  },
};

function readLinkedData($: CheerioAPI): LinkedData[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script) => {
      try {
        return [JSON.parse($(script).text()) as LinkedData | LinkedData[]].flat();
      } catch {
        return [];
      }
    });
}
