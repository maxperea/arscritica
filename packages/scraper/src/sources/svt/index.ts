import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";

const BASE_URL = "https://www.svt.se";
const GRAPHQL_URL = "https://api.svt.se/newsqlear/graphql";
const TAG_PATH = "/nyheter/om/filmrecension";
const TAG_FEED_QUERY_HASH = "88edd5adfb8acdfdfb7ba21ef61f64285673c1c3ed4b42ab3084cb1fc61e96d3";
const MAX_PAGES = 100;
const SERIES_FACT_PATTERN = /avsnitt|säsong|dramaserie|tv-serie/i;
const GRADE_PATTERN = /Betyg:?\s*(\d)(\+)?(?:\s*(?:\/|av)\s*5)?/i;

interface TagFeedResponse {
  data?: {
    page?: {
      feed?: { cursor?: string | null; items?: { url?: string; date?: string }[] };
    };
  };
  errors?: unknown;
}

interface LinkedData {
  "@type"?: string;
  headline?: string;
  datePublished?: string;
  author?: { name?: string }[];
}

export const svt: Source = {
  slug: "svt",
  name: "SVT Kulturnyheterna",
  url: `${BASE_URL}/kultur/`,

  async listReviewUrls({ since, fetchText }) {
    const urls: string[] = [];
    let cursor = "0";
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = JSON.parse(await fetchText(tagFeedUrl(cursor))) as TagFeedResponse;
      const feed = response.data?.page?.feed;
      if (!feed) throw new Error(`SVT tag feed failed: ${JSON.stringify(response.errors)}`);
      const items = (feed.items ?? []).filter((item) => item.url && item.date);
      const recent = items.filter((item) => !(since && new Date(item.date ?? "") < since));
      urls.push(...recent.map((item) => new URL(item.url ?? "", BASE_URL).href));
      if (recent.length < items.length || !feed.cursor || items.length === 0) break;
      cursor = feed.cursor;
    }
    return urls;
  },

  parseReview(_url, html) {
    const $ = load(html);
    const factBox = $("section[class*='InlineFactbox']").first();
    const facts = factBox.find("[class*='InlineFactbox__body']").text();
    const grade = GRADE_PATTERN.exec(facts);
    if (!grade || SERIES_FACT_PATTERN.test(facts)) return null;

    const article = readLinkedData($).find((entry) => entry["@type"] === "NewsArticle");
    const title = reviewTitle(
      stripQuotes(factBox.find("[class*='InlineFactbox__title']").text()),
      article?.headline ?? "",
    );
    if (!title) return null;

    return {
      title,
      rawScore: Number(grade[1]) + (grade[2] ? 0.5 : 0),
      scaleMax: 5,
      critic: article?.author?.[0]?.name,
      publishedAt: article?.datePublished,
    };
  },
};

function tagFeedUrl(cursor: string): string {
  const params = new URLSearchParams({
    operationName: "TagFeedPaginationQuery",
    variables: JSON.stringify({ cursor, path: TAG_PATH }),
    extensions: JSON.stringify({
      persistedQuery: { sha256Hash: TAG_FEED_QUERY_HASH, version: 1 },
    }),
  });
  return `${GRAPHQL_URL}?${params}`;
}

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

function reviewTitle(factBoxTitle: string, headline: string): string | undefined {
  if (!factBoxTitle || /^fakta$/i.test(factBoxTitle)) {
    return /[”"“]([^”"“]+)[”"“]/.exec(headline)?.[1]?.trim() || undefined;
  }
  const start = headline.toLowerCase().indexOf(factBoxTitle.toLowerCase());
  if (start >= 0) return headline.slice(start, start + factBoxTitle.length);
  if (factBoxTitle !== factBoxTitle.toLowerCase()) return factBoxTitle;
  return factBoxTitle.charAt(0).toUpperCase() + factBoxTitle.slice(1);
}

function stripQuotes(text: string): string {
  return text.replace(/[”"“]/g, "").trim();
}
