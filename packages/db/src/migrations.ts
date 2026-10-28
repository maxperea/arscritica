export const migrations: string[] = [
  `
  CREATE TABLE publications (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    url TEXT NOT NULL
  );

  CREATE TABLE movies (
    id INTEGER PRIMARY KEY,
    tmdb_id INTEGER UNIQUE,
    title TEXT NOT NULL,
    original_title TEXT,
    year INTEGER,
    poster_path TEXT,
    slug TEXT NOT NULL UNIQUE,
    title_key TEXT NOT NULL,
    original_title_key TEXT
  );

  CREATE INDEX movies_title_key ON movies (title_key);
  CREATE INDEX movies_original_title_key ON movies (original_title_key);

  CREATE TABLE reviews (
    id INTEGER PRIMARY KEY,
    movie_id INTEGER NOT NULL REFERENCES movies (id),
    publication_id INTEGER NOT NULL REFERENCES publications (id),
    url TEXT NOT NULL UNIQUE,
    source_title TEXT NOT NULL,
    source_year INTEGER,
    raw_score REAL NOT NULL,
    scale_max REAL NOT NULL CHECK (scale_max > 0),
    normalized_score INTEGER NOT NULL CHECK (normalized_score BETWEEN 0 AND 100),
    critic TEXT,
    published_at TEXT,
    scraped_at TEXT NOT NULL
  );

  CREATE INDEX reviews_movie_id ON reviews (movie_id);
  CREATE INDEX reviews_publication_id ON reviews (publication_id);
  `,
  `
  CREATE TABLE movie_genres (
    movie_id INTEGER NOT NULL REFERENCES movies (id),
    name TEXT NOT NULL,
    PRIMARY KEY (movie_id, name)
  );
  `,
  `
  ALTER TABLE publications ADD COLUMN paywalled INTEGER NOT NULL DEFAULT 0;
  `,
  `
  ALTER TABLE movies ADD COLUMN imdb_id TEXT;
  `,
  `
  ALTER TABLE movies ADD COLUMN overview TEXT;
  `,
  `
  ALTER TABLE movies ADD COLUMN overview_en TEXT;
  `,
  `
  ALTER TABLE movies ADD COLUMN watch_providers_checked_at TEXT;
  CREATE TABLE movie_watch_providers (
    movie_id INTEGER NOT NULL REFERENCES movies (id),
    kind TEXT NOT NULL,
    provider_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    logo_path TEXT,
    display_priority INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (movie_id, kind, provider_id)
  );
  `,
  `
  ALTER TABLE movies ADD COLUMN watchmode_id INTEGER;
  ALTER TABLE movies ADD COLUMN watchmode_checked_at TEXT;
  ALTER TABLE movies ADD COLUMN watchmode_signature TEXT;
  CREATE TABLE movie_watch_offers (
    movie_id INTEGER NOT NULL REFERENCES movies (id),
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    price REAL,
    PRIMARY KEY (movie_id, kind, name)
  );
  `,
  `
  UPDATE movies
  SET year = (SELECT MIN(CAST(strftime('%Y', published_at) AS INTEGER)) FROM reviews WHERE movie_id = movies.id)
  WHERE year > (SELECT MIN(CAST(strftime('%Y', published_at) AS INTEGER)) FROM reviews WHERE movie_id = movies.id);
  UPDATE movies
  SET slug = substr(slug, 1, length(slug) - 4) || year
  WHERE slug GLOB '*-[0-9][0-9][0-9][0-9]'
    AND substr(slug, -4) <> CAST(year AS TEXT)
    AND NOT EXISTS (SELECT 1 FROM movies other WHERE other.slug = substr(movies.slug, 1, length(movies.slug) - 4) || movies.year);
  `,
];
