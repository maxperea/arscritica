import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { svd } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url = "https://www.svd.se/a/aJ9V62/tony-biofilm-recension-av-anna-hellsten";
  assert.deepEqual(svd.parseReview(url, html), {
    title: "Tony",
    rawScore: 5,
    scaleMax: 6,
    critic: "Anna Hellsten",
    publishedAt: "2026-09-17T15:00:00Z",
  });
});
