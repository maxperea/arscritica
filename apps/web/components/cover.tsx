export function Cover({
  url,
  title,
  large = false,
  decorative = false,
}: {
  url: string | null;
  title: string;
  large?: boolean;
  decorative?: boolean;
}) {
  const className = `poster cover${large ? " poster-large" : ""}`;
  if (!url) return <div className={className} aria-hidden="true" />;
  const size = large ? 176 : 44;
  return (
    <img
      className={className}
      src={url}
      alt={decorative ? "" : `Omslag till ${title}`}
      width={size}
      height={size}
      loading={large ? "eager" : "lazy"}
    />
  );
}
