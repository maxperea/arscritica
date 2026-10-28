import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { filmtopp, parseFilmTitle } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  assert.deepEqual(
    filmtopp.parseReview(
      "https://www.filmtopp.se/recension/cristian-mungius-prisade-drama-fjord-sager-mycket-om-var-samtid",
      html,
    ),
    {
      title: "Fjord",
      year: 2026,
      rawScore: 3,
      scaleMax: 5,
      critic: "Axel Diedrichs",
      publishedAt: "2026-10-01T13:30:00.000Z",
    },
  );
});

test("cleans headline-style titles and skips series", () => {
  assert.deepEqual(parseFilmTitle("Recension: Dune: Part Two (2024) – mästerlig rymdbalett"), {
    title: "Dune: Part Two",
    year: 2024,
  });
  assert.deepEqual(parseFilmTitle("Recension: ”Red One” (2024) – så bra är julfilmen"), {
    title: "Red One",
    year: 2024,
  });
  assert.equal(parseFilmTitle("Recension: The Bear (säsong 3) – inte perfekt"), null);
});
