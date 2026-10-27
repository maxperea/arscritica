import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { sr } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url =
    "https://www.sverigesradio.se/artikel/recension-palestina-36-skildrar-revolten-mot-england";
  assert.deepEqual(sr.parseReview(url, html), {
    title: "Palestina 36",
    rawScore: 3,
    scaleMax: 5,
    critic: "Emma Engström",
    publishedAt: "2026-10-19T05:00:00Z",
  });
});
