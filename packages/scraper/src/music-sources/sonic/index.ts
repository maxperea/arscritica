import { load, type CheerioAPI } from "cheerio";
import type { MusicSource, ScrapedAlbumReview } from "../../source";
import { listWordPressPostLinks } from "../../sources/wordpress";

const BASE_URL = "https://sonicmagazine.com";
const REVIEWS_API_URL = `${BASE_URL}/wp-json/wp/v2/posts?categories=71`;
const SCALE_PATTERN = /^av (\d+)$/;
const POST_DATE_PATTERN = /(\d{1,2}) ([a-zåäö]+),? (\d{4}),? (\d{1,2}):(\d{2})/i;
const REPRINT_PATTERN = /\bUr Sonic #|^arkivrecension\b/i;
const REISSUE_PATTERN =
  /\bcd-låda|\blåda\b|\bbox\b|\bbox ?set\b|\bboxen\b|\bnyutgåva|\bnyutgivning|återutg|\bremaster|\bdeluxe\b|\banniversary\b|\bbootleg\b/i;
const NOT_STUDIO_ALBUM_PATTERN =
  /\blive\b|\bgreatest hits\b|\bbest of\b|\bcollection\b|\banthology\b|\bsessions\b|\bdemos\b|\[dvd\]|\s[+/]\s/i;
const LEGACY_GRADE_PATTERN = /^Betyg:?\s*(\d{1,2})$/i;
const LEGACY_SCALE_MAX = 10;
const SINGLE_PATTERN = /\bsingel\b|\bsingle\b/i;
const COMPILATION_ARTIST_PATTERN = /diverse artister|^v\/a$|various artists|blandade artister/i;

const SWEDISH_MONTHS = [
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

export const sonic: MusicSource = {
  slug: "sonic",
  name: "Sonic",
  url: `${BASE_URL}/recensioner/`,

  listReviewUrls(context) {
    return listWordPressPostLinks(REVIEWS_API_URL, context);
  },

  parseReview(_url, html) {
    const $ = load(html);
    if (!$(".card-info").length) return parseLegacyReview($);
    const facts = readFactBox($);
    const artist = facts.get("artist") ?? "";
    const title = headlineAlbum($, artist) ?? facts.get("album") ?? "";
    const rating = $(".card-info .rating").first();
    const rawScore = Number(rating.find(".numeric-rating").text().trim());
    const scaleMax = Number(SCALE_PATTERN.exec(rating.find(".heading").text().trim())?.[1]);
    if (!artist || !title || !rawScore || !Number.isFinite(rawScore) || !scaleMax) return null;
    if (!isStudioAlbumReview($, artist, title)) return null;

    return {
      artist,
      title,
      rawScore,
      scaleMax,
      critic: cleanText($(".post-author-name").first().text()) || undefined,
      publishedAt: parsePostDate($(".post_date .post_info_date").first().text()),
    };
  },
};

function parseLegacyReview($: CheerioAPI): ScrapedAlbumReview | null {
  const headline = cleanText($("h1").first().text());
  const separator = headline.indexOf(": ");
  const artist = cleanText(headline.slice(0, separator));
  const title = cleanText(headline.slice(separator + 2));
  const grades = legacyLines($)
    .map((line) => LEGACY_GRADE_PATTERN.exec(line)?.[1])
    .filter((grade) => grade !== undefined)
    .map(Number);
  if (separator < 1 || !artist || !title || grades.length !== 1) return null;
  const rawScore = grades[0]!;
  if (rawScore < 1 || rawScore > LEGACY_SCALE_MAX) return null;
  if (!isStudioAlbumReview($, artist, title)) return null;
  return {
    artist,
    title,
    rawScore,
    scaleMax: LEGACY_SCALE_MAX,
    publishedAt: parsePostDate($(".post_date .post_info_date").first().text()),
  };
}

function legacyLines($: CheerioAPI): string[] {
  return $(".post_content_wrapper p")
    .toArray()
    .flatMap((paragraph) =>
      ($(paragraph).html() ?? "").split(/<br\s*\/?>/i).map((part) => cleanText(load(part).text())),
    );
}

function readFactBox($: CheerioAPI): Map<string, string> {
  const facts = new Map<string, string>();
  $(".card-info ul li.card-list-dark").each((_index, label) => {
    const value = cleanText($(label).next("li:not(.card-list-dark)").text());
    const key = cleanText($(label).text()).toLowerCase();
    if (value && !facts.has(key)) facts.set(key, value);
  });
  return facts;
}

function headlineAlbum($: CheerioAPI, artist: string): string | undefined {
  const headline = cleanText($("h1").first().text());
  const prefix = `${artist}: `;
  if (!artist || !headline.toLowerCase().startsWith(prefix.toLowerCase())) return undefined;
  return cleanText(headline.slice(prefix.length)) || undefined;
}

function isStudioAlbumReview($: CheerioAPI, artist: string, title: string): boolean {
  const headline = cleanText($("h1").first().text());
  const ingress = cleanText($(".ingress").first().text());
  const context = `${headline} ${ingress}`;
  if (REPRINT_PATTERN.test(headline) || REPRINT_PATTERN.test(ingress)) return false;
  if (COMPILATION_ARTIST_PATTERN.test(artist)) return false;
  if (NOT_STUDIO_ALBUM_PATTERN.test(title) || REISSUE_PATTERN.test(title)) return false;
  return !REISSUE_PATTERN.test(context) && !SINGLE_PATTERN.test(context);
}

function parsePostDate(text: string): string | undefined {
  const [, day, monthName, year, hour, minute] = POST_DATE_PATTERN.exec(text) ?? [];
  const month = SWEDISH_MONTHS.indexOf(monthName?.toLowerCase() ?? "") + 1;
  if (!day || month === 0) return undefined;
  const date = `${year}-${pad(month)}-${pad(Number(day))}`;
  return stockholmIso(date, `${pad(Number(hour))}:${minute}:00`);
}

function stockholmIso(date: string, time: string): string {
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(`${date}T${time}Z`))
    .find((part) => part.type === "timeZoneName")
    ?.value.replace("GMT", "");
  return `${date}T${time}${offset || "+00:00"}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["”“»«']+|["”“»«']+$/g, "")
    .trim();
}
