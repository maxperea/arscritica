import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { aftonbladet } from "./index";

test("parses an album review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url =
    "https://www.aftonbladet.se/nojesbladet/musik/a/kvo4dQ/mauro-scocco-livets-rytm-recension";
  assert.deepEqual(aftonbladet.parseReview(url, html), {
    artist: "Mauro Scocco",
    title: "Livets rytm",
    rawScore: 4,
    scaleMax: 5,
    critic: "Håkan Steen",
    publishedAt: "2026-10-30T06:00:00Z",
  });
});

test("skips single reviews", () => {
  const html = readFixture(import.meta.url, "single.html");
  assert.equal(aftonbladet.parseReview("", html), null);
});

test("reads artist and title from the lines under the grade", () => {
  const html = readFixture(import.meta.url, "fact-lines.html");
  assert.deepEqual(aftonbladet.parseReview("", html), {
    artist: "Kanye West",
    title: "Jesus is king",
    rawScore: 3,
    scaleMax: 5,
    critic: "Markus Larsson",
    publishedAt: "2019-10-25T22:34:46Z",
  });
});
