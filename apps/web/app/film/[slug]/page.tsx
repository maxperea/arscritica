import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMovie, movieSlugs } from "@arscritica/db";
import { Poster } from "@/components/poster";
import { PaywallIcon } from "@/components/paywall-icon";
import { ScoreBadge } from "@/components/score-badge";
import { WatchProviders } from "@/components/watch-providers";
import { getDb } from "@/lib/db";
import { formatDate, formatRawScore, reviewCountLabel } from "@/lib/format";
import { slugParams } from "@/lib/static-params";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return slugParams(movieSlugs(getDb()));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: getMovie(getDb(), slug)?.title ?? "Filmen hittades inte" };
}

export default async function MoviePage({ params }: Props) {
  const { slug } = await params;
  const movie = getMovie(getDb(), slug);
  if (!movie) notFound();
  const showOriginalTitle = movie.originalTitle && movie.originalTitle !== movie.title;
  const about = (
    <>
      {movie.overview ? <p className="overview">{movie.overview}</p> : null}
      {movie.imdbId ? (
        <p>
          <a
            href={`https://www.imdb.com/title/${movie.imdbId}/`}
            className="quiet-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            IMDb ↗
          </a>
        </p>
      ) : null}
    </>
  );

  return (
    <article>
      <header className={`movie-header${movie.posterPath ? "" : " no-poster"}`}>
        {movie.posterPath ? <Poster path={movie.posterPath} title={movie.title} large /> : null}
        <div className="movie-heading">
          <h1>{movie.title}</h1>
          {movie.year ? <p className="muted movie-year">{movie.year}</p> : null}
          {showOriginalTitle ? <p className="muted">Originaltitel: {movie.originalTitle}</p> : null}
        </div>
        <div className="aggregate">
          <ScoreBadge score={movie.score} large />
          <div>
            <strong>{movie.reviewCount === 1 ? "Kritikerbetyg" : "Kritikersnitt"}</strong>
            <div className="muted">{reviewCountLabel(movie.reviewCount)}</div>
          </div>
        </div>
        {movie.overview || movie.imdbId ? (
          <>
            <div className="movie-about desktop-about">{about}</div>
            <details className="movie-about mobile-about">
              <summary>Om filmen{movie.imdbId ? " och IMDb" : ""}</summary>
              {about}
            </details>
          </>
        ) : null}
      </header>

      <WatchProviders providers={movie.watchProviders} title={movie.title} />
      <h2>Recensioner</h2>
      <ul className="list review-list">
        {movie.reviews.map((review) => (
          <li key={review.url} className="review-item">
            <div className="item-body">
              <a href={review.url} className="item-title" target="_blank" rel="noopener noreferrer">
                {review.publicationPaywalled && <PaywallIcon />}
                {review.publicationName} ↗
              </a>
              <div className="muted">
                {[review.critic, formatDate(review.publishedAt)].filter(Boolean).join(" · ")}
                <span className="review-publication">
                  {review.critic || review.publishedAt ? (
                    <span className="review-divider"> · </span>
                  ) : null}
                  <Link href={`/publikationer/${review.publicationSlug}/`} className="quiet-link">
                    Alla från {review.publicationName}
                  </Link>
                </span>
              </div>
            </div>
            <div className="review-rating">
              <ScoreBadge score={review.normalizedScore} />
              <span className="muted">{formatRawScore(review.rawScore, review.scaleMax)}</span>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
