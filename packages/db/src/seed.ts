import { rmSync } from "node:fs";
import { openDatabase } from "./database";
import { defaultDbPath } from "./paths";
import { slugify } from "./text";
import { insertAlbum, insertAlbumReview, upsertMusicPublication } from "./music-writes";
import { insertMovie, insertReview, upsertPublication } from "./writes";

const publications = [
  { slug: "aftonbladet", name: "Aftonbladet", url: "https://www.aftonbladet.se/nojesbladet/film" },
  { slug: "moviezine", name: "Moviezine", url: "https://www.moviezine.se" },
  { slug: "filmtopp", name: "Filmtopp", url: "https://www.filmtopp.se" },
];

const critics: Record<string, string> = {
  aftonbladet: "Anna Exempel",
  moviezine: "Erik Exempel",
  filmtopp: "Sara Exempel",
};

const movies: {
  title: string;
  year: number;
  publishedOn: string;
  scores: Record<string, number>;
}[] = [
  {
    title: "Sommarnatt",
    year: 2026,
    publishedOn: "2026-10-23",
    scores: { aftonbladet: 4, moviezine: 5, filmtopp: 4 },
  },
  {
    title: "Vinterljus",
    year: 2026,
    publishedOn: "2026-10-16",
    scores: { aftonbladet: 3, moviezine: 4, filmtopp: 3 },
  },
  {
    title: "Hamnen",
    year: 2026,
    publishedOn: "2026-10-09",
    scores: { aftonbladet: 2, moviezine: 2, filmtopp: 3 },
  },
  {
    title: "Den sista färjan",
    year: 2026,
    publishedOn: "2026-10-02",
    scores: { aftonbladet: 5, moviezine: 4 },
  },
  {
    title: "Midsommarbrand",
    year: 2026,
    publishedOn: "2026-09-25",
    scores: { moviezine: 1, filmtopp: 2 },
  },
  {
    title: "Stockholm i regn",
    year: 2026,
    publishedOn: "2026-09-18",
    scores: { aftonbladet: 3, moviezine: 3, filmtopp: 4 },
  },
  { title: "Kometen", year: 2026, publishedOn: "2026-09-11", scores: { aftonbladet: 4 } },
  {
    title: "Fjällvandring",
    year: 2025,
    publishedOn: "2026-08-28",
    scores: { aftonbladet: 2, filmtopp: 1 },
  },
];

const albums: {
  artist: string;
  title: string;
  year: number;
  publishedOn: string;
  scores: Record<string, number>;
}[] = [
  {
    artist: "Fyrskeppet",
    title: "Kustljus",
    year: 2026,
    publishedOn: "2026-10-20",
    scores: { aftonbladet: 4, moviezine: 4 },
  },
  {
    artist: "Elsa Exempel",
    title: "Nattåg",
    year: 2026,
    publishedOn: "2026-10-12",
    scores: { aftonbladet: 3, filmtopp: 2 },
  },
  {
    artist: "Bandet",
    title: "Bandet",
    year: 2026,
    publishedOn: "2026-10-05",
    scores: { moviezine: 5 },
  },
];

const file = defaultDbPath();
rmSync(file, { force: true });
const db = openDatabase({ path: file });

const publicationIds = new Map(publications.map((p) => [p.slug, upsertPublication(db, p)]));

for (const movie of movies) {
  const movieId = insertMovie(db, { title: movie.title, year: movie.year });
  for (const [slug, rawScore] of Object.entries(movie.scores)) {
    insertReview(db, {
      movieId,
      publicationId: publicationIds.get(slug)!,
      url: `https://example.com/exempel/${slug}/${slugify(movie.title)}`,
      sourceTitle: movie.title,
      sourceYear: movie.year,
      rawScore,
      scaleMax: 5,
      critic: critics[slug],
      publishedAt: `${movie.publishedOn}T08:00:00.000Z`,
    });
  }
}

const musicPublicationIds = new Map(
  publications.map((p) => [p.slug, upsertMusicPublication(db, p)]),
);

for (const [index, album] of albums.entries()) {
  const albumId = insertAlbum(db, {
    mbid: `00000000-0000-0000-0000-00000000000${index}`,
    artist: { mbid: `00000000-0000-0000-0000-10000000000${index}`, name: album.artist },
    artistCredit: album.artist,
    title: album.title,
    kind: "album",
    year: album.year,
  });
  for (const [slug, rawScore] of Object.entries(album.scores)) {
    insertAlbumReview(db, {
      albumId,
      publicationId: musicPublicationIds.get(slug)!,
      url: `https://example.com/exempel/${slug}/musik/${slugify(album.title)}`,
      sourceArtist: album.artist,
      sourceTitle: album.title,
      rawScore,
      scaleMax: 5,
      critic: critics[slug],
      publishedAt: `${album.publishedOn}T08:00:00.000Z`,
    });
  }
}

db.close();
console.log(`Seeded fictional sample data into ${file}`);
