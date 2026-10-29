import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getMovie,
  insertMovie,
  openDatabase,
  setMovieGenres,
  setMovieImdbId,
  setMovieOverview,
  tmdbMoviesMissingDetails,
  upsertPublication,
  insertReview,
} from "@arscritica/db";
import { backfillMovieDetails, type DetailsClient } from "./details";
import type { TmdbMovieDetails } from "./tmdb";

test("backfills runtime without overwriting existing details and retries only failures", async () => {
  const db = openDatabase({ path: ":memory:" });
  const publicationId = upsertPublication(db, { slug: "p", name: "P", url: "https://p.test" });
  const addMovie = (tmdbId: number, title: string) => {
    const movieId = insertMovie(db, { tmdbId, title, year: 2025 });
    insertReview(db, {
      movieId,
      publicationId,
      url: `https://p.test/${tmdbId}`,
      sourceTitle: title,
      rawScore: 4,
      scaleMax: 5,
    });
    return movieId;
  };
  const complete = addMovie(1, "Komplett");
  setMovieGenres(db, complete, ["Drama"]);
  setMovieImdbId(db, complete, "tt0000001");
  setMovieOverview(db, complete, "Svensk handling.");
  addMovie(2, "Ny film");
  addMovie(3, "Utan längd");
  addMovie(4, "Trasig");

  const details: Record<number, TmdbMovieDetails> = {
    1: { genres: ["Komedi"], imdbId: "tt9999999", overview: "Ny handling.", runtime: 133 },
    2: { genres: ["Thriller"], imdbId: "tt0000002", overview: "Handling.", runtime: 95 },
    3: { genres: ["Dokumentär"], imdbId: "tt0000003", overview: "Kort." },
  };
  const requests: number[] = [];
  const englishRequests: number[] = [];
  const tmdb: DetailsClient = {
    async movieDetails(tmdbId) {
      requests.push(tmdbId);
      if (!details[tmdbId]) throw new Error("HTTP 500");
      return details[tmdbId];
    },
    async englishOverview(tmdbId) {
      englishRequests.push(tmdbId);
      return undefined;
    },
  };

  assert.deepEqual(await backfillMovieDetails(db, tmdb), {
    candidates: 4,
    detailsUpdated: 2,
    runtimeFound: 2,
    runtimeMissing: 1,
    failed: 1,
  });
  assert.deepEqual(englishRequests, []);

  const kept = getMovie(db, "komplett-2025")!;
  assert.equal(kept.runtime, 133);
  assert.equal(kept.imdbId, "tt0000001");
  assert.equal(kept.overview, "Svensk handling.");
  assert.deepEqual(
    db
      .prepare("SELECT name FROM movie_genres WHERE movie_id = ?")
      .all(complete)
      .map((row) => row.name),
    ["Drama"],
  );
  assert.equal(getMovie(db, "ny-film-2025")!.runtime, 95);
  assert.equal(getMovie(db, "utan-langd-2025")!.runtime, null);

  assert.deepEqual(
    tmdbMoviesMissingDetails(db).map((movie) => movie.tmdbId),
    [4],
  );
  requests.length = 0;
  await backfillMovieDetails(db, tmdb);
  assert.deepEqual(requests, [4]);
});
