import type { Metadata } from "next";
import { Search } from "./search";

export const metadata: Metadata = { title: "Sök" };

export default function SearchPage() {
  return (
    <>
      <h1 className="visually-hidden">Sök film</h1>
      <Search />
    </>
  );
}
