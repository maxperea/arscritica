import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { kulturbloggen } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  assert.deepEqual(kulturbloggen.parseReview("https://kulturbloggen.com/?p=210618", html), {
    title: "Flyktdjur",
    rawScore: 2,
    scaleMax: 5,
    critic: "Rosemari Södergren",
    publishedAt: "2026-10-27T18:33:06+02:00",
  });
});
