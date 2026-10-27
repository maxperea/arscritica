import { posterUrl } from "@/lib/format";

export function Poster({
  path,
  title,
  large = false,
}: {
  path: string | null;
  title: string;
  large?: boolean;
}) {
  const className = `poster${large ? " poster-large" : ""}`;
  if (!path) return <div className={className} aria-hidden="true" />;
  return (
    <img
      className={className}
      src={posterUrl(path, large ? "w342" : "w92")}
      alt={`Affisch för ${title}`}
      loading="lazy"
    />
  );
}
