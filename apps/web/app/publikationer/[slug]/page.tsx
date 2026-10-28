import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublication, publicationSlugs } from "@arscritica/db";
import { PaywallIcon } from "@/components/paywall-icon";
import { getDb } from "@/lib/db";
import { formatDate, formatRawScore, reviewCountLabel } from "@/lib/format";
import { slugParams } from "@/lib/static-params";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return slugParams(publicationSlugs(getDb()));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: getPublication(getDb(), slug)?.name ?? "Publikationen hittades inte" };
}

export default async function PublicationPage({ params }: Props) {
  const { slug } = await params;
  const publication = getPublication(getDb(), slug);
  if (!publication) notFound();

  return (
    <>
      <h1>{publication.name}</h1>
      <p className="muted">
        {reviewCountLabel(publication.reviewCount)} ·{" "}
        <a href={publication.url} target="_blank" rel="noopener noreferrer">
          Till {publication.name} ↗
        </a>
      </p>
      <ul className="list publication-reviews">
        {publication.reviews.map((review) => (
          <li key={review.url} className="review-item">
            <div className="item-body">
              <Link href={`/film/${review.movieSlug}/`} className="item-title">
                {review.movieTitle}
              </Link>
              <div className="muted">
                {[review.movieYear, review.critic, formatDate(review.publishedAt)]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <span className="review-score">{formatRawScore(review.rawScore, review.scaleMax)}</span>
            <a
              href={review.url}
              className="external-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {publication.paywalled && <PaywallIcon />}
              Läs recensionen ↗
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
