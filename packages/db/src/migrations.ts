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
];
