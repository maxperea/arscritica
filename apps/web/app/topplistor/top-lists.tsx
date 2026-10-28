"use client";

import { useEffect, useMemo, useState } from "react";
import type { TopListMovie, WatchKind } from "@arscritica/db";
import { MovieList } from "@/components/movie-list";
import {
  allPeriod,
  genreSlug,
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

interface Filters {
  period: string;
  genre: string;
  watch: WatchKind | "";
  service: string;
}

interface Selection extends Filters {
  now: number;
}

export function TopLists({ movies }: { movies: TopListMovie[] }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showAll, setShowAll] = useState(false);
  const periodOptions = useMemo(() => periods(movies), [movies]);
  const knownGenres = useMemo(() => genres(movies), [movies]);
  const knownServices = useMemo(() => services(movies, ""), [movies]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const period = params.get("period") ?? "";
    const genre = params.get("genre") ?? "";
    const watch = watchOptions.find((option) => option.kind === params.get("watch"));
    const service = knownServices.find((name) => genreSlug(name) === params.get("service"));
    setSelection({
      now: Date.now(),
      period: periodOptions.includes(period) ? period : recentPeriod,
      genre: knownGenres.some((option) => option.slug === genre) ? genre : "",
      watch: watch?.kind ?? "",
      service: service ?? "",
    });
  }, [periodOptions, knownGenres, knownServices]);

  const view = useMemo(() => {
    if (!selection) return null;
    const { period, watch, service, now } = selection;
    const inPeriod = periodMovies(movies, period, now);
    const genreOptions = genres(inPeriod);
    const genreName = knownGenres.find((option) => option.slug === selection.genre)?.name;
    const inGenre = filterByGenre(inPeriod, genreName);
    const serviceOptions = services(inGenre, watch);
    if (service && !serviceOptions.includes(service)) serviceOptions.unshift(service);
    const results = filterByWatch(inGenre, watch, service);
    const alternative = periodOptions.find(
      (option) =>
        option !== period &&
        filterByWatch(filterByGenre(periodMovies(movies, option, now), genreName), watch, service)
          .length > 0,
    );
    return { genreOptions, genreName, serviceOptions, results, alternative };
  }, [movies, selection, periodOptions, knownGenres]);

  if (!selection || !view) return null;

  function select(changes: Partial<Filters>) {
    if (!selection) return;
    const next = { ...selection, ...changes };
    setSelection(next);
    setShowAll(false);
    const params = new URLSearchParams();
    if (next.period !== recentPeriod) params.set("period", next.period);
    if (next.genre) params.set("genre", next.genre);
    if (next.watch) params.set("watch", next.watch);
    if (next.service) params.set("service", genreSlug(next.service));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  function selectPeriod(period: string) {
    if (!selection) return;
    const keepGenre = genres(periodMovies(movies, period, selection.now)).some(
      (option) => option.slug === selection.genre,
    );
    select({ period, genre: keepGenre ? selection.genre : "" });
  }

  const { period, genre, watch, service } = selection;
  const watchPhrase = watchOptions.find((option) => option.kind === watch)?.phrase;
  const { genreOptions, genreName, serviceOptions, results, alternative } = view;
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
          onClick={() => select({ watch: "" })}
        >
          Alla filmer
        </button>
        {watchOptions.map((option) => (
          <button
            key={option.kind}
            type="button"
            className="chip"
            aria-pressed={option.kind === watch}
            onClick={() => select({ watch: option.kind })}
          >
            {option.label}
          </button>
        ))}
        <select
          className="chip service-select"
          aria-label="Tjänst"
          data-selected={Boolean(service)}
          value={service}
          onChange={(event) => select({ service: event.target.value })}
        >
          <option value="">Alla tjänster</option>
          {serviceOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {genreOptions.length > 0 && (
        <div className="chips" role="group" aria-label="Genre">
          <button
            type="button"
            className="chip"
            aria-pressed={!genre}
            onClick={() => select({ genre: "" })}
          >
            Alla genrer
          </button>
          {genreOptions.map((option) => (
            <button
              key={option.slug}
              type="button"
              className="chip"
              aria-pressed={option.slug === genre}
              onClick={() => select({ genre: option.slug })}
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
            {service ? ` på ${service}` : ""}
            {emptyPeriodPhrase(period)}.
          </p>
          {genre && (
            <button type="button" className="chip" onClick={() => select({ genre: "" })}>
              Visa alla genrer
            </button>
          )}
          {watch && (
            <button type="button" className="chip" onClick={() => select({ watch: "" })}>
              Visa alla filmer
            </button>
          )}
          {service && (
            <button type="button" className="chip" onClick={() => select({ service: "" })}>
              Visa alla tjänster
            </button>
          )}
          {alternative && (
            <button type="button" className="chip" onClick={() => select({ period: alternative })}>
              Visa {alternative === allPeriod ? "alla perioder" : periodLabel(alternative)}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function filterByGenre(movies: TopListMovie[], genreName: string | undefined): TopListMovie[] {
  return genreName ? movies.filter((movie) => movieGenres(movie).includes(genreName)) : movies;
}

function filterByWatch(
  movies: TopListMovie[],
  watch: WatchKind | "",
  service: string,
): TopListMovie[] {
  if (!watch && !service) return movies;
  return movies.filter((movie) =>
    movie.watchProviders.some(
      (provider) => (!watch || provider.kind === watch) && (!service || provider.name === service),
    ),
  );
}

function services(movies: TopListMovie[], watch: WatchKind | ""): string[] {
  const counts = new Map<string, number>();
  for (const movie of movies) {
    const names = new Set(
      movie.watchProviders
        .filter((provider) => !watch || provider.kind === watch)
        .map((provider) => provider.name),
    );
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b, "sv"))
    .map(([name]) => name);
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
