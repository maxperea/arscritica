import Link from "next/link";
import type { MovieSummary } from "@arscritica/db";
import { reviewCountLabel } from "@/lib/format";
import { Poster } from "./poster";
import { ScoreBadge } from "./score-badge";

export function MovieList({ movies }: { movies: MovieSummary[] }) {
  return (
    <ul className="list movie-list">
      {movies.map((movie) => (
        <li key={movie.slug}>
          <MovieLink movie={movie} />
        </li>
      ))}
    </ul>
  );
}

export function MovieLink({ movie, label }: { movie: MovieSummary; label?: string }) {
  return (
    <Link href={`/film/${movie.slug}/`} className="movie-link">
      <Poster path={movie.posterPath} title={movie.title} decorative />
      <span className="item-body">
        <span className="item-title">{movie.title}</span>
        <span className="item-meta muted">
          {[label, movie.year, reviewCountLabel(movie.reviewCount)].filter(Boolean).join(" · ")}
        </span>
      </span>
      <ScoreBadge score={movie.score} />
    </Link>
  );
}
