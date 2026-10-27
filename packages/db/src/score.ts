export function normalizeScore(rawScore: number, scaleMax: number): number {
  const ratio = Math.min(Math.max(rawScore / scaleMax, 0), 1);
  return Math.round(ratio * 100);
}
