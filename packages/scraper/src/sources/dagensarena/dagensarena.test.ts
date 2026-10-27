import assert from "node:assert/strict";
import { test } from "node:test";
import { readFixture } from "../../testing/fixtures";
import { dagensarena } from "./index";

test("parses a review", () => {
  const html = readFixture(import.meta.url, "review.html");
  assert.deepEqual(
    dagensarena.parseReview(
      "https://www.dagensarena.se/innehall/russel-crowe-ar-lysande-som-goring-i-andra-varldskrigsdrama/",
      html,
    ),
    {
      title: "Nürnberg",
      rawScore: 3,
      scaleMax: 5,
      critic: "Jon Andersson",
      publishedAt: "2025-12-04",
    },
  );
});
