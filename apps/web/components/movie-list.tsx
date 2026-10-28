import Link from "next/link";
import type { MovieSummary } from "@arscritica/db";
import { reviewCountLabel } from "@/lib/format";
import { Poster } from "./poster";
import { ScoreBadge } from "./score-badge";

export function MovieList({ movies }: { movies: MovieSummary[] }) {
  return (
    <ul className="list">
      {movies.map((movie) => (
        <li key={movie.slug} className="list-item">
          <ScoreBadge score={movie.score} />
          <Poster path={movie.posterPath} title={movie.title} />
          <div className="item-body">
            <Link href={`/film/${movie.slug}/`} className="item-title">
              {movie.title}
            </Link>
            <div className="muted">
              {[movie.year, reviewCountLabel(movie.reviewCount)].filter(Boolean).join(" · ")}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
