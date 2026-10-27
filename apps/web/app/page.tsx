import { bestMoviesRightNow, recentlyReviewedMovies } from "@arscritica/db";
import { MovieList } from "@/components/movie-list";
import { getDb } from "@/lib/db";

export default function HomePage() {
  const db = getDb();
  const best = bestMoviesRightNow(db);
  const recent = recentlyReviewedMovies(db);

  return (
    <div className="home">
      <section>
        <h2>Bäst just nu</h2>
        {best.length ? (
          <MovieList movies={best} />
        ) : (
          <p className="muted">Inga filmer med tillräckligt många recensioner ännu.</p>
        )}
      </section>
      <section>
        <h2>Senast recenserade</h2>
        {recent.length ? (
          <MovieList movies={recent} />
        ) : (
          <p className="muted">Inga recensioner ännu.</p>
        )}
      </section>
    </div>
  );
}
