import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import type { AlbumInput } from "@arscritica/db";
import { creditMatches, nameKeys, pickCandidate, titleVariants, type Credit } from "./album-match";

export interface DiscogsRelease {
  id: number;
  masterId?: number;
  isMainRelease: boolean;
  title: string;
  credit: Credit;
  formats: string[];
  year?: number;
  trackCount?: number;
}

export interface DiscogsMaster {
  id: number;
  mainRelease: number;
  title: string;
  credit: Credit;
  year?: number;
}

interface DiscogsGroup {
  masterId?: number;
  releaseId?: number;
  title: string;
  credit: Credit;
  year?: number;
  formats: string[];
  trackCount?: number;
}

const ALBUM_FORMATS = new Set(["album", "lp", "ep", "mini-album"]);
const NOT_ALBUM_FORMATS = new Set(["single", "maxi-single", "compilation", "sampler"]);
const EP_FORMATS = new Set(["ep", "mini-album"]);

export async function* readDiscogsDump(path: string, element: "release" | "master") {
  const closing = `</${element}>`;
  let buffer = "";
  const stream = createReadStream(path).pipe(createGunzip());
  stream.setEncoding("utf8");
  for await (const chunk of stream as AsyncIterable<string>) {
    buffer += chunk;
    let start = 0;
    let end = buffer.indexOf(closing);
    while (end !== -1) {
      yield buffer.slice(start, end + closing.length);
      start = end + closing.length;
      end = buffer.indexOf(closing, start);
    }
    buffer = buffer.slice(start);
  }
}

export function releaseTitle(xml: string): string | undefined {
  const start = xml.indexOf("<title>");
  if (start === -1) return undefined;
  return decodeXml(xml.slice(start + 7, xml.indexOf("</title>", start)));
}

export function parseRelease(xml: string): DiscogsRelease {
  return detached(parseReleaseXml(xml));
}

export function parseMaster(xml: string): DiscogsMaster {
  return detached(parseMasterXml(xml));
}

export function releaseCredit(xml: string): Credit {
  return parseCredit(xml);
}

function detached<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseReleaseXml(xml: string): DiscogsRelease {
  const master = /<master_id is_main_release="(true|false)">(\d+)<\/master_id>/.exec(xml);
  const tracklist = between(xml, "<tracklist>", "</tracklist>") ?? "";
  const tracks = tracklist.match(/<track><position>[^<]+<\/position>/g)?.length;
  return {
    id: Number(/<release id="(\d+)"/.exec(xml)![1]),
    masterId: master ? Number(master[2]) : undefined,
    isMainRelease: master?.[1] === "true",
    title: releaseTitle(xml) ?? "",
    credit: parseCredit(xml),
    formats: [...xml.matchAll(/<description>([^<]+)<\/description>/g)].map((match) =>
      decodeXml(match[1]!).toLowerCase(),
    ),
    year: validYear(/<released>(\d{4})/.exec(xml)?.[1]),
    trackCount: tracks || undefined,
  };
}

function parseMasterXml(xml: string): DiscogsMaster {
  return {
    id: Number(/<master id="(\d+)"/.exec(xml)![1]),
    mainRelease: Number(/<main_release>(\d+)<\/main_release>/.exec(xml)?.[1]),
    title: releaseTitle(xml) ?? "",
    credit: parseCredit(xml),
    year: validYear(/<year>(\d{4})<\/year>/.exec(xml)?.[1]),
  };
}

export function pickDiscogsAlbum(
  releases: DiscogsRelease[],
  masters: Map<number, DiscogsMaster>,
  artist: string,
  title: string,
  reviewedYear: number,
): AlbumInput | undefined {
  const reviewNames = nameKeys(artist);
  const groups = groupReleases(releases, masters).filter(
    (group) => creditMatches(group.credit, reviewNames) && isAlbumFormat(group.formats),
  );
  const review = titleVariants(title);
  if (reviewNames.includes(review.key.replace(/^the /, ""))) {
    const sameTitle = groups.filter((group) => titleVariants(group.title).key === review.key);
    if (sameTitle.length !== 1) return undefined;
  }
  const group = pickCandidate(
    groups.map((item) => ({ item, title: item.title, year: item.year })),
    title,
    reviewNames,
    reviewedYear,
    {},
  );
  if (!group) return undefined;
  return {
    discogsMasterId: group.masterId,
    discogsReleaseId: group.masterId ? undefined : group.releaseId,
    artistCredit: group.credit.joined,
    title: group.title,
    kind:
      group.formats.some((format) => EP_FORMATS.has(format)) &&
      !group.formats.includes("album") &&
      !group.formats.includes("lp")
        ? "ep"
        : "album",
    year: group.year,
    trackCount: group.trackCount,
  };
}

function groupReleases(
  releases: DiscogsRelease[],
  masters: Map<number, DiscogsMaster>,
): DiscogsGroup[] {
  const byKey = new Map<string, DiscogsRelease[]>();
  for (const release of releases) {
    const key = release.masterId ? `m${release.masterId}` : `r${release.id}`;
    byKey.set(key, [...(byKey.get(key) ?? []), release]);
  }
  return [...byKey.values()].map((group) => {
    const master = group[0]!.masterId ? masters.get(group[0]!.masterId) : undefined;
    const main =
      group.find((release) => release.id === master?.mainRelease) ??
      group.find((release) => release.isMainRelease);
    const years = group.map((release) => release.year).filter((year) => year !== undefined);
    return {
      masterId: master?.id,
      releaseId: master ? undefined : group[0]!.id,
      title: master?.title ?? group[0]!.title,
      credit: master?.credit ?? group[0]!.credit,
      year: master?.year ?? (years.length ? Math.min(...years) : undefined),
      formats: (main ?? group[0]!).formats,
      trackCount: (main ?? group[0]!).trackCount,
    };
  });
}

function isAlbumFormat(formats: string[]): boolean {
  return (
    formats.some((format) => ALBUM_FORMATS.has(format)) &&
    !formats.some((format) => NOT_ALBUM_FORMATS.has(format))
  );
}

function parseCredit(xml: string): Credit {
  const artists = between(xml, "<artists>", "</artists>") ?? "";
  const entries = [...artists.matchAll(/<artist>(.*?)<\/artist>/gs)].map((match) => {
    const name = cleanName(tag(match[1]!, "name") ?? "");
    return {
      name: cleanName(tag(match[1]!, "anv") ?? "") || name,
      artistName: name,
      join: tag(match[1]!, "join") ?? "",
    };
  });
  return {
    joined: entries
      .map((entry, index) =>
        index < entries.length - 1 ? `${entry.name}${joinPhrase(entry.join)}` : entry.name,
      )
      .join(""),
    names: entries.map((entry) => entry.name),
    artistNames: entries.map((entry) => entry.artistName),
  };
}

function joinPhrase(join: string): string {
  return !join || join === "," ? ", " : ` ${join} `;
}

function cleanName(name: string): string {
  return name.replace(/\s+\(\d+\)$/, "").trim();
}

function tag(xml: string, name: string): string | undefined {
  const match = new RegExp(`<${name}>(.*?)</${name}>`, "s").exec(xml);
  return match ? decodeXml(match[1]!) : undefined;
}

function between(xml: string, open: string, close: string): string | undefined {
  const start = xml.indexOf(open);
  if (start === -1) return undefined;
  return xml.slice(start + open.length, xml.indexOf(close, start));
}

function validYear(text: string | undefined): number | undefined {
  const year = Number(text);
  return year >= 1900 ? year : undefined;
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
