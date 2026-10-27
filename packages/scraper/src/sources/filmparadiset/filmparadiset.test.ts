import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { filmparadiset } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  assert.deepEqual(
    filmparadiset.parseReview(
      "https://filmparadiset.se/2026/10/24/recension-the-dog-stars-2026/",
      html,
    ),
    {
      title: "The Dog Stars",
      year: 2026,
      rawScore: 6,
      scaleMax: 10,
      critic: "Tommy",
      publishedAt: "2026-10-24T16:39:29+02:00",
    },
  );
});
