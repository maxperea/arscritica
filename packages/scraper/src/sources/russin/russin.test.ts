import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { russin } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  assert.deepEqual(russin.parseReview("https://russin.nu/filmview.php?filmid=3921", html), {
    title: "Electric Jesus",
    year: 2020,
    rawScore: 3,
    scaleMax: 5,
    critic: "Johan Lindahl",
    publishedAt: "2026-03-21",
  });
});
