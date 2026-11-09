import { load, type CheerioAPI } from "cheerio";
import type { MusicSource } from "../../source";
import { listWordPressPostLinks } from "../../sources/wordpress";

const BASE_URL = "https://hymn.se";
const RECORDS_CATEGORY_ID = 3890;
const EXCLUDED_CATEGORY_IDS = [3924, 3950];
const EXCLUDED_CATEGORY_CLASSES = [
  "category-manadens-ps",
  "category-retrorecension",
  "category-live",
];
const HEADLINE_SEPARATOR = " – ";
const COMPILATION_ARTIST_PATTERN = /^(v\/a|various artists|diverse artister|blandade artister)$/i;
const EXCLUDED_TITLE_PATTERN =
  /\(live\b|\blive (at|in|from|på|i)\b|\b(singel|single|best of|greatest hits|samlingsalbum|samlingsskiva|deluxe|anniversary|remaster(ed)?|reissue|nyutgåva|box ?set|boxen)\b/i;
const SPOTIFY_ALBUM_EMBED_PATTERN = /^Spotify Embed: (.+)$/;

export const hymn: MusicSource = {
  slug: "hymn",
  name: "Hymn",
  url: `${BASE_URL}/`,

  listReviewUrls(context) {
    const postsUrl = new URL("/wp-json/wp/v2/posts", BASE_URL);
    postsUrl.searchParams.set("categories", String(RECORDS_CATEGORY_ID));
    postsUrl.searchParams.set("categories_exclude", EXCLUDED_CATEGORY_IDS.join(","));
    return listWordPressPostLinks(postsUrl.href, context);
  },

  parseReview(_url, html) {
    const $ = load(html);
    const article = $("article.category-skivor").first();
    if (!$("body").hasClass("single-post") || !article.length) return null;
    if (EXCLUDED_CATEGORY_CLASSES.some((className) => article.hasClass(className))) return null;

    const rating = article.find('[itemprop="reviewRating"]').first();
    const rawScore = Number(rating.find('[itemprop="ratingValue"]').first().text().trim());
    const scaleMax = Number(rating.find('meta[itemprop="bestRating"]').attr("content"));
    if (!Number.isFinite(rawScore) || !(rawScore > 0) || !(scaleMax > 0)) return null;

    const parts = article.find("h1.entry-title").first().text().split(HEADLINE_SEPARATOR);
    if (parts.length !== 2) return null;
    const [artist, title] = orderedParts(
      parts.map((part) => cleanText(part)) as [string, string],
      spotifyAlbumTitle($),
    );
    if (!artist || !title || COMPILATION_ARTIST_PATTERN.test(artist)) return null;
    if (EXCLUDED_TITLE_PATTERN.test(title)) return null;

    return {
      artist,
      title,
      rawScore,
      scaleMax,
      critic:
        cleanText(article.find('[itemprop="author"] [itemprop="name"]').first().text()) ||
        undefined,
      publishedAt:
        article.find('time[itemprop="datePublished"]').attr("datetime") ??
        $('meta[property="article:published_time"]').attr("content"),
    };
  },
};

function spotifyAlbumTitle($: CheerioAPI): string | undefined {
  const embed = $('iframe[src*="open.spotify.com/embed/album/"]').first();
  const match = SPOTIFY_ALBUM_EMBED_PATTERN.exec(embed.attr("title") ?? "");
  return match ? cleanText(match[1]!) : undefined;
}

function orderedParts(
  [left, right]: [string, string],
  albumTitle: string | undefined,
): [string, string] {
  const isReversed =
    albumTitle !== undefined && sameText(albumTitle, left) && !sameText(albumTitle, right);
  return isReversed ? [right, left] : [left, right];
}

function sameText(a: string, b: string): boolean {
  return a.localeCompare(b, "sv", { sensitivity: "base" }) === 0;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
    .trim();
}
