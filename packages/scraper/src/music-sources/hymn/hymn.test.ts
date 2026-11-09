import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { hymn } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url = "https://hymn.se/2026/06/05/les-big-byrd-ruin-everything/";
  assert.deepEqual(hymn.parseReview(url, html), {
    artist: "Les Big Byrd",
    title: "Ruin Everything",
    rawScore: 8,
    scaleMax: 10,
    critic: "Mana Alipour",
    publishedAt: "2026-06-05T11:57:13+02:00",
  });
});
