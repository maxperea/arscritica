import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { svd } from "./index";

test("parses an album review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url = "https://www.svd.se/a/wgzQan/vill-man-hora-en-62-arings-erotiska-funk";
  assert.deepEqual(svd.parseReview(url, html), {
    artist: "Pulp",
    title: "More",
    rawScore: 5,
    scaleMax: 6,
    critic: "Andres Lokko",
    publishedAt: "2025-06-06T12:00:00Z",
  });
});

test("skips compilations", () => {
  const html = readFixture(import.meta.url, "compilation.html");
  const url = "https://www.svd.se/a/qPoOAE/sa-bra-ar-bruce-springsteens-samling-tracks-2";
  assert.equal(svd.parseReview(url, html), null);
});
