import { load } from "cheerio";
import type { Source } from "../source";

export function createExampleSource(slug: string, baseUrl: string): Source {
  const listUrl = new URL(`/${slug}/`, baseUrl).href;
  return {
    slug,
    name: `Exempel ${slug}`,
    url: listUrl,
    async listReviewUrls({ fetchText }) {
      const $ = load(await fetchText(listUrl));
      return $("a.review")
        .map((_, link) => new URL($(link).attr("href") ?? "", listUrl).href)
        .get();
    },
    parseReview(_url, html) {
      const $ = load(html);
      const title = $("h1").text().trim();
      const rawScore = Number($("[data-score]").attr("data-score"));
      if (!title || !Number.isFinite(rawScore)) return null;
      return {
        title,
        year: Number($("[data-year]").attr("data-year")) || undefined,
        rawScore,
        scaleMax: 5,
        critic: $(".critic").text().trim() || undefined,
        publishedAt: $("time").attr("datetime"),
      };
    },
  };
}
