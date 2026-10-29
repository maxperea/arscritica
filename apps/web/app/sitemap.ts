import type { MetadataRoute } from "next";
import { getPublication, publicationSlugs, searchIndex } from "@arscritica/db";
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
  return [
    { url: absoluteUrl("/"), lastModified: latest || undefined },
    { url: absoluteUrl("/topplistor/"), lastModified: latest || undefined },
    { url: absoluteUrl("/publikationer/"), lastModified: latest || undefined },
    ...publications,
    ...movies.map((movie) => ({
      url: absoluteUrl(`/film/${movie.slug}/`),
      lastModified: movie.latestReviewAt,
    })),
  ];
}
