import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { gaffa } from "./index";

test("parses an album review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url =
    "https://gaffa.se/recensioner/2026/oktober/album/clutter-sugar-rush-punkrock-som-visar-bredd/";
  assert.deepEqual(gaffa.parseReview(url, html), {
    artist: "Clutter",
    title: "Sugar Rush",
    rawScore: 4,
    scaleMax: 6,
    critic: "Daniel Andersson",
    publishedAt: "2026-10-05T10:25:00+02:00",
  });
});

test("rejects a concert review filed as a release", () => {
  const html = readFixture(import.meta.url, "concert.html");
  const url =
    "https://gaffa.se/recensioner/2018/november/releases/elektronikaduo-far-stockholm-att-roja/";
  assert.equal(gaffa.parseReview(url, html), null);
});
