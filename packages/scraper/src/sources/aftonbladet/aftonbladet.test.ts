import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { aftonbladet } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url = "https://www.aftonbladet.se/nojesbladet/film/a/Ar4X9n/verity-har-ar-recensionen";
  assert.deepEqual(aftonbladet.parseReview(url, html), {
    title: "Verity",
    rawScore: 2,
    scaleMax: 5,
    critic: "Daniel Hånberg Alonso",
    publishedAt: "2026-10-01T07:05:54Z",
  });
});

test("falls back to the article grade on older reviews", () => {
  const parse = (name: string) => aftonbladet.parseReview("", readFixture(import.meta.url, name));
  assert.deepEqual(parse("review-2010.html"), {
    title: "Eclipse",
    rawScore: 3,
    scaleMax: 5,
    critic: "Emma Gray",
    publishedAt: "2010-07-02T04:00:38Z",
  });
  assert.equal(parse("review-2015.html")?.title, "Kung Fury");
  assert.equal(parse("review-2015.html")?.rawScore, 4);
  assert.equal(parse("review-2022.html")?.title, "The Northman");
  assert.equal(parse("paywalled-2011.html"), null);
  assert.equal(parse("list-2014.html"), null);
});
