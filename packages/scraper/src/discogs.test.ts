import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMaster, parseRelease, pickDiscogsAlbum } from "./discogs";
import { readFixture } from "./testing/fixtures";

const elements = (xml: string, name: string) =>
  [...xml.matchAll(new RegExp(`<${name} id=.*?</${name}>`, "gs"))].map((match) => match[0]);
const releases = elements(readFixture(import.meta.url, "discogs-releases.xml"), "release").map(
  parseRelease,
);
const masters = new Map(
  elements(readFixture(import.meta.url, "discogs-masters.xml"), "master")
    .map(parseMaster)
    .map((master) => [master.id, master]),
);

test("picks the Discogs master of an album and leaves singles unmatched", () => {
  assert.deepEqual(pickDiscogsAlbum(releases, masters, "Kräm", "När ska vi fira livet", 2022), {
    discogsMasterId: 55,
    discogsReleaseId: undefined,
    artistCredit: "Kräm",
    title: "När Ska Vi Fira Livet",
    kind: "album",
    year: 2022,
    trackCount: 2,
  });
  assert.equal(pickDiscogsAlbum(releases, masters, "Kräm", "Fira livet", 2022), undefined);
});
