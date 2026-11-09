import { load } from "cheerio";
import type { MusicSource } from "../../source";
import { listWordPressPostLinks } from "../../sources/wordpress";

const BASE_URL = "https://kulturbloggen.com";
const RECORD_REVIEW_CATEGORY_ID = 22;
const FACT_BLOCK_LINE_COUNT = 5;
const BARE_SCORE_PATTERN = /^([1-5])(?:$|(?=\p{Lu}\p{Ll}))/u;
const LABELED_SCORE_PATTERN = /^Betyg(?::\s*|\s+)([1-5])(?:\s*(?:\/|av)\s*5)?$/i;
const LABELED_ARTIST_PATTERN = /^Artist(?::\s*|\s+)(.+)$/;
const LABELED_TITLE_PATTERN = /^(?:Titel|Album)(?::\s*|\s+)(.+)$/;
const ROUNDUP_HEADLINE_PATTERN = /veckans skiv/i;
const COMPILATION_ARTIST_PATTERN = /^(v\/a|various artists|diverse artister|blandade artister)$/i;
const EXCLUDED_TITLE_PATTERN =
  /\(live\b|\blive (at|in|from|på|i)\b|\b(singel|single|best of|greatest hits|samlingsalbum|samlingsskiva|deluxe|anniversary|remaster(ed)?|reissue|nyutgåva|box ?set|boxen)\b/i;

interface AlbumFacts {
  artist: string;
  title: string;
  rawScore: number;
}

export const kulturbloggen: MusicSource = {
  slug: "kulturbloggen",
  name: "Kulturbloggen",
  url: `${BASE_URL}/`,

  listReviewUrls(context) {
    const postsUrl = new URL(BASE_URL);
    postsUrl.searchParams.set("rest_route", "/wp/v2/posts");
    postsUrl.searchParams.set("categories", String(RECORD_REVIEW_CATEGORY_ID));
    return listWordPressPostLinks(postsUrl.href, context);
  },

  parseReview(_url, html) {
    const $ = load(html);
    const article = $("article").first();
    if (!$("body").hasClass("single-post") || !article.hasClass("category-skivor")) return null;
    if (ROUNDUP_HEADLINE_PATTERN.test(article.find(".entry-title").first().text())) return null;

    const paragraphs = article
      .find(".entry-content p")
      .toArray()
      .map((paragraph) => $(paragraph).html() ?? "");
    const coverCaption = article.find(".entry-content > figure:first-child figcaption").text();
    const lines = contentLines([coverCaption, ...paragraphs]);
    const facts = labeledFacts(lines) ?? bareFacts(lines);
    if (!facts || COMPILATION_ARTIST_PATTERN.test(facts.artist)) return null;
    if (EXCLUDED_TITLE_PATTERN.test(facts.title)) return null;

    return {
      ...facts,
      scaleMax: 5,
      critic: cleanText(article.find(".entry-author-name").first().text()) || undefined,
      publishedAt:
        article.find("time.entry-time").attr("datetime") ??
        $('meta[property="article:published_time"]').attr("content"),
    };
  },
};

function contentLines(paragraphs: string[]): string[] {
  return paragraphs
    .flatMap((paragraph) => paragraph.split(/<br\s*\/?>/))
    .map((line) => cleanText(load(line, null, false).text()))
    .filter(Boolean);
}

function labeledFacts(lines: string[]): AlbumFacts | null {
  const scores = matches(lines, LABELED_SCORE_PATTERN);
  if (scores.length === 0) return null;
  const artists = matches(lines, LABELED_ARTIST_PATTERN);
  const titles = matches(lines, LABELED_TITLE_PATTERN);
  if (scores.length !== 1 || artists.length !== 1 || titles.length !== 1) return null;
  return { artist: artists[0]!, title: titles[0]!, rawScore: Number(scores[0]) };
}

function bareFacts(lines: string[]): AlbumFacts | null {
  const scoreIndex = lines.findIndex(
    (line, index) => index >= 2 && index < FACT_BLOCK_LINE_COUNT && BARE_SCORE_PATTERN.test(line),
  );
  if (scoreIndex < 0) return null;
  return {
    artist: lines[scoreIndex - 2]!,
    title: lines[scoreIndex - 1]!,
    rawScore: Number(BARE_SCORE_PATTERN.exec(lines[scoreIndex]!)![1]),
  };
}

function matches(lines: string[], pattern: RegExp): string[] {
  return lines.flatMap((line) => {
    const match = pattern.exec(line);
    return match ? [cleanText(match[1]!)] : [];
  });
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
    .trim();
}
