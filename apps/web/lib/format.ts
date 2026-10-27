const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const numberFormat = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

export function formatDate(iso: string | null): string {
  return iso ? dateFormat.format(new Date(iso)) : "";
}

export function formatRawScore(rawScore: number, scaleMax: number): string {
  return `${numberFormat.format(rawScore)}/${numberFormat.format(scaleMax)}`;
}

export function posterUrl(posterPath: string, size: "w92" | "w342"): string {
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

export function reviewCountLabel(count: number): string {
  return count === 1 ? "1 recension" : `${count} recensioner`;
}

export const weightedScoreExplanation =
  "Snittet vägt mot hela sajtens snitt, så att filmer med få recensioner inte rankas för högt";

export function weightedScoreLabel(rankScore: number): string {
  return `viktat ${Math.round(rankScore)}`;
}
