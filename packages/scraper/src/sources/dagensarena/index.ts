import { load } from "cheerio";
import type { Source } from "../../source";

const BASE_URL = "https://www.dagensarena.se";
const FEED_URL = `${BASE_URL}/arkiv/recension/feed/`;
const SCORE_PATTERN = /^Betyg:?\s*(\d)\s*\/\s*(\d+)$/;

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

export const dagensarena: Source = {
  slug: "dagensarena",
  name: "Dagens Arena",
  url: `${BASE_URL}/`,

  async listReviewUrls({ since, fetchText }) {
    const urls: string[] = [];
    for (let page = 1; ; page++) {
      let xml: string;
      try {
        xml = await fetchText(`${FEED_URL}?paged=${page}`);
      } catch (error) {
        if (page === 1) throw error;
        break;
      }
      const $ = load(xml, { xml: true });
      const items = $("item").toArray();
      let reachedOlder = false;
      for (const item of items) {
        const publishedAt = new Date($(item).children("pubDate").text());
        if (since && publishedAt < since) {
          reachedOlder = true;
          continue;
        }
        const categories = $(item)
          .children("category")
          .map((_, category) => $(category).text().trim().toLowerCase())
          .get();
        const link = $(item).children("link").text().trim();
        const content = $(item).children("content\\:encoded").text();
        if (link && categories.includes("film") && /Betyg:?\s*\d\s*\//.test(content)) {
          urls.push(link);
        }
      }
      if (items.length === 0 || reachedOlder) break;
    }
    return urls;
  },

  parseReview(_url, html) {
    const $ = load(html);
    if ($('meta[property="article:section"]').attr("content")?.toLowerCase() !== "film") {
      return null;
    }
    const content = $(".article-content").first();
    const scoreHeading = content
      .find("h3")
      .toArray()
      .find((heading) => SCORE_PATTERN.test($(heading).text().trim()));
    if (!scoreHeading) return null;
    const [, rawScore, scaleMax] = SCORE_PATTERN.exec($(scoreHeading).text().trim())!;
    const title = $(scoreHeading).prevAll("h1, h2").first().text().trim();
    if (!title) return null;

    return {
      title,
      rawScore: Number(rawScore),
      scaleMax: Number(scaleMax),
      critic: $(".article-meta--author a").first().text().trim() || undefined,
      publishedAt: parsePublished($(".article-meta--time").first().text()),
    };
  },
};

function parsePublished(text: string): string | undefined {
  const [, day, monthName, year] = /(\d{1,2}) (\p{L}+),? (\d{4})/u.exec(text.toLowerCase()) ?? [];
  const month = monthName ? swedishMonths.indexOf(monthName) : -1;
  if (month < 0) return undefined;
  return new Date(Date.UTC(Number(year), month, Number(day))).toISOString().slice(0, 10);
}
