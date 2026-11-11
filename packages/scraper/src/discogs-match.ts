import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  attachAlbumData,
  findAlbumIdByDiscogs,
  findAlbums,
  mergeAlbumInto,
  openDatabase,
  recentUnmatchedAlbums,
} from "@arscritica/db";
import { normalizeTitle } from "@arscritica/db/text";
import { creditMatches, nameKeys, titleVariants } from "./album-match";
import { MusicBrainzClient } from "./musicbrainz";
import {
  parseMaster,
  parseRelease,
  pickDiscogsAlbum,
  readDiscogsDump,
  releaseCredit,
  releaseTitle,
  type DiscogsMaster,
  type DiscogsRelease,
} from "./discogs";

const { values } = parseArgs({
  options: {
    db: { type: "string" },
    releases: { type: "string" },
    masters: { type: "string" },
    candidates: { type: "string" },
  },
});

const invocationDir = process.env.INIT_CWD ?? process.cwd();
const resolve = (file?: string) => (file ? path.resolve(invocationDir, file) : undefined);
const db = openDatabase({ path: resolve(values.db) });
const albums = recentUnmatchedAlbums(db, 365 * 100);
const targets = new Map<string, string[][]>();
for (const album of albums) {
  for (const key of titleVariants(album.title).loose) {
    targets.set(key, [...(targets.get(key) ?? []), nameKeys(album.artist)]);
  }
}

const cachePath = resolve(values.candidates);
const { releases, masters } =
  cachePath && existsSync(cachePath)
    ? (JSON.parse(readFileSync(cachePath, "utf8")) as {
        releases: DiscogsRelease[];
        masters: DiscogsMaster[];
      })
    : await extractCandidates();
if (cachePath && !existsSync(cachePath)) {
  writeFileSync(cachePath, JSON.stringify({ releases, masters }));
}

const musicBrainz = new MusicBrainzClient();
const releasesByTitle = new Map<string, DiscogsRelease[]>();
for (const release of releases) {
  for (const key of titleVariants(release.title).loose) {
    releasesByTitle.set(key, [...(releasesByTitle.get(key) ?? []), release]);
  }
}
const mastersById = new Map(masters.map((master) => [master.id, master]));
const artistsByKey = new Map<string, { mbid: string; name: string }[]>();
for (const artist of db.prepare("SELECT mbid, name FROM artists").all() as {
  mbid: string;
  name: string;
}[]) {
  const key = normalizeTitle(artist.name);
  artistsByKey.set(key, [...(artistsByKey.get(key) ?? []), artist]);
}

let matched = 0;
for (const album of albums) {
  const candidates = [
    ...new Set(
      [...titleVariants(album.title).loose].flatMap((key) => releasesByTitle.get(key) ?? []),
    ),
  ];
  const found = pickDiscogsAlbum(
    candidates,
    mastersById,
    album.artist,
    album.title,
    new Date(album.reviewedAt).getUTCFullYear(),
  );
  if (!found) continue;
  const vetoed = await musicBrainz.isNonAlbumRelease(album.artist, album.title).catch(() => true);
  if (vetoed) {
    console.log(`vetoed\t${album.artist}\t${album.title}`);
    continue;
  }
  const known =
    findAlbumIdByDiscogs(db, found) ??
    findAlbums(db, found.artistCredit, found.title).find((candidate) => candidate.matched)?.id;
  if (known !== undefined) {
    mergeAlbumInto(db, album.id, known);
  } else {
    const artists = artistsByKey.get(normalizeTitle(found.artistCredit)) ?? [];
    attachAlbumData(db, album.id, {
      ...found,
      artist: artists.length === 1 ? artists[0] : undefined,
    });
  }
  matched++;
  console.log(
    `matched\t${album.artist}\t${album.title}\t${album.reviewedAt.slice(0, 10)}\t` +
      `${found.artistCredit}\t${found.title}\t${found.year ?? ""}\t${found.kind}\t` +
      `${found.discogsMasterId ? `m${found.discogsMasterId}` : `r${found.discogsReleaseId}`}`,
  );
}
console.log(`Matched ${matched} of ${albums.length} unmatched albums on Discogs.`);
db.close();

async function extractCandidates() {
  if (!values.releases || !values.masters) throw new Error("--releases and --masters are required");
  const releases: DiscogsRelease[] = [];
  for await (const xml of readDiscogsDump(resolve(values.releases)!, "release")) {
    const title = releaseTitle(xml);
    if (!title) continue;
    const artists = [...titleVariants(title).loose].flatMap((key) => targets.get(key) ?? []);
    if (!artists.length) continue;
    const credit = releaseCredit(xml);
    if (artists.some((names) => creditMatches(credit, names))) releases.push(parseRelease(xml));
  }
  const masterIds = new Set(releases.map((release) => release.masterId).filter(Boolean));
  const masters: DiscogsMaster[] = [];
  for await (const xml of readDiscogsDump(resolve(values.masters)!, "master")) {
    const id = Number(/<master id="(\d+)"/.exec(xml)?.[1]);
    if (masterIds.has(id)) masters.push(parseMaster(xml));
  }
  return { releases, masters };
}
