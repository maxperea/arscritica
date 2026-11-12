import { setTimeout as sleep } from "node:timers/promises";
import type { AlbumKind } from "@arscritica/db";
import {
  cleanArtist,
  creditMatches,
  NAME_JOINER,
  nameKeys,
  pickCandidate,
  titleTier,
  titleVariants,
  type Credit,
} from "./album-match";

export const MUSICBRAINZ_USER_AGENT =
  "ArsCriticaBot/0.1 ( https://github.com/maxperea/arscritica )";

const API = "https://musicbrainz.org/ws/2";
const COVER_ART = "https://coverartarchive.org";
const ALLOWED_SECONDARY_TYPES = new Set(["Soundtrack", "Mixtape/Street"]);
const MAX_ATTEMPTS = 4;

export interface MusicBrainzAlbum {
  mbid: string;
  title: string;
  artistCredit: string;
  artist?: { mbid: string; name: string };
  kind: AlbumKind;
  year?: number;
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
    const name = cleanArtist(artist);
    const types = "(primarytype:album OR primarytype:ep)";
    const byTitle = await this.searchReleaseGroups(
      `releasegroup:"${escapeQuery(title)}" AND ` +
        `(artist:"${escapeQuery(name)}" OR artistname:"${escapeQuery(name)}") AND ${types}`,
      25,
    );
    let group = pickReleaseGroup(byTitle, artist, title, reviewedYear);
    if (!group) {
      const leadArtist = name.split(NAME_JOINER)[0]!;
      const byArtist = await this.searchReleaseGroups(
        `(artist:"${escapeQuery(leadArtist)}" OR artistname:"${escapeQuery(leadArtist)}") AND ${types}`,
        100,
      );
      group = pickReleaseGroup(
        uniqueGroups([...byTitle, ...byArtist]),
        artist,
        title,
        reviewedYear,
      );
    }
    if (!group) return undefined;

    const credits = group["artist-credit"] ?? [];
    const [trackCount, cover] = await Promise.all([
      this.trackCount(group.id).catch(() => undefined),
      this.hasCover(group.id).catch(() => false),
    ]);
    const coverUrl = `${COVER_ART}/release-group/${group.id}/front`;
    return {
      mbid: group.id,
      title: group.title,
      artistCredit: creditName(credits),
      artist: credits[0] ? { mbid: credits[0].artist.id, name: credits[0].artist.name } : undefined,
      kind: group["primary-type"] === "EP" ? "ep" : "album",
      year: releaseYear(group),
      trackCount,
      coverUrl: cover ? `${coverUrl}-500` : undefined,
      coverThumbnailUrl: cover ? `${coverUrl}-250` : undefined,
    };
  }

  async isLiveOrCompilation(artist: string, title: string): Promise<boolean> {
    const name = cleanArtist(artist);
    const groups = await this.searchReleaseGroups(
      `releasegroup:"${escapeQuery(title)}" AND ` +
        `(artist:"${escapeQuery(name)}" OR artistname:"${escapeQuery(name)}")`,
      25,
    );
    const reviewNames = nameKeys(artist);
    const review = titleVariants(title);
    return groups.some(
      (group) =>
        (group["secondary-types"] ?? []).some((type) => !ALLOWED_SECONDARY_TYPES.has(type)) &&
        titleTier(group.title, review, reviewNames) <= 1 &&
        creditMatches(creditOf(group["artist-credit"] ?? []), reviewNames),
    );
  }

  private async searchReleaseGroups(query: string, limit: number): Promise<ReleaseGroup[]> {
    const search = await this.json<{ "release-groups"?: ReleaseGroup[] }>(
      `${API}/release-group/?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`,
    );
    return search?.["release-groups"] ?? [];
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

  private async hasCover(releaseGroupId: string): Promise<boolean> {
    await this.waitForTurn(new URL(COVER_ART).host);
    const response = await fetch(`${COVER_ART}/release-group/${releaseGroupId}/front`, {
      method: "HEAD",
      redirect: "manual",
      headers: { "user-agent": this.userAgent },
      signal: AbortSignal.timeout(20_000),
    });
    return response.status >= 300 && response.status < 400;
  }

  private async json<T>(url: string): Promise<T | undefined> {
    for (let attempt = 1; ; attempt++) {
      await this.waitForTurn(new URL(url).host);
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { "user-agent": this.userAgent, accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        });
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS) throw error;
        await sleep(this.minDelayMs * 2 ** attempt);
        continue;
      }
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
  const reviewNames = nameKeys(artist);
  const albums = groups.filter(
    (group) =>
      isAlbumGroup(group) && creditMatches(creditOf(group["artist-credit"] ?? []), reviewNames),
  );
  return pickCandidate(
    albums.map((group) => ({ item: group, title: group.title, year: releaseYear(group) })),
    title,
    reviewNames,
    reviewedYear,
  );
}

function isAlbumGroup(group: ReleaseGroup): boolean {
  return (
    (group["primary-type"] === "Album" || group["primary-type"] === "EP") &&
    (group["secondary-types"] ?? []).every((type) => ALLOWED_SECONDARY_TYPES.has(type))
  );
}

function uniqueGroups(groups: ReleaseGroup[]): ReleaseGroup[] {
  return [...new Map(groups.map((group) => [group.id, group])).values()];
}

function creditOf(credits: ArtistCredit[]): Credit {
  return {
    joined: creditName(credits),
    names: credits.map((credit) => credit.name),
    artistNames: credits.map((credit) => credit.artist.name),
  };
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
