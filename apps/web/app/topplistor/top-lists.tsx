"use client";

import { useEffect, useMemo, useState } from "react";
import type { TopListMovie } from "@arscritica/db";
import { MovieList } from "@/components/movie-list";

const maxResults = 100;
const minReviewOptions = [1, 2, 3, 5];
const monthFormat = new Intl.DateTimeFormat("sv-SE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

interface Filters {
  year: string;
  month: string;
  genre: string;
  minReviews: string;
}

const defaultFilters: Filters = { year: "", month: "", genre: "", minReviews: "2" };
const queryKeys: Record<keyof Filters, string> = {
  year: "ar",
  month: "manad",
  genre: "genre",
  minReviews: "minst",
};

export function TopLists({ movies }: { movies: TopListMovie[] }) {
  const [filters, setFilters] = useState(defaultFilters);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters((current) => {
      const next = { ...current };
      for (const [field, key] of Object.entries(queryKeys)) {
        const value = params.get(key);
        if (value !== null) next[field as keyof Filters] = value;
      }
      return next;
    });
  }, []);

  const options = useMemo(
    () => ({
      years: unique(movies.map((movie) => movie.year?.toString() ?? ""))
        .sort()
        .reverse(),
      months: unique(movies.map((movie) => reviewMonth(movie)))
        .sort()
        .reverse(),
      genres: unique(movies.flatMap((movie) => movie.genres)).sort((a, b) =>
        a.localeCompare(b, "sv"),
      ),
    }),
    [movies],
  );

  const results = useMemo(
    () =>
      movies
        .filter(
          (movie) =>
            movie.reviewCount >= Number(filters.minReviews) &&
            (!filters.year || movie.year?.toString() === filters.year) &&
            (!filters.month || reviewMonth(movie) === filters.month) &&
            (!filters.genre || movie.genres.includes(filters.genre)),
        )
        .slice(0, maxResults),
    [movies, filters],
  );

  function update(field: keyof Filters, value: string) {
    const next = { ...filters, [field]: value };
    setFilters(next);
    const params = new URLSearchParams();
    for (const [key, name] of Object.entries(queryKeys)) {
      const current = next[key as keyof Filters];
      if (current !== defaultFilters[key as keyof Filters]) params.set(name, current);
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  return (
    <>
      <div className="filters">
        <label>
          Utgivningsår
          <select value={filters.year} onChange={(event) => update("year", event.target.value)}>
            <option value="">Alla år</option>
            {options.years.map((year) => (
              <option key={year}>{year}</option>
            ))}
          </select>
        </label>
        <label>
          Recenserad
          <select value={filters.month} onChange={(event) => update("month", event.target.value)}>
            <option value="">Alla månader</option>
            {options.months.map((month) => (
              <option key={month} value={month}>
                {monthFormat.format(new Date(`${month}-01T00:00:00Z`))}
              </option>
            ))}
          </select>
        </label>
        <label>
          Genre
          <select value={filters.genre} onChange={(event) => update("genre", event.target.value)}>
            <option value="">Alla genrer</option>
            {options.genres.map((genre) => (
              <option key={genre}>{genre}</option>
            ))}
          </select>
        </label>
        <label>
          Minst antal recensioner
          <select
            value={filters.minReviews}
            onChange={(event) => update("minReviews", event.target.value)}
          >
            {minReviewOptions.map((count) => (
              <option key={count}>{count}</option>
            ))}
          </select>
        </label>
      </div>
      {results.length ? (
        <MovieList movies={results} />
      ) : (
        <p className="muted">Inga filmer matchar filtren.</p>
      )}
    </>
  );
}

function reviewMonth(movie: TopListMovie): string {
  return movie.firstReviewedAt.slice(0, 7);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].filter(Boolean);
}
