"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MovieSummary } from "@arscritica/db";
import { normalizeTitle } from "@arscritica/db/text";
import { MovieList } from "@/components/movie-list";

type IndexedMovie = MovieSummary & { keys: string[] };

export function Search() {
  const [movies, setMovies] = useState<IndexedMovie[] | null>(null);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.value ||= new URLSearchParams(window.location.search).get("q") ?? "";
      setQuery(input.value);
    }
    fetch(`${process.env.ARSCRITICA_BASE_PATH}/search-index.json`)
      .then((response) => response.json() as Promise<MovieSummary[]>)
      .then((index) =>
        setMovies(
          index.map((movie) => ({
            ...movie,
            keys: [movie.title, movie.originalTitle ?? ""].map(normalizeTitle),
          })),
        ),
      )
      .catch(() => setMovies([]));
  }, []);

  const needle = normalizeTitle(query);
  const results = useMemo(
    () =>
      needle && movies
        ? movies.filter((movie) => movie.keys.some((key) => key.includes(needle))).slice(0, 50)
        : [],
    [movies, needle],
  );

  return (
    <>
      <input
        className="search-input"
        type="search"
        placeholder="Sök på titel…"
        aria-label="Sök på titel"
        ref={inputRef}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      {movies === null ? (
        <p className="muted">Laddar…</p>
      ) : needle && !results.length ? (
        <p className="muted">Inga filmer matchade sökningen.</p>
      ) : (
        <MovieList movies={results} />
      )}
    </>
  );
}
