import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";

const LIST_URL = "https://www.aftonbladet.se/tagg/filmrecensioner";
const FILM_ARTICLE = /^https:\/\/www\.aftonbladet\.se\/nojesbladet\/film\/a\//;
const MAX_PAGES = 10;

interface LinkedData {
  "@type"?: string;
  articleSection?: string;
  datePublished?: string;
  author?: { name?: string }[];
  itemReviewed?: { name?: string };
  reviewRating?: { ratingValue?: number; bestRating?: number };
}

export const aftonbladet: Source = {
  slug: "aftonbladet",
  name: "Aftonbladet",
  url: "https://www.aftonbladet.se/nojesbladet/film",

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
      urls.push(...recent.map((teaser) => teaser.url).filter((url) => FILM_ARTICLE.test(url)));
      if (recent.length < teasers.length || teasers.length === 0) break;
    }
    return urls;
  },

  parseReview(_url, html) {
    const $ = load(html);
    const linkedData = readLinkedData($);
    const article = linkedData.find((entry) => entry["@type"] === "NewsArticle");
    const review = linkedData.find((entry) => entry["@type"] === "Review");
    const rating = review?.reviewRating;
    if (article?.articleSection !== "Film" || rating?.ratingValue === undefined) return null;

    const title = factBoxTitle($) ?? cleanItemName(review?.itemReviewed?.name ?? "");
    if (!title) return null;

    return {
      title,
      rawScore: rating.ratingValue,
      scaleMax: rating.bestRating ?? 5,
      critic: review?.author?.[0]?.name,
      publishedAt: review?.datePublished ?? article.datePublished,
    };
  },
};

function readLinkedData($: CheerioAPI): LinkedData[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script) => {
      try {
        return [JSON.parse($(script).text()) as LinkedData];
      } catch {
        return [];
      }
    });
}

function factBoxTitle($: CheerioAPI): string | undefined {
  const grade = $('.article-body svg[aria-label^="Betyg"]').first();
  return grade.closest("p").next("h2").text().trim() || undefined;
}

function cleanItemName(name: string): string {
  return name
    .replace(/\s+[–-]\s+(här är recensionen|så bra är).*$/i, "")
    .replace(/,?\s+recension\b.*$/i, "")
    .trim();
}
