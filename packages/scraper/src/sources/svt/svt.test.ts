import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { svt } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url = "https://www.svt.se/kultur/recension-tony-av-matt-johnson";
  assert.deepEqual(svt.parseReview(url, html), {
    title: "Tony",
    rawScore: 3,
    scaleMax: 5,
    critic: "Caroline Hainer",
    publishedAt: "2026-09-18T05:30:07+02:00",
  });
});
