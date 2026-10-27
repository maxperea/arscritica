import type { TopListMovie } from "@arscritica/db";

export const recentPeriod = "just-nu";
export const allPeriod = "alla";
export const recentDays = 90;
export const minReviews = { recent: 3, year: 5, all: 5 };

const firstYear = 2024;
const dayMs = 24 * 60 * 60 * 1000;
const genreNames: Record<string, string | null> = { Music: "Musik", "TV-film": null };

export interface Genre {
  name: string;
  slug: string;
  count: number;
}

export function periods(movies: TopListMovie[]): string[] {
  const years = [...new Set(movies.map(reviewYear))]
    .filter((year) => year >= firstYear)
    .sort((a, b) => b - a)
    .map(String);
  return [recentPeriod, ...years, allPeriod];
}

export function periodLabel(period: string): string {
  if (period === recentPeriod) return "Just nu";
  if (period === allPeriod) return "Alla";
  return period;
}

export function minReviewsFor(period: string): number {
  if (period === recentPeriod) return minReviews.recent;
  if (period === allPeriod) return minReviews.all;
  return minReviews.year;
}

export function periodMovies(movies: TopListMovie[], period: string, now: number): TopListMovie[] {
  const threshold = minReviewsFor(period);
  return movies.filter((movie) => movie.reviewCount >= threshold && inPeriod(movie, period, now));
}

export function movieGenres(movie: TopListMovie): string[] {
  return movie.genres.flatMap((genre) => {
    const name = genre in genreNames ? genreNames[genre] : genre;
    return name ? [name] : [];
  });
}

export function genres(movies: TopListMovie[]): Genre[] {
  const counts = new Map<string, number>();
  for (const name of movies.flatMap(movieGenres)) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, slug: genreSlug(name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "sv"));
}

export function genreSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ranks(movies: { score: number }[]): number[] {
  let rank = 0;
  return movies.map((movie, index) => {
    if (index === 0 || movie.score !== movies[index - 1]?.score) rank = index + 1;
    return rank;
  });
}

function inPeriod(movie: TopListMovie, period: string, now: number): boolean {
  if (period === allPeriod) return true;
  if (period === recentPeriod) {
    return now - Date.parse(movie.firstReviewedAt) <= recentDays * dayMs;
  }
  return reviewYear(movie).toString() === period;
}

function reviewYear(movie: TopListMovie): number {
  return Number(movie.firstReviewedAt.slice(0, 4));
}
