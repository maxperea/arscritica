import type { ListContext } from "../source";

const PAGE_SIZE = 100;

interface WordPressPost {
  date: string;
  link: string;
}

export async function listWordPressPostLinks(
  postsUrl: string,
  { since, fetchText }: ListContext,
): Promise<string[]> {
  const links: string[] = [];
  let before: string | undefined;
  for (;;) {
    const url = new URL(postsUrl);
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "desc");
    url.searchParams.set("_fields", "date,link");
    if (since) url.searchParams.set("after", since.toISOString());
    if (before) url.searchParams.set("before", before);

    const posts = JSON.parse(await fetchText(url.href)) as WordPressPost[];
    links.push(...posts.map((post) => post.link));
    const oldest = posts.at(-1);
    if (!oldest || posts.length < PAGE_SIZE) return links;
    before = oldest.date;
  }
}
