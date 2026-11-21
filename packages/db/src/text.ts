export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(text: string): string {
  return normalizeTitle(text).replaceAll(" ", "-");
}

export function coverThumbnailKey(url: string): string | undefined {
  const match =
    /^https:\/\/coverartarchive\.org\/(release-group|release)\/([0-9a-f-]{36})\/(front|\d+)(?:-\d+)?(?:\.jpg)?$/.exec(
      url,
    );
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}
