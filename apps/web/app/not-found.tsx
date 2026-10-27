import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Sidan hittades inte</h1>
      <p>
        <Link href="/">Till startsidan</Link>
      </p>
    </>
  );
}
