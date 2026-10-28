import { posterUrl } from "@/lib/format";

export function Poster({
  path,
  title,
  large = false,
  decorative = false,
}: {
  path: string | null;
  title: string;
  large?: boolean;
  decorative?: boolean;
}) {
  const className = `poster${large ? " poster-large" : ""}`;
  if (!path) return <div className={className} aria-hidden="true" />;
  return (
    <img
      className={className}
      src={posterUrl(path, large ? "w342" : "w92")}
      alt={decorative ? "" : `Affisch för ${title}`}
      width={large ? 176 : 44}
      height={large ? 264 : 66}
      loading={large ? "eager" : "lazy"}
    />
  );
}
