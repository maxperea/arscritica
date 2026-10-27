import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { gamereactor } from "./index";

test("parses a film review", () => {
  const html = readFixture(import.meta.url, "review.html");
  assert.deepEqual(
    gamereactor.parseReview("https://www.gamereactor.se/the-odyssey-1860443/", html),
    {
      title: "The Odyssey",
      rawScore: 5,
      scaleMax: 10,
      critic: "Peter Westberg",
      publishedAt: "2026-07-18T23:53:22+02:00",
    },
  );
});
