import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";

const BASE_URL = "https://www.sverigesradio.se";
const SITEMAP_INDEX_URL = `${BASE_URL}/sitemap`;
const FILM_EYEBROW_PATTERN = /FILM/;
const NON_FILM_EYEBROW_PATTERN = /TV|SERIE/;
const NUMBER_WORDS: Record<string, number> = {
  ett: 1,
  en: 1,
  etta: 1,
  två: 2,
  tvåa: 2,
  tre: 3,
  trea: 3,
  fyra: 4,
  fem: 5,
  femma: 5,
};
const GRADE_PATTERNS = [
  /(?<!del )\b(\d|ett|en|två|tre|fyra|fem)\s*(?:\/|av)\s*(?:5(?!\d)|fem\b)/i,
  /(?:ger|får|blir|betyg\w*)[^.!?]{0,40}?\b(etta|tvåa|trea|fyra|femma)\b/i,
  /\b(etta|tvåa|trea|fyra|femma|ett|en|två|tre|fem)\s+i\s+betyg/i,
];
const TOP_GRADE_PATTERN = /högsta (?:möjliga )?betyg/i;

interface SitemapEntry {
  loc: string;
  lastmod?: Date;
}

interface NewsArticleLd {
  "@type"?: string;
  datePublished?: string;
}

export const sr: Source = {
  slug: "sr",
  name: "SR Kulturnytt i P1",
  url: `${BASE_URL}/kulturnytt`,

  async listReviewUrls({ since, fetchText }) {
    const publishSitemaps = parseSitemap(await fetchText(SITEMAP_INDEX_URL), "sitemap")
      .filter((entry) => /type=publish&id=\d+/.test(entry.loc))
      .sort((a, b) => sitemapId(b.loc) - sitemapId(a.loc));

    const reviews: SitemapEntry[] = [];
    for (const sitemap of publishSitemaps) {
      const entries = parseSitemap(await fetchText(sitemap.loc), "url");
      reviews.push(
        ...entries.filter(
          (entry) =>
            /\/artikel\/[^/]*recension/.test(entry.loc) &&
            (!since || !entry.lastmod || entry.lastmod >= since),
        ),
      );
      if (since && entries.some((entry) => entry.lastmod && entry.lastmod < since)) break;
    }
    return reviews
      .sort((a, b) => (b.lastmod?.getTime() ?? 0) - (a.lastmod?.getTime() ?? 0))
      .map((entry) => entry.loc);
  },

  parseReview(_url, html) {
    const $ = load(html);
    const article = $("article").first();
    const eyebrow = article.find("span.uppercase").first().text().trim();
    if (!FILM_EYEBROW_PATTERN.test(eyebrow) || NON_FILM_EYEBROW_PATTERN.test(eyebrow)) {
      return null;
    }

    const headline = article.find("h1").first().text().trim();
    const seoTitle = ($("meta[property='og:title']").attr("content") ?? "").replace(
      / \| Sveriges Radio$/,
      "",
    );
    const rawScore = findGrade([seoTitle, headline, article.text()].join("\n"));
    const title = quoted(headline) ?? quoted(seoTitle) ?? quoted(article.text());
    if (!rawScore || !title) return null;

    return {
      title,
      rawScore,
      scaleMax: 5,
      critic: article.find("span.title-s").first().text().trim() || undefined,
      publishedAt: findNewsArticle($)?.datePublished,
    };
  },
};

function findGrade(text: string): number | undefined {
  for (const pattern of GRADE_PATTERNS) {
    const value = pattern.exec(text)?.[1]?.toLowerCase();
    if (value) return Number(value) || NUMBER_WORDS[value];
  }
  return TOP_GRADE_PATTERN.test(text) ? 5 : undefined;
}

function quoted(text: string): string | undefined {
  return /[”"“]([^”"“]+)[”"“]/.exec(text)?.[1]?.trim() || undefined;
}

function findNewsArticle($: CheerioAPI): NewsArticleLd | undefined {
  return $("script[type='application/ld+json']")
    .map((_, element) => {
      try {
        return JSON.parse($(element).text()) as NewsArticleLd;
      } catch {
        return undefined;
      }
    })
    .get()
    .find((data: NewsArticleLd) => data["@type"] === "NewsArticle");
}

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

function sitemapId(url: string): number {
  return Number(/id=(\d+)/.exec(url)?.[1] ?? 0);
}
