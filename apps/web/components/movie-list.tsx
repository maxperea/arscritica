import Link from "next/link";
import type { MovieSummary } from "@arscritica/db";
import { reviewCountLabel } from "@/lib/format";
import { ranks } from "@/lib/top-list";
import { Poster } from "./poster";
import { ScoreBadge } from "./score-badge";

export function MovieList({
  movies,
  ranked = false,
}: {
  movies: MovieSummary[];
  ranked?: boolean;
}) {
  const movieRanks = ranked ? ranks(movies) : [];
  return (
    <ul className="list">
      {movies.map((movie, index) => (
        <li key={movie.slug} className="list-item">
          {ranked && <span className="rank">{movieRanks[index]}</span>}
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
