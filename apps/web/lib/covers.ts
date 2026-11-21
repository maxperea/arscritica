import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { coverThumbnailKey } from "@arscritica/db/text";

const coversDir = path.join(process.cwd(), "public", "covers");
let localThumbnails: Set<string> | undefined;

export function withListCovers<T extends { coverThumbnailUrl: string | null }>(albums: T[]): T[] {
  localThumbnails ??= new Set(existsSync(coversDir) ? readdirSync(coversDir) : []);
  return albums.map((album) => {
    const key = album.coverThumbnailUrl && coverThumbnailKey(album.coverThumbnailUrl);
    const file = key ? `${key}.webp` : undefined;
    if (!file || !localThumbnails!.has(file)) return album;
    return {
      ...album,
      coverThumbnailUrl: `${process.env.ARSCRITICA_BASE_PATH ?? ""}/covers/${file}`,
    };
  });
}
