import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { filmbladet } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  assert.deepEqual(filmbladet.parseReview("https://filmbladet.se/recension/eternity", html), {
    title: "Eternity",
    year: 2025,
    rawScore: 6,
    scaleMax: 10,
    critic: "Fredrik Lagnetoft",
    publishedAt: "2026-08-23T12:54:00.000Z",
  });
});
