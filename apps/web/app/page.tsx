import { bestMoviesRightNow, recentlyReviewedMovies } from "@arscritica/db";
import Link from "next/link";
import { MovieList } from "@/components/movie-list";
import { getDb } from "@/lib/db";

export default function HomePage() {
  const db = getDb();
  const best = bestMoviesRightNow(db);
  const recent = recentlyReviewedMovies(db);

  return (
    <>
      <h1 className="visually-hidden">Vox Critica</h1>
      <div className="home">
        <section>
          <div className="home-heading">
            <h2>Bäst just nu</h2>
            <a href="#senast" className="jump-recent">
              Senast recenserade ↓
            </a>
          </div>
          {best.length ? (
            <MovieList movies={best} />
          ) : (
            <p className="muted">Inga filmer med tillräckligt många recensioner ännu.</p>
          )}
          <Link href="/topplistor/" className="section-link">
            Utforska topplistor →
          </Link>
        </section>
        <section id="senast" tabIndex={-1}>
          <h2>Senast recenserade</h2>
          {recent.length ? (
            <MovieList movies={recent} />
          ) : (
            <p className="muted">Inga recensioner ännu.</p>
          )}
        </section>
      </div>
    </>
  );
}
