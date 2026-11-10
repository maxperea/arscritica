import { load, type CheerioAPI } from "cheerio";
import type { MusicSource } from "../../source";
import { fetchListingPage } from "../listing";

const LIST_URL = "https://www.svd.se/tagg/skivrecensioner";
const ARTICLE_URL = /^https:\/\/www\.svd\.se\/a\//;
const NOT_A_REVIEW_URL = /^https:\/\/www\.svd\.se\/a\/gwAJV1\//;
const MAX_PAGES = 3;
const HEADLINE_PATTERN = /^Recension:\s*[”"“](.+?)[”"“]\s+av\s+(.+)$/;
const ARTIST_FIRST_HEADLINE_PATTERN = /^Recension:\s*(.+?)\s+[–-]\s+[”"“]?(.+?)[”"“]?$/;
const VARIOUS_ARTISTS_PATTERN = /^(diverse|blandade|various)\s+artist(er|s)$|^v\/a$/i;
const NOT_AN_ALBUM_PATTERN =
  /\b(live|singel|box|boxen|samling|samlingen|samlingsbox|archives?|arkiv|volume|vol\.|deluxe|remaster(ed)?|greatest hits|best of|anniversary|jubileumsutgåva|nyutgåva|återutgåva|lost albums)\b/i;
const REISSUE_PATTERN = /\b(box|boxen|nyutgåva|återutgåva|nyutgiv\p{L}*|återutgiv\p{L}*)\b/iu;

interface LinkedData {
  "@type"?: string;
  headline?: string;
  description?: string;
  datePublished?: string;
  author?: { name?: string }[];
  itemReviewed?: {
    "@type"?: string;
    name?: string;
    byArtist?: { name?: string };
    copyrightYear?: number | string;
  };
  reviewRating?: { ratingValue?: number | string; bestRating?: number | string };
}

export const svd: MusicSource = {
  slug: "svd",
  name: "SvD",
  url: "https://www.svd.se/tagg/skivrecensioner",
  paywalled: true,

  async listReviewUrls({ since, exhaustive, fetchText }) {
    const urls = new Set<string>();
    for (let page = 1; page <= (exhaustive ? Infinity : MAX_PAGES); page++) {
      const html = await fetchListingPage(
        fetchText,
        page === 1 ? LIST_URL : `${LIST_URL}?page=${page}`,
        page,
      );
      if (html === undefined) break;
      const $ = load(html);
      const teasers = $("article a.teaser")
        .toArray()
        .map((link) => ({
          url: $(link).attr("href") ?? "",
          date: new Date($(link).find("time[datetime]").attr("datetime") ?? ""),
        }));
      const recent = teasers.filter((teaser) => !(since && teaser.date < since));
      recent
        .map((teaser) => teaser.url)
        .filter((url) => ARTICLE_URL.test(url) && !NOT_A_REVIEW_URL.test(url))
        .forEach((url) => urls.add(url));
      if (recent.length < teasers.length || teasers.length === 0) break;
    }
    return [...urls];
  },

  parseReview(url, html) {
    const $ = load(html);
    const linkedData = readLinkedData($);
    const review = linkedData.find((entry) => entry["@type"] === "Review");
    const article = linkedData.find((entry) => entry["@type"]?.endsWith("Article"));
    const album = review?.itemReviewed;
    const title = clean(album?.name ?? "");
    const rawScore = Number(review?.reviewRating?.ratingValue);
    if (album?.["@type"] !== "MusicAlbum" || !title || !Number.isFinite(rawScore)) return null;

    const metadata = readMetadata($);
    const headline = clean(review?.headline ?? article?.headline ?? "");
    const artist = clean(
      album.byArtist?.name || metadata.get("Artist") || artistFromHeadline(headline, title) || "",
    );
    const publishedAt = review?.datePublished ?? article?.datePublished;
    const releaseYear = Number(album.copyrightYear ?? metadata.get("År"));
    const texts = [title, headline, $("head > title").first().text(), url];
    if (
      !artist ||
      VARIOUS_ARTISTS_PATTERN.test(artist) ||
      texts.some((text) => NOT_AN_ALBUM_PATTERN.test(text.replace(/-/g, " "))) ||
      REISSUE_PATTERN.test(review?.description ?? article?.description ?? "") ||
      isOldRelease(releaseYear, publishedAt)
    ) {
      return null;
    }

    return {
      artist,
      title,
      rawScore,
      scaleMax: Number(review?.reviewRating?.bestRating) || 6,
      critic: review?.author?.[0]?.name?.trim() || undefined,
      publishedAt,
    };
  },
};

function readMetadata($: CheerioAPI): Map<string, string> {
  return new Map(
    $('[data-component-type="svd-metadata-embed"] dl dt')
      .toArray()
      .map((term) => [clean($(term).text()), clean($(term).next("dd").text())]),
  );
}

function artistFromHeadline(headline: string, title: string): string | undefined {
  const match = HEADLINE_PATTERN.exec(headline);
  if (match?.[1] === title) return match[2];
  const artistFirst = ARTIST_FIRST_HEADLINE_PATTERN.exec(headline);
  return artistFirst?.[2] === title ? artistFirst[1] : undefined;
}

function isOldRelease(releaseYear: number, publishedAt: string | undefined): boolean {
  const publishedYear = new Date(publishedAt ?? "").getUTCFullYear();
  return releaseYear > 0 && publishedYear > 0 && releaseYear < publishedYear - 1;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
