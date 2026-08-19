export type ScoreSet = Record<string, number | null>

export function overallScoreFromScores(scores: ScoreSet): number | null {
  const available = Object.values(scores).filter((score): score is number => score != null)
  if (available.length === 0) return null

  return Number((available.reduce((total, score) => total + score, 0) / available.length).toFixed(1))
}

export function gradeFromOverallScore(score: number | null): 'A' | 'B' | 'C' | 'D' {
  if (score == null || score < 5) return 'D'
  if (score < 6.5) return 'C'
  if (score < 8) return 'B'
  return 'A'
}