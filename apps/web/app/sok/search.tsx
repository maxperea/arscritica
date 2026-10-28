"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MovieSummary } from "@arscritica/db";
import { normalizeTitle } from "@arscritica/db/text";
import { MovieList } from "@/components/movie-list";

type IndexedMovie = MovieSummary & { keys: string[] };

const pageSize = 50;

export function Search() {
  const [movies, setMovies] = useState<IndexedMovie[] | null>(null);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function readQuery() {
      setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
      setShowAll(false);
    }
    readQuery();
    window.addEventListener("popstate", readQuery);
    return () => window.removeEventListener("popstate", readQuery);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setMovies(null);
    setLoadError(false);
    fetch(`${process.env.ARSCRITICA_BASE_PATH}/search-index.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
        return response.json() as Promise<MovieSummary[]>;
      })
      .then((index) =>
        setMovies(
          index.map((movie) => ({
            ...movie,
            keys: [movie.title, movie.originalTitle ?? ""].map(normalizeTitle),
          })),
        ),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Could not load the film search index", error);
        setLoadError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const needle = normalizeTitle(query);
  const results = useMemo(
    () =>
      needle && movies
        ? movies.filter((movie) => movie.keys.some((key) => key.includes(needle)))
        : [],
    [movies, needle],
  );
  const visible = showAll ? results : results.slice(0, pageSize);

  function changeQuery(value: string) {
    setQuery(value);
    setShowAll(false);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <>
      <input
        className="search-input"
        type="search"
        placeholder="Sök på titel…"
        aria-label="Sök på titel"
        ref={inputRef}
        value={query}
        onChange={(event) => changeQuery(event.target.value)}
        autoFocus
      />
      {loadError ? (
        <div className="empty-state">
          <p role="alert">Sökningen kunde inte laddas.</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setAttempt((value) => value + 1);
              inputRef.current?.focus();
            }}
          >
            Försök igen
          </button>
        </div>
      ) : movies === null ? (
        <p className="muted" role="status">
          Laddar filmer…
        </p>
      ) : needle && !results.length ? (
        <div className="empty-state">
          <p role="status">Inga filmer matchade sökningen.</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              changeQuery("");
              inputRef.current?.focus();
            }}
          >
            Rensa sökningen
          </button>
        </div>
      ) : needle ? (
        <>
          <p className="muted caption" role="status">
            {visible.length < results.length
              ? `Visar ${visible.length} av ${results.length} filmer`
              : results.length === 1
                ? "1 film"
                : `${results.length} filmer`}
          </p>
          <MovieList movies={visible} />
          {visible.length < results.length && (
            <button type="button" className="button show-more" onClick={() => setShowAll(true)}>
              Visa fler
            </button>
          )}
        </>
      ) : (
        <p className="muted">Sök på svensk titel eller originaltitel.</p>
      )}
    </>
  );
}
