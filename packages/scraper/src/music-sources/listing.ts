export async function fetchListingPage(
  fetchText: (url: string) => Promise<string>,
  url: string,
  page: number,
): Promise<string | undefined> {
  try {
    return await fetchText(url);
  } catch (error) {
    if (page > 1 && /\bHTTP 404\b/.test(String(error))) return undefined;
    throw error;
  }
}
