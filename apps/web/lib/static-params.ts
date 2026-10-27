const placeholderSlug = "-";

export function slugParams(slugs: string[]): { slug: string }[] {
  return (slugs.length ? slugs : [placeholderSlug]).map((slug) => ({ slug }));
}
