export function ScoreBadge({ score, large = false }: { score: number | null; large?: boolean }) {
  const tone = score === null ? "none" : score >= 75 ? "high" : score >= 50 ? "mid" : "low";
  return (
    <span
      className={`score score-${tone}${large ? " score-large" : ""}`}
      role="img"
      aria-label={score === null ? "Inget betyg" : `Betyg ${score}`}
    >
      {score ?? "–"}
    </span>
  );
}
