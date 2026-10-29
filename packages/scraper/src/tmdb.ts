import type { WatchKind, WatchProvider } from "@arscritica/db";
import { normalizeTitle } from "@arscritica/db/text";
import { USER_AGENT } from "./fetcher";

export interface TmdbMovie {
  id: number;
  title: string;
  originalTitle: string;
  year?: number;
  posterPath?: string;
  genres: string[];
}

export interface MovieLookup {
  findMovie(title: string, year?: number, reviewedYear?: number): Promise<TmdbMovie | undefined>;
}

interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  poster_path?: string | null;
  genre_ids?: number[];
}

interface TmdbDetailsResult {
  genres?: TmdbGenre[];
  imdb_id?: string | null;
  overview?: string | null;
  runtime?: number | null;
}

export interface TmdbMovieDetails {
  genres: string[];
  imdbId?: string;
  overview?: string;
  runtime?: number;
}

interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
  display_priority?: number;
}

type TmdbWatchRegion = Partial<Record<string, TmdbWatchProvider[]>>;

const watchKinds: Record<string, WatchKind> = {
  flatrate: "stream",
  free: "stream",
  ads: "stream",
  rent: "rent",
  buy: "buy",
};

interface TmdbGenre {
  id: number;
  name: string;
}

export class TmdbClient implements MovieLookup {
  private readonly apiKey: string;
  private genreNames?: Promise<Map<number, string>>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  static fromEnv(): TmdbClient | undefined {
    const apiKey = process.env.TMDB_API_KEY?.trim();
    return apiKey ? new TmdbClient(apiKey) : undefined;
  }

  async findMovie(
    title: string,
    year?: number,
    reviewedYear?: number,
  ): Promise<TmdbMovie | undefined> {
    if (year) {
      const sameYear = await this.search(title, year);
      if (sameYear.length) return sameYear[0];
      const anyYear = await this.search(title);
      return anyYear.find((movie) => movie.year !== undefined && Math.abs(movie.year - year) <= 1);
    }
    const key = normalizeTitle(title);
    const results = await this.search(title);
    return (
      results.find(
        (movie) =>
          (normalizeTitle(movie.title) === key || normalizeTitle(movie.originalTitle) === key) &&
          (reviewedYear === undefined ||
            movie.year === undefined ||
            movie.year <= reviewedYear + 1),
      ) ??
      results.find(
        (movie) =>
          reviewedYear !== undefined &&
          movie.year !== undefined &&
          movie.year <= reviewedYear &&
          movie.year >= reviewedYear - 2 &&
          [movie.title, movie.originalTitle].some((candidate) => titlesOverlap(title, candidate)),
      )
    );
  }

  async movieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
    const movie = await this.get<TmdbDetailsResult>(`movie/${tmdbId}`);
    return {
      genres: (movie.genres ?? []).map((genre) => genre.name),
      imdbId: movie.imdb_id || undefined,
      overview: movie.overview?.trim() || undefined,
      runtime: validRuntime(movie.runtime),
    };
  }

  async englishOverview(tmdbId: number): Promise<string | undefined> {
    const movie = await this.get<TmdbDetailsResult>(`movie/${tmdbId}`, { language: "en-US" });
    return movie.overview?.trim() || undefined;
  }

  async swedishWatchProviders(tmdbId: number): Promise<WatchProvider[]> {
    const body = await this.get<{ results?: Record<string, TmdbWatchRegion> }>(
      `movie/${tmdbId}/watch/providers`,
    );
    return Object.entries(body.results?.SE ?? {}).flatMap(([type, providers]) => {
      const kind = watchKinds[type];
      if (!kind || !Array.isArray(providers)) return [];
      return providers.map((provider) => ({
        kind,
        providerId: provider.provider_id,
        name: provider.provider_name,
        logoPath: provider.logo_path ?? undefined,
        displayPriority: provider.display_priority ?? 0,
      }));
    });
  }

  private async search(query: string, year?: number): Promise<TmdbMovie[]> {
    const params: Record<string, string> = { query, include_adult: "false" };
    if (year) params.primary_release_year = String(year);
    const [body, genreNames] = await Promise.all([
      this.get<{ results?: TmdbSearchResult[] }>("search/movie", params),
      this.loadGenreNames(),
    ]);
    return (body.results ?? []).map((result) => toTmdbMovie(result, genreNames));
  }

  private loadGenreNames(): Promise<Map<number, string>> {
    this.genreNames ??= this.get<{ genres?: TmdbGenre[] }>("genre/movie/list").then(
      (body) => new Map((body.genres ?? []).map((genre) => [genre.id, genre.name])),
    );
    this.genreNames.catch(() => (this.genreNames = undefined));
    return this.genreNames;
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    url.searchParams.set("language", "sv-SE");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": USER_AGENT,
    };
    if (this.apiKey.includes(".")) headers.authorization = `Bearer ${this.apiKey}`;
    else url.searchParams.set("api_key", this.apiKey);

    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`TMDB request failed with HTTP ${response.status}`);
    return (await response.json()) as T;
  }
}

const romanNumerals: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5" };

const longestRuntime = 1000;

function validRuntime(runtime: number | null | undefined): number | undefined {
  return Number.isInteger(runtime) && runtime! > 0 && runtime! <= longestRuntime
    ? runtime!
    : undefined;
}

function comparableTitle(title: string): string {
  return normalizeTitle(title)
    .split(" ")
    .map((word) => romanNumerals[word] ?? word)
    .join(" ");
}

function titlesOverlap(a: string, b: string): boolean {
  const [shorter, longer] = [comparableTitle(a), comparableTitle(b)].sort(
    (x, y) => x.length - y.length,
  );
  return longer === shorter || (shorter!.includes(" ") && longer!.startsWith(`${shorter} `));
}

function toTmdbMovie(result: TmdbSearchResult, genreNames: Map<number, string>): TmdbMovie {
  const year = Number(result.release_date?.slice(0, 4));
  return {
    id: result.id,
    title: result.title,
    originalTitle: result.original_title,
    year: year || undefined,
    posterPath: result.poster_path ?? undefined,
    genres: (result.genre_ids ?? []).flatMap((id) => genreNames.get(id) ?? []),
  };
}
