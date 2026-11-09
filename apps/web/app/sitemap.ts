import type { MetadataRoute } from "next";
import {
  albumSearchIndex,
  getArtist,
  getMusicPublication,
  getPublication,
  artistSlugs,
  musicPublicationSlugs,
  publicationSlugs,
  searchIndex,
} from "@arscritica/db";
import { getDb } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const db = getDb();
  const movies = searchIndex(db);
  const latest = movies.reduce(
    (max, movie) => (movie.latestReviewAt > max ? movie.latestReviewAt : max),
    "",
  );
  const publications = publicationSlugs(db).map((slug) => ({
    url: absoluteUrl(`/publikationer/${slug}/`),
    lastModified: getPublication(db, slug)?.reviews[0]?.publishedAt ?? undefined,
  }));
  const albums = albumSearchIndex(db);
  const latestAlbum = albums.reduce(
    (max, album) => (album.latestReviewAt > max ? album.latestReviewAt : max),
    "",
  );
  const musicPublications = musicPublicationSlugs(db).map((slug) => ({
    url: absoluteUrl(`/musik/publikationer/${slug}/`),
    lastModified: getMusicPublication(db, slug)?.reviews[0]?.publishedAt ?? undefined,
  }));
  const artists = artistSlugs(db).map((slug) => ({
    url: absoluteUrl(`/musik/artist/${slug}/`),
    lastModified: getArtist(db, slug)?.albums.reduce(
      (max, album) => (album.latestReviewAt > max ? album.latestReviewAt : max),
      "",
    ),
  }));
  return [
    { url: absoluteUrl("/"), lastModified: latest || undefined },
    { url: absoluteUrl("/topplistor/"), lastModified: latest || undefined },
    { url: absoluteUrl("/publikationer/"), lastModified: latest || undefined },
    ...publications,
    ...movies.map((movie) => ({
      url: absoluteUrl(`/film/${movie.slug}/`),
      lastModified: movie.latestReviewAt,
    })),
    { url: absoluteUrl("/musik/"), lastModified: latestAlbum || undefined },
    { url: absoluteUrl("/musik/topplistor/"), lastModified: latestAlbum || undefined },
    { url: absoluteUrl("/musik/publikationer/"), lastModified: latestAlbum || undefined },
    ...musicPublications,
    ...artists,
    ...albums.map((album) => ({
      url: absoluteUrl(`/musik/album/${album.slug}/`),
      lastModified: album.latestReviewAt,
    })),
  ];
}
