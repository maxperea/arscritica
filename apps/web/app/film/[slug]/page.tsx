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

  return (
    <article>
      <header className="movie-header">
        <Poster path={movie.posterPath} title={movie.title} large />
        <div className="movie-heading">
          <h1>
            {movie.title}
            {movie.year ? <span className="muted"> ({movie.year})</span> : null}
          </h1>
          {showOriginalTitle ? <p className="muted">Originaltitel: {movie.originalTitle}</p> : null}
          <div className="aggregate">
            <ScoreBadge score={movie.score} large />
            <span className="muted">Snitt av {reviewCountLabel(movie.reviewCount)}</span>
          </div>
        </div>
        <div className="movie-about">
          {movie.overview ? <p className="overview">{movie.overview}</p> : null}
          <WatchProviders
            providers={movie.watchProviders}
            title={movie.title}
            tmdbId={movie.tmdbId}
          />
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
        </div>
      </header>

      <h2>Recensioner</h2>
      <ul className="list">
        {movie.reviews.map((review) => (
          <li key={review.url} className="list-item">
            <ScoreBadge score={review.normalizedScore} />
            <div className="item-body">
              <a href={review.url} className="item-title" target="_blank" rel="noopener noreferrer">
                {review.publicationPaywalled && <PaywallIcon />}
                {review.publicationName} ↗
              </a>
              <div className="muted">
                {[
                  formatRawScore(review.rawScore, review.scaleMax),
                  review.critic,
                  formatDate(review.publishedAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {" · "}
                <Link href={`/publikationer/${review.publicationSlug}/`} className="quiet-link">
                  Alla från {review.publicationName}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
