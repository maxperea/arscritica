import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { TmdbClient } from "./tmdb";

interface FakeMovie {
  id: number;
  title: string;
  year: number;
  runtime: number;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function fakeTmdb(movies: FakeMovie[]): void {
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/3/", "");
    let body: unknown;
    if (path === "genre/movie/list") body = { genres: [] };
    else if (path === "search/movie") {
      const year = url.searchParams.get("primary_release_year");
      body = {
        results: movies
          .filter((movie) => !year || String(movie.year) === year)
          .map((movie) => ({
            id: movie.id,
            title: movie.title,
            original_title: movie.title,
            release_date: `${movie.year}-01-01`,
          })),
      };
    } else body = { runtime: movies.find((movie) => path === `movie/${movie.id}`)?.runtime };
    return new Response(JSON.stringify(body));
  }) as typeof fetch;
}

test("skips same-titled short films", async () => {
  fakeTmdb([
    { id: 1, title: "Presence", year: 2024, runtime: 3 },
    { id: 2, title: "Presence", year: 2025, runtime: 84 },
  ]);
  assert.equal((await new TmdbClient("key").findMovie("Presence", 2024, 2025))?.id, 2);
});

test("prefers the exact match closest to the review when the year is unknown", async () => {
  fakeTmdb([
    { id: 1, title: "Drömmar", year: 2005, runtime: 112 },
    { id: 2, title: "Drömmar", year: 2024, runtime: 111 },
  ]);
  assert.equal((await new TmdbClient("key").findMovie("Drömmar", undefined, 2025))?.id, 2);
});
