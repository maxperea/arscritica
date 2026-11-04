import { load, type CheerioAPI } from "cheerio";
import type { ScrapedReview, Source } from "../../source";

const LIST_URL = "https://www.aftonbladet.se/tagg/filmrecensioner";
const FILM_ARTICLE = /^https:\/\/www\.aftonbladet\.se\/nojesbladet\/film\/a\//;
const MAX_PAGES = 20;
const MAX_GRADES_IN_REVIEW = 2;
const GRADE_LABEL_PATTERN = /^Betyg (\d) av (\d)$/;
const LIST_PATTERN = /\blista\b/i;
const NOT_A_TITLE_PATTERN =
  /^([Rr]egisserad|[A-ZÅÄÖ]{4,}\s+[A-ZÅÄÖ][a-zåäö])|\bplus\b|\?$|^.{81,}$/;
const GENRE_LABEL_PATTERN = /^[A-ZÅÄÖ\s/-]{4,}$/;
const LEAD_GRADE_PATTERN = /\b(så|hur) många\b|^till\b/i;

type Selection = ReturnType<CheerioAPI>;

interface LinkedData {
  "@type"?: string;
  articleSection?: string;
  datePublished?: string;
  author?: { name?: string }[];
  itemReviewed?: { name?: string };
  reviewRating?: { ratingValue?: number; bestRating?: number };
}

export const aftonbladet: Source = {
  slug: "aftonbladet",
  name: "Aftonbladet",
  url: "https://www.aftonbladet.se/nojesbladet/film",

  async listReviewUrls({ since, exhaustive, fetchText }) {
    const urls: string[] = [];
    for (let page = 1; page <= (exhaustive ? Infinity : MAX_PAGES); page++) {
      const $ = load(await fetchText(page === 1 ? LIST_URL : `${LIST_URL}?page=${page}`));
      const teasers = $("article a.teaser")
        .toArray()
        .map((link) => ({
          url: $(link).attr("href") ?? "",
          date: new Date($(link).find("time[datetime]").attr("datetime") ?? ""),
        }));
      const recent = teasers.filter((teaser) => !(since && teaser.date < since));
      urls.push(...recent.map((teaser) => teaser.url).filter((url) => FILM_ARTICLE.test(url)));
      if (recent.length < teasers.length || teasers.length === 0) break;
    }
    return urls;
  },

  parseReview(_url, html) {
    const $ = load(html);
    const linkedData = readLinkedData($);
    const article = linkedData.find((entry) => entry["@type"] === "NewsArticle");
    if (article?.articleSection !== "Film") return null;
    const review = linkedData.find((entry) => entry["@type"] === "Review");
    const rating = review?.reviewRating;
    if (rating?.ratingValue === undefined) return parseGradeLabel($, article);

    const title = factBoxTitle($) ?? cleanItemName(review?.itemReviewed?.name ?? "");
    if (!title) return null;

    return {
      title,
      rawScore: rating.ratingValue,
      scaleMax: rating.bestRating ?? 5,
      critic: review?.author?.[0]?.name,
      publishedAt: review?.datePublished ?? article.datePublished,
    };
  },
};

function parseGradeLabel($: CheerioAPI, article: LinkedData): ScrapedReview | null {
  const grades = $(
    '.article-intro svg[aria-label^="Betyg"], .article-body svg[aria-label^="Betyg"]',
  ).filter((_, grade) => !LEAD_GRADE_PATTERN.test($(grade).closest("p").text().trim()));
  if (
    grades.length > MAX_GRADES_IN_REVIEW ||
    LIST_PATTERN.test(`${$("title").text()} ${$("h1").text()}`)
  ) {
    return null;
  }
  const factBoxGrade = grades.filter((_, grade) => $(grade).closest("[class*=factbox]").length > 0);
  const grade = factBoxGrade.length ? factBoxGrade.first() : grades.first();
  const label = GRADE_LABEL_PATTERN.exec(grade.attr("aria-label") ?? "");
  const title = label && gradedTitle($, grade.closest("p"));
  if (!label || !title) return null;
  return {
    title,
    rawScore: Number(label[1]) - 1,
    scaleMax: Number(label[2]) - 1,
    critic: article.author?.[0]?.name,
    publishedAt: article.datePublished,
  };
}

function gradedTitle($: CheerioAPI, grade: Selection): string | undefined {
  const previous = grade.prev();
  const next = grade.next();
  const candidates = [
    quoted(grade.text()),
    previous.is("h2") && !/^fakta$/i.test(previous.text().trim()) ? previous.text() : undefined,
    next.is("h2") ? next.text() : undefined,
    grade.text().trim() ? firstLine(grade) : firstLine(paragraphAfter(grade)),
    titleFromHeadline($("title").text()),
  ];
  return candidates
    .map((candidate) =>
      candidate
        ?.split("\n")[0]!
        .split(/\s*\bRegi\b/)[0]!
        .trim()
        .replace(/^[”"“](.+)[”"“]$/, "$1"),
    )
    .find((candidate) => candidate && !NOT_A_TITLE_PATTERN.test(candidate));
}

function paragraphAfter(grade: Selection): Selection {
  const next = grade.next("p");
  return GENRE_LABEL_PATTERN.test(next.text().trim()) ? next.next("p") : next;
}

function firstLine(paragraph: Selection): string | undefined {
  const line = (paragraph.html() ?? "")
    .split(/<br\s*\/?>/)
    .map((html) =>
      load(html)
        .text()
        .split(/\s*\bRegi\b/)[0]!
        .trim(),
    )
    .find((text) => text && !GENRE_LABEL_PATTERN.test(text));
  return line && !LEAD_GRADE_PATTERN.test(line) ? line : undefined;
}

function titleFromHeadline(headline: string): string | undefined {
  const text = headline
    .replace(/\s+/g, " ")
    .replace(/^\(\+\)\s*/, "")
    .trim();
  return (
    quoted(text) ??
    /^(?:film)?recension(?: av)?:?\s+(.+?)(?:\s+[–-]\s.*)?$/i.exec(text)?.[1] ??
    /^så bra är\s+(.+)$/i.exec(text)?.[1] ??
    /^(.+?)\s+[–-]\s+här är recensionen$/i.exec(text)?.[1]
  );
}

function quoted(text: string): string | undefined {
  const matches = [...text.matchAll(/[”"“]([^”"“]+)[”"“]/g)];
  return matches.length === 1 ? matches[0]![1] : undefined;
}

function readLinkedData($: CheerioAPI): LinkedData[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script) => {
      try {
        return [JSON.parse($(script).text()) as LinkedData];
      } catch {
        return [];
      }
    });
}

function factBoxTitle($: CheerioAPI): string | undefined {
  const grade = $('.article-body svg[aria-label^="Betyg"]').first();
  return grade.closest("p").next("h2").text().trim() || undefined;
}

function cleanItemName(name: string): string {
  return name
    .replace(/\s+[–-]\s+(här är recensionen|så bra är).*$/i, "")
    .replace(/,?\s+recension\b.*$/i, "")
    .trim();
}
