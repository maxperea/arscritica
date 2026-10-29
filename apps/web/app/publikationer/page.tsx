import type { Metadata } from "next";
import Link from "next/link";
import { listPublications } from "@arscritica/db";
import { getDb } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Publikationer – svenska filmkritiker",
  description:
    "Svenska publikationer vars filmrecensioner samlas på Vox Critica, med antal recensioner och snittbetyg.",
  path: "/publikationer/",
});

export default function PublicationsPage() {
  const publications = listPublications(getDb());

  return (
    <>
      <h1 className="visually-hidden">Publikationer</h1>
      <div className="table-scroll" role="region" aria-label="Publikationer" tabIndex={0}>
        <table className="table publication-table">
          <thead>
            <tr>
              <th scope="col">Publikation</th>
              <th scope="col">Recensioner</th>
              <th scope="col">Snittbetyg</th>
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
                <td className="publication-average">{publication.averageScore ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
