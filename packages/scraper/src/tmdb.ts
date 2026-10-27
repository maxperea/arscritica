import { normalizeTitle } from "@arscritica/db/text";
import { USER_AGENT } from "./fetcher";

export interface TmdbMovie {
  id: number;
  title: string;
  originalTitle: string;
  year?: number;
  posterPath?: string;
}

export interface MovieLookup {
  findMovie(title: string, year?: number): Promise<TmdbMovie | undefined>;
}

interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  poster_path?: string | null;
}

export class TmdbClient implements MovieLookup {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  static fromEnv(): TmdbClient | undefined {
    const apiKey = process.env.TMDB_API_KEY?.trim();
    return apiKey ? new TmdbClient(apiKey) : undefined;
  }

  async findMovie(title: string, year?: number): Promise<TmdbMovie | undefined> {
    if (year) {
      const sameYear = await this.search(title, year);
      if (sameYear.length) return sameYear[0];
      const anyYear = await this.search(title);
      return anyYear.find((movie) => movie.year !== undefined && Math.abs(movie.year - year) <= 1);
    }
    const key = normalizeTitle(title);
    const results = await this.search(title);
    return results.find(
      (movie) => normalizeTitle(movie.title) === key || normalizeTitle(movie.originalTitle) === key,
    );
  }

  private async search(query: string, year?: number): Promise<TmdbMovie[]> {
    const url = new URL("https://api.themoviedb.org/3/search/movie");
    url.searchParams.set("query", query);
    url.searchParams.set("language", "sv-SE");
    url.searchParams.set("include_adult", "false");
    if (year) url.searchParams.set("primary_release_year", String(year));

    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": USER_AGENT,
    };
    if (this.apiKey.includes(".")) headers.authorization = `Bearer ${this.apiKey}`;
    else url.searchParams.set("api_key", this.apiKey);

    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`TMDB search failed with HTTP ${response.status}`);
    const body = (await response.json()) as { results?: TmdbSearchResult[] };
    return (body.results ?? []).map(toTmdbMovie);
  }
}

function toTmdbMovie(result: TmdbSearchResult): TmdbMovie {
  const year = Number(result.release_date?.slice(0, 4));
  return {
    id: result.id,
    title: result.title,
    originalTitle: result.original_title,
    year: year || undefined,
    posterPath: result.poster_path ?? undefined,
  };
}
