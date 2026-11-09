import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { kulturbloggen } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url = "https://kulturbloggen.com/?p=209156";
  assert.deepEqual(kulturbloggen.parseReview(url, html), {
    artist: "Elina Duni/ Rob Luft",
    title: "Reaching For The Moon",
    rawScore: 4,
    scaleMax: 5,
    critic: "Mats Hallberg",
    publishedAt: "2026-09-25T16:42:40+02:00",
  });
});
