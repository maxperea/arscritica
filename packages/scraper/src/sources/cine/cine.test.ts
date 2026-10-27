import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { cine } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  assert.deepEqual(cine.parseReview("https://cine.se/recensioner/dunkirk/", html), {
    title: "Dunkirk",
    year: 2016,
    rawScore: 4,
    scaleMax: 5,
    critic: "Martin Steijer",
    publishedAt: "2017-08-17T07:50:51.000Z",
  });
});
