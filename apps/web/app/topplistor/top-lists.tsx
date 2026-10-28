"use client";

import { useEffect, useMemo, useState } from "react";
import type { TopListMovie, WatchKind } from "@arscritica/db";
import { MovieList } from "@/components/movie-list";
import {
  allPeriod,
  genres,
  movieGenres,
  periodLabel,
  periodMovies,
  periods,
  recentDays,
  recentPeriod,
} from "@/lib/top-list";

const pageSize = 50;

const watchOptions: { kind: WatchKind; label: string; phrase: string }[] = [
  { kind: "stream", label: "Streama", phrase: "att streama" },
  { kind: "rent", label: "Hyr", phrase: "att hyra" },
  { kind: "buy", label: "Köp", phrase: "att köpa" },
];

interface Selection {
  now: number;
  period: string;
  genre: string;
  watch: WatchKind | "";
}

export function TopLists({ movies }: { movies: TopListMovie[] }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showAll, setShowAll] = useState(false);
  const periodOptions = useMemo(() => periods(movies), [movies]);
  const knownGenres = useMemo(() => genres(movies), [movies]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const period = params.get("period") ?? "";
    const genre = params.get("genre") ?? "";
    const watch = watchOptions.find((option) => option.kind === params.get("watch"));
    setSelection({
      now: Date.now(),
      period: periodOptions.includes(period) ? period : recentPeriod,
      genre: knownGenres.some((option) => option.slug === genre) ? genre : "",
      watch: watch?.kind ?? "",
    });
  }, [periodOptions, knownGenres]);

  const view = useMemo(() => {
    if (!selection) return null;
    const genreOptions = genres(periodMovies(movies, selection.period, selection.now));
    const genreName = knownGenres.find((option) => option.slug === selection.genre)?.name;
    const results = filterMovies(
      periodMovies(movies, selection.period, selection.now),
      genreName,
      selection.watch,
    );
    const alternative = periodOptions.find(
      (period) =>
        period !== selection.period &&
        filterMovies(periodMovies(movies, period, selection.now), genreName, selection.watch)
          .length > 0,
    );
    return { genreOptions, genreName, results, alternative };
  }, [movies, selection, periodOptions, knownGenres]);

  if (!selection || !view) return null;

  function select(period: string, genre: string, watch = selection?.watch ?? "") {
    if (!selection) return;
    setSelection({ ...selection, period, genre, watch });
    setShowAll(false);
    const params = new URLSearchParams();
    if (period !== recentPeriod) params.set("period", period);
    if (genre) params.set("genre", genre);
    if (watch) params.set("watch", watch);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  function selectPeriod(period: string) {
    if (!selection) return;
    const keepGenre = genres(periodMovies(movies, period, selection.now)).some(
      (option) => option.slug === selection.genre,
    );
    select(period, keepGenre ? selection.genre : "");
  }

  const { period, genre, watch } = selection;
  const watchPhrase = watchOptions.find((option) => option.kind === watch)?.phrase;
  const { genreOptions, genreName, results, alternative } = view;
  const visible = showAll ? results : results.slice(0, pageSize);

  return (
    <>
      <div className="segmented" role="group" aria-label="Period">
        {periodOptions.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === period}
            onClick={() => selectPeriod(option)}
          >
            {periodLabel(option)}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Var att se">
        <button
          type="button"
          className="chip"
          aria-pressed={!watch}
          onClick={() => select(period, genre, "")}
        >
          Alla filmer
        </button>
        {watchOptions.map((option) => (
          <button
            key={option.kind}
            type="button"
            className="chip"
            aria-pressed={option.kind === watch}
            onClick={() => select(period, genre, option.kind)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {genreOptions.length > 0 && (
        <div className="chips" role="group" aria-label="Genre">
          <button
            type="button"
            className="chip"
            aria-pressed={!genre}
            onClick={() => select(period, "")}
          >
            Alla genrer
          </button>
          {genreOptions.map((option) => (
            <button
              key={option.slug}
              type="button"
              className="chip"
              aria-pressed={option.slug === genre}
              onClick={() => select(period, option.slug)}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
      {results.length ? (
        <>
          <p className="muted caption">
            {[periodCaption(period), results.length === 1 ? "1 film" : `${results.length} filmer`]
              .filter(Boolean)
              .join(" · ")
              .replace(/^./, (letter) => letter.toUpperCase())}
          </p>
          <MovieList movies={visible} />
          {visible.length < results.length && (
            <button type="button" className="chip show-more" onClick={() => setShowAll(true)}>
              Visa fler
            </button>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>
            Inga filmer{genreName ? ` i genren ${genreName}` : ""}
            {watchPhrase ? ` ${watchPhrase}` : ""}
            {emptyPeriodPhrase(period)}.
          </p>
          {genre && (
            <button type="button" className="chip" onClick={() => select(period, "")}>
              Visa alla genrer
            </button>
          )}
          {watch && (
            <button type="button" className="chip" onClick={() => select(period, genre, "")}>
              Visa alla filmer
            </button>
          )}
          {alternative && (
            <button type="button" className="chip" onClick={() => select(alternative, genre)}>
              Visa {alternative === allPeriod ? "alla perioder" : periodLabel(alternative)}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function filterMovies(
  movies: TopListMovie[],
  genreName: string | undefined,
  watch: WatchKind | "",
): TopListMovie[] {
  return movies.filter(
    (movie) =>
      (!genreName || movieGenres(movie).includes(genreName)) &&
      (!watch || movie.watchKinds.includes(watch)),
  );
}

function periodCaption(period: string): string {
  if (period === recentPeriod) return `nya filmer recenserade senaste ${recentDays} dagarna`;
  if (period === allPeriod) return "";
  return `premiär ${period}`;
}

function emptyPeriodPhrase(period: string): string {
  if (period === recentPeriod) return ` under de senaste ${recentDays} dagarna`;
  if (period === allPeriod) return "";
  return ` med premiär ${period}`;
}
