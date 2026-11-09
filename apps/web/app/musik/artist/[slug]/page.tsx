import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { artistSlugs, getArtist } from "@arscritica/db";
import { AlbumList } from "@/components/album-list";
import { getDb } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
import { slugParams } from "@/lib/static-params";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return slugParams(artistSlugs(getDb()));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artist = getArtist(getDb(), slug);
  if (!artist) return { title: "Artisten hittades inte" };
  return pageMetadata({
    title: `${artist.name} – skivrecensioner och betyg`,
    description: `Betyg från svenska musikkritiker för skivor av ${artist.name}.`,
    path: `/musik/artist/${slug}/`,
  });
}

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params;
  const artist = getArtist(getDb(), slug);
  if (!artist) notFound();

  return (
    <>
      <h1>{artist.name}</h1>
      <AlbumList albums={artist.albums} />
    </>
  );
}
