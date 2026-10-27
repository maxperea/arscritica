import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { aftonbladet } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url = "https://www.aftonbladet.se/nojesbladet/film/a/Ar4X9n/verity-har-ar-recensionen";
  assert.deepEqual(aftonbladet.parseReview(url, html), {
    title: "Verity",
    rawScore: 2,
    scaleMax: 5,
    critic: "Daniel Hånberg Alonso",
    publishedAt: "2026-10-01T07:05:54Z",
  });
});
