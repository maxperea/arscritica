export interface ScrapedReview {
  title: string;
  year?: number;
  rawScore: number;
  scaleMax: number;
  critic?: string;
  publishedAt?: string;
}

export interface ListContext {
  since?: Date;
  fetchText(url: string): Promise<string>;
}

export interface Source {
  slug: string;
  name: string;
  url: string;
  paywalled?: boolean;
  listReviewUrls(context: ListContext): Promise<string[]>;
  parseReview(url: string, html: string): ScrapedReview | null;
}

export interface Fetcher {
  fetchText(url: string): Promise<string>;
}
