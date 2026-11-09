import { setTimeout as sleep } from "node:timers/promises";
import type { AlbumKind } from "@arscritica/db";
import { normalizeTitle } from "@arscritica/db/text";

export const MUSICBRAINZ_USER_AGENT =
  "ArsCriticaBot/0.1 ( https://github.com/maxperea/arscritica )";

const API = "https://musicbrainz.org/ws/2";
const COVER_ART = "https://coverartarchive.org";
const ALLOWED_SECONDARY_TYPES = new Set(["Soundtrack", "Mixtape/Street"]);
const MAX_YEARS_BEFORE_REVIEW = 2;
const MAX_ATTEMPTS = 4;

export interface MusicBrainzAlbum {
  mbid: string;
  title: string;
  artistCredit: string;
  artist?: { mbid: string; name: string };
  kind: AlbumKind;
  year: number;
  trackCount?: number;
  coverUrl?: string;
  coverThumbnailUrl?: string;
}

export interface AlbumLookup {
  findAlbum(
    artist: string,
    title: string,
    reviewedYear?: number,
  ): Promise<MusicBrainzAlbum | undefined>;
}

interface ArtistCredit {
  name: string;
  joinphrase?: string;
  artist: { id: string; name: string };
}

interface ReleaseGroup {
  id: string;
  title: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
  "first-release-date"?: string;
  "artist-credit"?: ArtistCredit[];
}

interface Release {
  status?: string;
  date?: string;
  media?: { "track-count"?: number }[];
}

interface CoverArtImage {
  front?: boolean;
  image?: string;
  thumbnails?: Record<string, string | undefined>;
}

export interface MusicBrainzClientOptions {
  minDelayMs?: number;
  userAgent?: string;
}

export class MusicBrainzClient implements AlbumLookup {
  private readonly minDelayMs: number;
  private readonly userAgent: string;
  private readonly nextRequestAtByHost = new Map<string, number>();

  constructor(options: MusicBrainzClientOptions = {}) {
    this.minDelayMs = options.minDelayMs ?? 1100;
    this.userAgent = options.userAgent ?? MUSICBRAINZ_USER_AGENT;
  }

  async findAlbum(
    artist: string,
    title: string,
    reviewedYear?: number,
  ): Promise<MusicBrainzAlbum | undefined> {
    const query =
      `releasegroup:"${escapeQuery(title)}" AND ` +
      `(artist:"${escapeQuery(artist)}" OR artistname:"${escapeQuery(artist)}") AND ` +
      "(primarytype:album OR primarytype:ep)";
    const search = await this.json<{ "release-groups"?: ReleaseGroup[] }>(
      `${API}/release-group/?query=${encodeURIComponent(query)}&limit=25&fmt=json`,
    );
    const group = pickReleaseGroup(search?.["release-groups"] ?? [], artist, title, reviewedYear);
    if (!group) return undefined;

    const credits = group["artist-credit"] ?? [];
    const [trackCount, cover] = [await this.trackCount(group.id), await this.cover(group.id)];
    return {
      mbid: group.id,
      title: group.title,
      artistCredit: creditName(credits),
      artist: credits[0] ? { mbid: credits[0].artist.id, name: credits[0].artist.name } : undefined,
      kind: group["primary-type"] === "EP" ? "ep" : "album",
      year: releaseYear(group)!,
      trackCount,
      coverUrl: cover?.large,
      coverThumbnailUrl: cover?.small,
    };
  }

  private async trackCount(releaseGroupId: string): Promise<number | undefined> {
    const result = await this.json<{ releases?: Release[] }>(
      `${API}/release?release-group=${releaseGroupId}&inc=media&limit=100&fmt=json`,
    );
    const official = (result?.releases ?? [])
      .filter((release) => release.status === "Official" && release.date)
      .sort((a, b) => a.date!.localeCompare(b.date!));
    const tracks = official[0]?.media?.reduce(
      (sum, medium) => sum + (medium["track-count"] ?? 0),
      0,
    );
    return tracks || undefined;
  }

