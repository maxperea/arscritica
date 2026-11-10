import { load, type CheerioAPI } from "cheerio";
import type { MusicSource } from "../../source";

const BASE_URL = "https://gaffa.se";
const OVERVIEW_API_URL = `${BASE_URL}/umbraco/api/overview/get`;
const MAX_PAGES = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const STAR_SCALE = 6;
const RELEASE_URL_PATTERN = /\/recensioner\/(\d{4})\/([a-zåäö]+)\/(album|releases)\//;
const LISTING_DATE_PATTERN = /(\d{2})\.(\d{2})\.(\d{4})/;
const SINGLE_PATTERN = /\bsing(el|eln|lar|larna)\b/i;
const NOT_STUDIO_ALBUM_PATTERN =
  /\blive\b|\bgreatest hits\b|\bbest of\b|\bsamlingsbox\b|\bbox ?set\b|\bdeluxe\b|\bremaster|\banniversary\b|\bjubileums|\s\/\s/i;
const COMPILATION_ARTIST_PATTERN =
  /^(v\/a|va|diverse artister|various artists|blandade artister)$/i;
const CONCERT_PATTERN = /\bkonsert\w*|\bspelning\w*|\bturné\w*|\bi ?kväll\b|\bpubliken\b/i;
const VENUE_PLACE_PATTERN =
  /,\s*(Stockholm|Göteborg|Malmö|Uppsala|Lund|Umeå|Örebro|Linköping|Norrköping|Västerås|Helsingborg|Jönköping|Köpenhamn|Oslo|Way Out West|Roskilde|Bråvalla|Sweden Rock|Summerburst|Lollapalooza)\b/i;
const VENUE_TITLE_PATTERN = /,\s*[A-ZÅÄÖ]|\b(Stockholm|Göteborg|Malmö|Uppsala|Lund|Arena)\b/;

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

interface OverviewResponse {
  Success?: boolean;
  MoreToLoad?: boolean;
  Index?: number;
  Html?: string;
}

interface ListingCard {
  url: string;
  date?: Date;
}

export const gaffa: MusicSource = {
  slug: "gaffa",
  name: "Gaffa",
  url: `${BASE_URL}/recensioner-oversigtsida/albumrecensioner/`,
  paywalled: true,

  async listReviewUrls({ since, exhaustive, fetchText }) {
    const urls: string[] = [];
    let skip = 0;
    for (let page = 0; page < (exhaustive ? Infinity : MAX_PAGES); page++) {
      const response = JSON.parse(await fetchText(overviewUrl(skip))) as OverviewResponse;
      const cards = parseListingCards(response.Html ?? "");
      const recent = cards.filter((card) => !isOlderThan(card, since));
      urls.push(
        ...recent.filter((card) => RELEASE_URL_PATTERN.test(card.url)).map((card) => card.url),
      );
      if (!response.MoreToLoad || cards.length === 0 || recent.length === 0) break;
      if (!response.Index || response.Index <= skip) break;
      skip = response.Index;
    }
    return uniqueBySlug(urls);
  },

  parseReview(url, html) {
    const urlMatch = RELEASE_URL_PATTERN.exec(url);
    if (!urlMatch) return null;
    const $ = load(html);
    if (!/albumrecension/i.test($(".article-page__hero__type").text())) return null;

    const artist = cleanText($("h3.album-release-hero__review__artist").first().text());
    const title = cleanText($("h2.album-release-hero__review__name").first().text());
    const stars = $(".review-score").first().find("span.review-score__star");
    const rawScore = stars.filter(".review-score__star--active").length;
    if (!artist || !title || stars.length !== STAR_SCALE || rawScore === 0) return null;
    if (!isStudioAlbumReview($, artist, title, urlMatch[3] === "releases")) return null;

    return {
      artist,
      title,
      rawScore,
      scaleMax: STAR_SCALE,
      critic: cleanText($('meta[property="article:author"]').attr("content") ?? "") || undefined,
      publishedAt: publishedAt($, urlMatch),
    };
  },
};

function uniqueBySlug(urls: string[]): string[] {
  const bySlug = new Map<string, string>();
  for (const url of urls) {
    const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? url;
    if (!bySlug.has(slug)) bySlug.set(slug, url);
  }
  return [...bySlug.values()];
}

function overviewUrl(skip: number): string {
  const query = new URLSearchParams({
    culture: "sv-SE",
    alias: "pReviewRelease",
    skip: String(skip),
    columns: "3",
  });
  return `${OVERVIEW_API_URL}?${query}`;
}

function parseListingCards(html: string): ListingCard[] {
  const $ = load(html);
  return $("a.link-item--review")
    .toArray()
    .map((card) => ({
      url: new URL($(card).attr("href") ?? "", BASE_URL).href,
      date: parseListingDate($(card).find(".link-item__label").text()),
    }));
}

function parseListingDate(label: string): Date | undefined {
  const [, day, month, year] = LISTING_DATE_PATTERN.exec(label) ?? [];
  return day ? new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))) : undefined;
}

function isOlderThan(card: ListingCard, since: Date | undefined): boolean {
  return Boolean(since && card.date && card.date.getTime() + DAY_MS <= since.getTime());
}

function isStudioAlbumReview(
  $: CheerioAPI,
  artist: string,
  title: string,
  isMigratedRelease: boolean,
): boolean {
  const headline = $(".article-page__hero__headline").text();
  if (COMPILATION_ARTIST_PATTERN.test(artist)) return false;
  if (NOT_STUDIO_ALBUM_PATTERN.test(title)) return false;
  if (SINGLE_PATTERN.test(`${title} ${headline}`)) return false;
  if (!isMigratedRelease) return true;
  if (VENUE_PLACE_PATTERN.test(title)) return false;
  if (!VENUE_TITLE_PATTERN.test(title)) return true;
  const ingress = $(".article-page__limiting-text-container").first().text();
  const otherTags = $('meta[property="article:tag"]')
    .toArray()
    .map((tag) => cleanText($(tag).attr("content") ?? ""))
    .filter((tag) => tag.toLowerCase() !== artist.toLowerCase());
  return otherTags.length === 0 && !CONCERT_PATTERN.test(`${headline} ${ingress}`);
}

function publishedAt($: CheerioAPI, urlMatch: RegExpExecArray): string | undefined {
  const [, urlYear, urlMonthName, kind] = urlMatch;
  const published = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(
    $('meta[property="article:published_time"]').attr("content")?.trim() ?? "",
  );
  if (published && (kind === "album" || published[1] === urlYear)) {
    return stockholmIso(`${published[1]}-${published[2]}-${published[3]}`, published[4]!);
  }
  const month = SWEDISH_MONTHS.indexOf(urlMonthName!) + 1;
  if (month === 0) return undefined;
  return stockholmIso(`${urlYear}-${String(month).padStart(2, "0")}-01`, "00:00:00");
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

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["”“»«']+|["”“»«']+$/g, "")
    .trim();
}
