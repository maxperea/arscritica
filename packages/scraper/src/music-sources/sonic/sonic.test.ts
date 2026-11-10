import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { sonic } from "./index";

test("parses an album review", () => {
  const html = readFixture(import.meta.url, "review.html");
  const url = "https://sonicmagazine.com/2018/12/21/jonas-bergsten-varm-vidrig-sommar/";
  assert.deepEqual(sonic.parseReview(url, html), {
    artist: "Jonas Bergsten",
    title: "Varm vidrig sommar",
    rawScore: 7,
    scaleMax: 10,
    critic: "Pierre Hellqvist",
    publishedAt: "2018-12-21T08:07:00+01:00",
  });
});

test("parses an older review without a fact card", () => {
  const html = readFixture(import.meta.url, "legacy-review.html");
  const url = "https://sonicmagazine.com/2011/05/30/russian-red-fuerteventura/";
  assert.deepEqual(sonic.parseReview(url, html), {
    artist: "Russian Red",
    title: "Fuerteventura",
    rawScore: 6,
    scaleMax: 10,
    publishedAt: "2011-05-30T23:27:00+02:00",
  });
});
