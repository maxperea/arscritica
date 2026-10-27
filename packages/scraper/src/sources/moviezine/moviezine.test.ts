import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { moviezine } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  assert.deepEqual(
    moviezine.parseReview("https://www.moviezine.se/recensioner/recension-enzo", html),
    {
      title: "Enzo",
      year: 2025,
      rawScore: 4,
      scaleMax: 5,
      critic: "Andreas Samuelson",
      publishedAt: "2026-10-27T17:30:00+01:00",
    },
  );
});
