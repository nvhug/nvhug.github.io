export const ANALYSIS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

export function cooldownMetadata(analyzedAt: string, now = Date.now()) {
  const nextAnalyzeAt = new Date(new Date(analyzedAt).getTime() + ANALYSIS_COOLDOWN_MS).toISOString()
  return {
    analyzedAt,
    nextAnalyzeAt,
    canAnalyze: now >= new Date(nextAnalyzeAt).getTime(),
  }
}
