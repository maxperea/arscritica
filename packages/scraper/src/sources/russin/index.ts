import { load, type CheerioAPI } from "cheerio";
import type { Source } from "../../source";

const BASE_URL = "https://russin.nu";
const LATEST_URL = `${BASE_URL}/recensioner.php`;
const OLDER_REVIEWS_BEFORE_STOP = 20;

export const russin: Source = {
  slug: "russin",
  name: "Russin",
  url: `${BASE_URL}/`,

  async listReviewUrls({ since, fetchText }) {
    const latestIds = load(await fetchText(LATEST_URL))('a[href*="filmview.php?filmid="]')
      .map((_, link) => Number(/filmid=(\d+)$/.exec(link.attribs.href ?? "")?.[1]))
      .get()
      .filter((id) => id > 0);
    if (latestIds.length === 0) return [];

    const urls: string[] = [];
    let olderInARow = 0;
    for (let id = Math.max(...latestIds); id > 0; id--) {
      const url = `${BASE_URL}/filmview.php?filmid=${id}`;
      const signature = await fetchText(url).then(
        (html) => findSignature(load(html)),
        () => undefined,
      );
      if (!signature) continue;
      if (since && new Date(signature.publishedAt) < since) {
        if (++olderInARow >= OLDER_REVIEWS_BEFORE_STOP) break;
        continue;
      }
      olderInARow = 0;
      urls.push(url);
    }
    return urls;
  },

  parseReview(_url, html) {
    const $ = load(html);
    const rawScore = Number(/^(\d) russin$/.exec($('img[src*="points_"]').attr("alt") ?? "")?.[1]);
    const heading = $("h1").first().text().trim();
    const signature = findSignature($);
    if (!heading || !Number.isFinite(rawScore) || !signature || isTvSeries(html)) return null;

    const [, title, year] = /^(.+?)\s*\((\d{4})\)$/.exec(heading) ?? [];
    return {
      title: title ?? heading,
      year: year ? Number(year) : undefined,
      rawScore,
      scaleMax: 5,
      ...signature,
    };
  },
};

function findSignature($: CheerioAPI): { critic: string; publishedAt: string } | undefined {
  const [, critic, publishedAt] =
    /©\s*([^\n©]+?)\s*(\d{4}-\d{2}-\d{2})/.exec($(".col-sm-8").first().text()) ?? [];
  return critic && publishedAt ? { critic, publishedAt } : undefined;
}

function isTvSeries(html: string): boolean {
  return /TV-serie/i.test(/<b>Genre:<\/b>([^<]*)/.exec(html)?.[1] ?? "");
}
