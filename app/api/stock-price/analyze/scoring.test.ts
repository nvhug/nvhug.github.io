import { describe, expect, it } from 'vitest'
import { gradeFromOverallScore, overallScoreFromScores } from './scoring'

describe('analysis scoring', () => {
  it('averages only evidence-backed scores and ignores unavailable criteria', () => {
    expect(overallScoreFromScores({ liquidity: 7, valuation: 6, assetQuality: 8 })).toBe(7)
  })

  it('returns no overall score without any evidence-backed criterion', () => {
    expect(overallScoreFromScores({ assetQuality: null })).toBeNull()
  })

  it('maps the recomputed score to a deterministic grade', () => {
    expect(gradeFromOverallScore(4.8)).toBe('D')
    expect(gradeFromOverallScore(7)).toBe('B')
  })
})