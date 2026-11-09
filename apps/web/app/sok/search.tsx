"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AlbumSummary, MovieSummary } from "@arscritica/db";
import { normalizeTitle } from "@arscritica/db/text";
import { AlbumLink } from "@/components/album-list";
import { MovieLink } from "@/components/movie-list";

type SearchItem = { key: string; title: string; keys: string[] } & (
  { movie: MovieSummary } | { album: AlbumSummary }
);

const pageSize = 50;

export function Search() {
  const [items, setItems] = useState<SearchItem[] | null>(null);
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
    setItems(null);
    setLoadError(false);
    const load = <T,>(path: string) =>
      fetch(`${process.env.ARSCRITICA_BASE_PATH}${path}`, { signal: controller.signal }).then(
        (response) => {
          if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
          return response.json() as Promise<T[]>;
        },
      );
    Promise.all([
      load<MovieSummary>("/search-index.json"),
      load<AlbumSummary>("/musik/search-index.json"),
    ])
      .then(([movies, albums]) =>
        setItems(
          [
            ...movies.map((movie) => ({
              key: `film-${movie.slug}`,
              title: movie.title,
              keys: [movie.title, movie.originalTitle ?? ""].map(normalizeTitle),
              movie,
            })),
            ...albums.map((album) => ({
              key: `album-${album.slug}`,
              title: album.title,
              keys: [album.title, album.artistCredit].map(normalizeTitle),
              album,
            })),
          ].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)),
        ),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Could not load the search index", error);
        setLoadError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const needle = normalizeTitle(query);
  const results = useMemo(
    () =>
      needle && items ? items.filter((item) => item.keys.some((key) => key.includes(needle))) : [],
    [items, needle],
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
        placeholder="Sök på titel eller artist…"
        aria-label="Sök på titel eller artist"
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
      ) : items === null ? (
        <p className="muted" role="status">
          Laddar…
        </p>
      ) : needle && !results.length ? (
        <div className="empty-state">
          <p role="status">Inga filmer eller album matchade sökningen.</p>
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
              ? `Visar ${visible.length} av ${results.length} träffar`
              : results.length === 1
                ? "1 träff"
                : `${results.length} träffar`}
          </p>
          <ul className="list movie-list">
            {visible.map((item) => (
              <li key={item.key}>
                {"movie" in item ? (
                  <MovieLink movie={item.movie} label="Film" />
                ) : (
                  <AlbumLink album={item.album} label="Album" />
                )}
              </li>
            ))}
          </ul>
          {visible.length < results.length && (
            <button type="button" className="button show-more" onClick={() => setShowAll(true)}>
              Visa fler
            </button>
          )}
        </>
      ) : (
        <p className="muted">Sök på filmtitel, albumtitel eller artist.</p>
      )}
    </>
  );
}
