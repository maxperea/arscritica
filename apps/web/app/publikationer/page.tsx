import type { Metadata } from "next";
import Link from "next/link";
import { listPublications } from "@arscritica/db";
import { ScoreBadge } from "@/components/score-badge";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "Publikationer" };

export default function PublicationsPage() {
  const publications = listPublications(getDb());

  return (
    <>
      <h1>Publikationer</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Publikation</th>
            <th>Recensioner</th>
            <th>Snittbetyg</th>
          </tr>
        </thead>
        <tbody>
          {publications.map((publication) => (
            <tr key={publication.slug}>
              <td>
                <Link href={`/publikationer/${publication.slug}/`} className="item-title">
                  {publication.name}
                </Link>
              </td>
              <td>{publication.reviewCount}</td>
              <td>
                <ScoreBadge score={publication.averageScore} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
