import { load } from "cheerio";
import type { Source } from "../../source";

const BASE_URL = "https://kulturbloggen.com";
const FILM_REVIEW_CATEGORY = 51;
const TV_SERIES_CATEGORY = 14985;
const PAGE_SIZE = 100;
const SCORE_PATTERN = /^Betyg:? ([1-5])$/;

interface PostSummary {
  link?: string;
}

export const kulturbloggen: Source = {
  slug: "kulturbloggen",
  name: "Kulturbloggen",
  url: `${BASE_URL}/`,

  async listReviewUrls({ since, fetchText }) {
    const urls: string[] = [];
    for (let page = 1; ; page++) {
      const query = new URLSearchParams({
        rest_route: "/wp/v2/posts",
        categories: String(FILM_REVIEW_CATEGORY),
        categories_exclude: String(TV_SERIES_CATEGORY),
        per_page: String(PAGE_SIZE),
        page: String(page),
        _fields: "link",
      });
      if (since) query.set("after", since.toISOString().slice(0, 19));
      let posts: PostSummary[];
      try {
        posts = JSON.parse(await fetchText(`${BASE_URL}/?${query}`)) as PostSummary[];
      } catch (error) {
        if (page === 1) throw error;
        break;
      }
      urls.push(...posts.flatMap((post) => (post.link ? [post.link] : [])));
      if (posts.length < PAGE_SIZE) break;
    }
    return urls;
  },

  parseReview(_url, html) {
    const $ = load(html);
    const article = $("article").first();
    if (!$("body").hasClass("single-post")) return null;
    if (!article.hasClass("category-filmer") || article.hasClass("category-tv-serier-film")) {
      return null;
    }

    const factLines = article
      .find(".entry-content p")
      .toArray()
      .map((paragraph) =>
        ($(paragraph).html() ?? "").split(/<br\s*\/?>/).map((line) => load(line).text().trim()),
      )
      .find((lines) => lines.some((line) => SCORE_PATTERN.test(line)));
    if (!factLines) return null;
    const rawScore = Number(factLines.map((line) => SCORE_PATTERN.exec(line)?.[1]).find(Boolean));
    const factTitle = factLines[0] ?? "";
    const headlineTitle = article
      .find(".entry-title")
      .text()
      .replace(/^Filmrec\w*:\s*/i, "")
      .split(" – ")[0]!
      .trim();
    const title = factTitle.toLowerCase().startsWith(headlineTitle.toLowerCase())
      ? headlineTitle
      : factTitle;
    if (!title || /^Betyg/.test(title)) return null;

    return {
      title,
      rawScore,
      scaleMax: 5,
      critic: article.find(".entry-author-name").first().text().trim() || undefined,
      publishedAt: article.find("time.entry-time").attr("datetime"),
    };
  },
};
