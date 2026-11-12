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
    if (url.host === "coverartarchive.org") return new Response(null, { status: 307 });
    const fixture = url.pathname.endsWith("/release")
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
      "https://coverartarchive.org/release-group/6f46d5e4-1e46-4480-b120-d04b37145f7f/front-500",
    coverThumbnailUrl:
      "https://coverartarchive.org/release-group/6f46d5e4-1e46-4480-b120-d04b37145f7f/front-250",
  });
  assert.equal(requests.length, 3);
});

test("allows a year of release-date slack and older albums with distinctive titles", () => {
  const groups = search["release-groups"];
  assert.equal(pickReleaseGroup(groups, "Robyn", "Honey", 2016), undefined);
  assert.equal(pickReleaseGroup(groups, "Robyn", "Honey", 2017)?.title, "Honey");
  assert.equal(pickReleaseGroup(groups, "Robyn", "Honey", 2026)?.title, "Honey");
  assert.equal(pickReleaseGroup(groups, "The Robyn", "Honey", 2019)?.title, "Honey");
  const selfTitled = { ...groups[1], id: "self", title: "Robyn" };
  assert.equal(pickReleaseGroup([selfTitled], "Robyn", "Robyn", 2026), undefined);
});

test("matches spelling variants of titles and artist credits", () => {
  const album = search["release-groups"][1];
  const credit = (names: string[]) =>
    names.map((name, index) => ({
      name,
      joinphrase: index < names.length - 1 ? " & " : "",
      artist: { id: name, name },
    }));
  const duo = {
    ...album,
    title: "The River & the Thread",
    "artist-credit": credit(["Future", "Metro Boomin"]),
  };
  assert.equal(
    pickReleaseGroup([duo], "Metro Boomin och Future", "The River And The Thread", 2018)?.id,
    album.id,
  );
  assert.equal(pickReleaseGroup([album], "Robyn -", "Honey EP", 2018)?.id, album.id);
  assert.equal(pickReleaseGroup([album], "Robyn", "Honey: Versions", 2018), undefined);
  const subtitled = { ...album, title: "Honey: Music From the Film" };
  assert.equal(pickReleaseGroup([subtitled], "Robyn", "Honey", 2018)?.id, album.id);
  const longer = { ...album, title: "Wizards on the Beach" };
  assert.equal(pickReleaseGroup([longer], "Robyn", "Wizard on the Beach", 2018)?.id, album.id);
  const sequel = { ...album, title: "Necessary, Pt. 2" };
  assert.equal(pickReleaseGroup([sequel], "Robyn", "Necessary, Pt. 3", 2018), undefined);
});

test("prefers the earliest release and leaves same-year twins unmatched", () => {
  const album = search["release-groups"][1];
  const twin = { ...album, id: "twin" };
  assert.equal(pickReleaseGroup([album, twin], "Robyn", "Honey", 2018), undefined);
  const reissue = { ...album, id: "reissue", "first-release-date": "2019-01-01" };
  assert.equal(pickReleaseGroup([reissue, album], "Robyn", "Honey", 2019)?.id, album.id);
});
