import assert from "node:assert/strict";
import { test } from "node:test";
import { insertReview, openDatabase, topListMovies, upsertPublication } from "@arscritica/db";
import { resolveMovieId } from "./matcher";

test("stores TMDB genres for matched movies", async () => {
  const db = openDatabase({ path: ":memory:" });
  const movieId = await resolveMovieId(
    db,
    { title: "Sommarnatt", year: 2026, rawScore: 4, scaleMax: 5 },
    {
      findMovie: async () => ({
        id: 1,
        title: "Sommarnatt",
        originalTitle: "Summer Night",
        year: 2026,
        genres: ["Komedi", "Drama"],
      }),
    },
  );
  insertReview(db, {
    movieId,
    publicationId: upsertPublication(db, { slug: "exempel", name: "Exempel", url: "" }),
    url: "https://example.com/sommarnatt",
    sourceTitle: "Sommarnatt",
    rawScore: 4,
    scaleMax: 5,
  });

  assert.deepEqual(topListMovies(db)[0]?.genres, ["Drama", "Komedi"]);
});
