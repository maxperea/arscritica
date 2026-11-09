import { load, type CheerioAPI } from "cheerio";
import type { MusicSource, ScrapedAlbumReview } from "../../source";

const LIST_URL = "https://www.aftonbladet.se/tagg/skivrecensioner";
const MUSIC_ARTICLE = /^https:\/\/www\.aftonbladet\.se\/nojesbladet\/musik\/a\//;
const MAX_PAGES = 10;
const ITEM_NAME_PATTERN = /^(.+?):\s*(.+?)\s*[-–]\s*Recension$/;
const QUOTE_PATTERN = /[”"“]/;
const QUOTED_PATTERN = /^[”"“](.+)[”"“]$/;
const ALBUM_LABELS = new Set(["ALBUM", "EP"]);
const LABEL_PATTERN = /^([A-ZÅÄÖ]{2,})\s/;
const VARIOUS_ARTISTS_PATTERN = /^(diverse|blandade|various)\s+artist(er|s)$|^v\/a$/i;
const NOT_AN_ALBUM_PATTERN =
  /\b(live|singel|singlar|box|samling|samlingsbox|deluxe|remaster(ed)?|greatest hits|best of|jubileumsutgåva|nyutgåva|återutgåva)\b/i;
const GRADE_LABEL_PATTERNS: [RegExp, number][] = [
  [/^Betyg (\d) av 6$/, 1],
  [/^Betyg:? (\d) av 5(?: plus)?$/, 0],
];

interface Person {
  name?: string;
}

interface LinkedData {
  "@type"?: string;
  articleSection?: string;
  datePublished?: string;
  description?: string;
  reviewBody?: string;
  author?: Person[];
  itemReviewed?: { name?: string };
  reviewRating?: { ratingValue?: number | string; bestRating?: number | string };
}

interface Score {
  rawScore: number;
  scaleMax: number;
}

export const aftonbladet: MusicSource = {
  slug: "aftonbladet",
  name: "Aftonbladet",
  url: "https://www.aftonbladet.se/nojesbladet/musik",

  async listReviewUrls({ since, exhaustive, fetchText }) {
    const urls = new Set<string>();
    for (let page = 1; page <= (exhaustive ? Infinity : MAX_PAGES); page++) {
      const $ = load(await fetchText(page === 1 ? LIST_URL : `${LIST_URL}?page=${page}`));
      const teasers = $("article a.teaser")
        .toArray()
        .map((link) => ({
          url: $(link).attr("href") ?? "",
          date: new Date($(link).find("time[datetime]").attr("datetime") ?? ""),
        }));
      const recent = teasers.filter((teaser) => !(since && teaser.date < since));
      recent
        .map((teaser) => teaser.url)
        .filter((url) => MUSIC_ARTICLE.test(url))
        .forEach((url) => urls.add(url));
      if (recent.length < teasers.length || teasers.length === 0) break;
    }
    return [...urls];
  },

  parseReview(_url, html) {
    const $ = load(html);
    const linkedData = readLinkedData($);
    const article = linkedData.find((entry) => entry["@type"] === "NewsArticle");
    if (article?.articleSection !== "Musik") return null;
    const review = linkedData.find((entry) => entry["@type"] === "Review");
    if (!hasAlbumLabel(review?.reviewBody ?? article.description ?? "")) return null;

    const item = parseItemName(review?.itemReviewed?.name ?? $("head > title").first().text());
    const score = review ? linkedDataScore(review) : gradeLabelScore($);
    if (!item || !score) return null;

    return {
      ...item,
      ...score,
      critic: (review?.author ?? article.author)?.[0]?.name?.trim() || undefined,
      publishedAt: review?.datePublished ?? article.datePublished,
    };
  },
};

function hasAlbumLabel(description: string): boolean {
  const label = LABEL_PATTERN.exec(description.trim())?.[1];
  return label === undefined || ALBUM_LABELS.has(label);
}

function parseItemName(name: string): Pick<ScrapedAlbumReview, "artist" | "title"> | null {
  const match = ITEM_NAME_PATTERN.exec(name.replace(/\s+/g, " ").trim());
  if (!match) return null;
  const artist = match[1]!.trim();
  const quotedTitle = QUOTED_PATTERN.exec(match[2]!)?.[1];
  const title = (quotedTitle ?? match[2]!).trim();
  if (
    !artist ||
    !title ||
    QUOTE_PATTERN.test(title) ||
    QUOTE_PATTERN.test(artist) ||
    VARIOUS_ARTISTS_PATTERN.test(artist) ||
    NOT_AN_ALBUM_PATTERN.test(title)
  ) {
    return null;
  }
  return { artist, title };
}

function linkedDataScore(review: LinkedData): Score | null {
  const rawScore = Number(review.reviewRating?.ratingValue);
  if (!Number.isFinite(rawScore)) return null;
  return { rawScore, scaleMax: Number(review.reviewRating?.bestRating) || 5 };
}

function gradeLabelScore($: CheerioAPI): Score | null {
  const labels = $('main article svg[aria-label^="Betyg"], main article img[alt^="Betyg"]')
    .toArray()
    .map((grade) => $(grade).attr("aria-label") ?? $(grade).attr("alt") ?? "");
  const scores = new Set(labels.map(gradeFromLabel));
  if (scores.size !== 1) return null;
  const [rawScore] = scores;
  return rawScore === undefined ? null : { rawScore, scaleMax: 5 };
}

function gradeFromLabel(label: string): number | undefined {
  for (const [pattern, offset] of GRADE_LABEL_PATTERNS) {
    const match = pattern.exec(label.trim());
    if (match) return Number(match[1]) - offset;
  }
  return undefined;
}

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