  private async cover(
    releaseGroupId: string,
  ): Promise<{ large?: string; small?: string } | undefined> {
    const result = await this.json<{ images?: CoverArtImage[] }>(
      `${COVER_ART}/release-group/${releaseGroupId}`,
    );
    const front = result?.images?.find((image) => image.front);
    if (!front) return undefined;
    const thumbnails = front.thumbnails ?? {};
    return {
      large: https(thumbnails["500"] ?? thumbnails.large ?? front.image),
      small: https(thumbnails["250"] ?? thumbnails.small ?? thumbnails["500"] ?? front.image),
    };
  }

  private async json<T>(url: string): Promise<T | undefined> {
    for (let attempt = 1; ; attempt++) {
      await this.waitForTurn(new URL(url).host);
      const response = await fetch(url, {
        headers: { "user-agent": this.userAgent, accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 404) return undefined;
      if (response.ok) return (await response.json()) as T;
      if (attempt >= MAX_ATTEMPTS || ![429, 500, 502, 503].includes(response.status)) {
        throw new Error(`MusicBrainz request failed: HTTP ${response.status} for ${url}`);
      }
      await sleep(this.minDelayMs * 2 ** attempt);
    }
  }

  private async waitForTurn(host: string): Promise<void> {
    const now = Date.now();
    const startAt = Math.max(now, this.nextRequestAtByHost.get(host) ?? 0);
    this.nextRequestAtByHost.set(host, startAt + this.minDelayMs);
    if (startAt > now) await sleep(startAt - now);
  }
}

export function pickReleaseGroup(
  groups: ReleaseGroup[],
  artist: string,
  title: string,
  reviewedYear?: number,
): ReleaseGroup | undefined {
  const titleKey = normalizeTitle(title);
  const artistKey = artistMatchKey(artist);
  const candidates = groups.filter((group) => {
    const year = releaseYear(group);
    return (
      (group["primary-type"] === "Album" || group["primary-type"] === "EP") &&
      (group["secondary-types"] ?? []).every((type) => ALLOWED_SECONDARY_TYPES.has(type)) &&
      normalizeTitle(group.title) === titleKey &&
      creditMatches(group["artist-credit"] ?? [], artistKey) &&
      year !== undefined &&
      (reviewedYear === undefined ||
        (year <= reviewedYear && year >= reviewedYear - MAX_YEARS_BEFORE_REVIEW))
    );
  });
  const latestYear = Math.max(...candidates.map((group) => releaseYear(group)!));
  const latest = candidates.filter((group) => releaseYear(group) === latestYear);
  return latest.length === 1 ? latest[0] : undefined;
}

function creditMatches(credits: ArtistCredit[], artistKey: string): boolean {
  if (!credits.length) return false;
  const keys = [
    creditName(credits),
    credits.map((credit) => credit.name).join(" "),
    ...credits.map((credit) => credit.name),
    ...credits.map((credit) => credit.artist.name),
  ].map(artistMatchKey);
  return keys.includes(artistKey);
}

function artistMatchKey(name: string): string {
  return normalizeTitle(name.replace(/\s+(&|och|and|x|feat\.?|med)\s+/gi, " ")).replace(
    /^the /,
    "",
  );
}

function creditName(credits: ArtistCredit[]): string {
  return credits.map((credit) => `${credit.name}${credit.joinphrase ?? ""}`).join("");
}

function releaseYear(group: ReleaseGroup): number | undefined {
  const year = Number(group["first-release-date"]?.slice(0, 4));
  return year > 0 ? year : undefined;
}

function escapeQuery(text: string): string {
  return text.replace(/["\\]/g, "\\$&");
}

function https(url: string | undefined): string | undefined {
  return url?.replace(/^http:/, "https:");
}
