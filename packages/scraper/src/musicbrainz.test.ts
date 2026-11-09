import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { MusicBrainzClient, pickReleaseGroup } from "./musicbrainz";
import { readFixture } from "./testing/fixtures";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const search = JSON.parse(readFixture(import.meta.url, "musicbrainz-search.json"));

test("finds an album with its year, track count and cover", async () => {
  const requests: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    requests.push(url.href);
    const fixture = url.host.startsWith("coverartarchive")
      ? "coverartarchive.json"
      : url.pathname.endsWith("/release")
        ? "musicbrainz-releases.json"
        : "musicbrainz-search.json";
    return new Response(readFixture(import.meta.url, fixture));
  }) as typeof fetch;

  const album = await new MusicBrainzClient({ minDelayMs: 0 }).findAlbum("Robyn", "Honey", 2018);
  assert.deepEqual(album, {
    mbid: "6f46d5e4-1e46-4480-b120-d04b37145f7f",
    title: "Honey",
    artistCredit: "Robyn",
    artist: { mbid: "5a8e07d5-d932-4484-a7f7-e700793a9c94", name: "Robyn" },
    kind: "album",
    year: 2018,
    trackCount: 9,
    coverUrl:
      "https://coverartarchive.org/release/72c8191a-0de2-477a-8332-44fead8ff10e/21673502612-500.jpg",
    coverThumbnailUrl:
      "https://coverartarchive.org/release/72c8191a-0de2-477a-8332-44fead8ff10e/21673502612-250.jpg",
  });
  assert.equal(requests.length, 3);
});

test("leaves releases after the review or long before it unmatched", () => {
  const groups = search["release-groups"];
  assert.equal(pickReleaseGroup(groups, "Robyn", "Honey", 2017), undefined);
  assert.equal(pickReleaseGroup(groups, "Robyn", "Honey", 2026), undefined);
  assert.equal(pickReleaseGroup(groups, "The Robyn", "Honey", 2019)?.title, "Honey");
});

test("leaves same-titled albums from the same year unmatched", () => {
  const album = search["release-groups"][1];
  const twin = { ...album, id: "twin" };
  assert.equal(pickReleaseGroup([album, twin], "Robyn", "Honey", 2018), undefined);
  const older = { ...album, id: "older", "first-release-date": "2017-01-01" };
  assert.equal(pickReleaseGroup([older, album], "Robyn", "Honey", 2018)?.id, album.id);
});
