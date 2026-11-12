import { normalizeTitle } from "@arscritica/db/text";

const MAX_YEARS_BEFORE_REVIEW = 2;

export interface Candidate<T> {
  item: T;
  title: string;
  year?: number;
}

export interface PickOptions {
  fuzzy?: boolean;
  older?: boolean;
  undated?: boolean;
}

export function pickCandidate<T>(
  candidates: Candidate<T>[],
  title: string,
  reviewNames: string[],
  reviewedYear?: number,
  options: PickOptions = { fuzzy: true, older: true, undated: true },
): T | undefined {
  const review = titleVariants(title);
  const tiers = [0, 1, 2].map((tier) =>
    candidates.filter(
      (candidate) =>
        titleTier(candidate.title, review, reviewNames) === tier && (tier < 2 || options.fuzzy),
    ),
  );
  const [exact, loose, fuzzy] = tiers as [Candidate<T>[], Candidate<T>[], Candidate<T>[]];
  if (reviewedYear === undefined) return earliest(exact.filter((candidate) => candidate.year));

  const inWindow = ({ year }: Candidate<T>) =>
    year !== undefined && year <= reviewedYear && year >= reviewedYear - MAX_YEARS_BEFORE_REVIEW;
  const yearAfter = ({ year }: Candidate<T>) => year === reviewedYear + 1;
  const older = ({ year }: Candidate<T>) =>
    (year ?? Infinity) < reviewedYear - MAX_YEARS_BEFORE_REVIEW;
  const undated = exact.every((candidate) => candidate.year === undefined) ? exact : [];
  return (
    earliest(exact.filter(inWindow)) ??
    earliest(loose.filter(inWindow)) ??
    earliest(fuzzy.filter(inWindow)) ??
    earliest(exact.filter(yearAfter)) ??
    earliest(loose.filter(yearAfter)) ??
    (options.undated && undated.length === 1 ? undated[0]!.item : undefined) ??
    (options.older && isDistinctiveTitle(review.key, reviewNames)
      ? earliest(exact.filter(older))
      : undefined)
  );
}

function earliest<T>(candidates: Candidate<T>[]): T | undefined {
  if (!candidates.length) return undefined;
  const year = Math.min(...candidates.map((candidate) => candidate.year ?? Infinity));
  const first = candidates.filter((candidate) => (candidate.year ?? Infinity) === year);
  return first.length === 1 ? first[0]!.item : undefined;
}

interface TitleVariants {
  key: string;
  loose: Set<string>;
  main?: string;
}

export function titleVariants(title: string): TitleVariants {
  const key = matchKey(title);
  const bare = matchKey(title.replace(/\([^)]*\)|\[[^\]]*\]/g, " ")).replace(/ (ep|e p)$/, "");
  const forms = [key, bare, ...[key, bare].map((form) => form.replace(/^the /, ""))];
  const main = title.split(/:|\s[–-]\s/)[0]!;
  return {
    key,
    loose: new Set([...forms, ...forms.map(compact)].filter(Boolean)),
    main: main.length < title.length ? matchKey(main) || undefined : undefined,
  };
}

export function titleTier(candidate: string, review: TitleVariants, artistNames: string[]): number {
  const found = titleVariants(candidate);
  if (found.key === review.key) return 0;
  if (numerals(found.key) !== numerals(review.key)) return 3;
  if ([...found.loose].some((form) => review.loose.has(form))) return 1;
  if (found.main && review.loose.has(found.main)) return 1;
  const prefixed = [...artistNames, ...artistNames.map((name) => name.split(" ").at(-1)!)];
  if (prefixed.some((name) => found.key === `${name} ${review.key}`)) return 1;
  const shortest = Math.min(found.key.length, review.key.length);
  if (shortest >= 10 && editDistance(found.key, review.key) <= 2) return 2;
  return 3;
}

export function isSelfTitled(titleKey: string, artistNames: string[]): boolean {
  const bare = (key: string) => compact(key.replace(/\b(the|and|och|x|med|with|feat)\b/g, ""));
  return [...artistNames, artistNames.join(" ")].some((name) => bare(name) === bare(titleKey));
}

const GENERIC_TITLE =
  /^(untitled|s t|self titled|the album)$|\b(symphon(y|ies)|sonatas?|concertos?|variations|quartets?|complete|works)\b/;

export function isDistinctiveTitle(titleKey: string, artistNames: string[]): boolean {
  return (
    !isSelfTitled(titleKey, artistNames) &&
    !GENERIC_TITLE.test(titleKey) &&
    titleKey.replace(/\b(\d+|[ivx]+)\b/g, "").replace(/ /g, "").length >= 4
  );
}

function numerals(key: string): string {
  return key
    .split(" ")
    .filter((word) => /^(\d+|ii|iii|iv|vi|vii|viii|ix)$/.test(word))
    .join(" ");
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length]!;
}

export interface Credit {
  joined: string;
  names: string[];
  artistNames: string[];
}

export function creditMatches(credit: Credit, reviewNames: string[]): boolean {
  if (!credit.names.length) return false;
  const whole = [credit.joined, credit.names.join(" "), ...credit.names, ...credit.artistNames].map(
    artistKey,
  );
  const reviewKey = reviewNames.join(" ");
  if (whole.includes(reviewKey) || whole.map(compact).includes(compact(reviewKey))) return true;
  return [nameKeys(credit.joined), credit.artistNames.map(artistKey)].some((creditNames) =>
    namesOverlap(reviewNames, creditNames),
  );
}

function namesOverlap(review: string[], credit: string[]): boolean {
  if (!review.length || !credit.length || review[0] !== credit[0]) {
    return review.length > 1 && sameSet(review, credit);
  }
  const [shorter, longer] = review.length <= credit.length ? [review, credit] : [credit, review];
  return shorter.every((name) => longer.includes(name));
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name) => b.includes(name));
}

export const NAME_JOINER =
  /\s*(?:&|\+|\/|,|\s(?:x|och|and|med|with|meets|feat\.?|featuring|ft\.)\s)\s*/i;

export function nameKeys(artist: string): string[] {
  return cleanArtist(artist).split(NAME_JOINER).map(artistKey).filter(Boolean);
}

export function cleanArtist(artist: string): string {
  return artist.replace(/^[\s:–-]+|[\s:–-]+$/g, "");
}

function artistKey(name: string): string {
  return matchKey(name.replace(/\s+(&|\+|och|and|x|feat\.?|med|with)\s+/gi, " ")).replace(
    /^the /,
    "",
  );
}

export function matchKey(text: string): string {
  return normalizeTitle(
    text
      .replace(/[’'`´‘]/g, "")
      .replace(/æ/gi, "ae")
      .replace(/ø/gi, "o")
      .replace(/[đð]/gi, "d")
      .replace(/þ/gi, "th")
      .replace(/ß/g, "ss")
      .replace(/ł/gi, "l")
      .replace(/œ/gi, "oe")
      .replace(/\s*[&+]\s*/g, " and "),
  );
}

function compact(key: string): string {
  return key.replace(/ /g, "");
}
