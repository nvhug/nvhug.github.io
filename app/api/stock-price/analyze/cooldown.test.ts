import { describe, expect, it } from 'vitest'
import { ANALYSIS_COOLDOWN_MS, cooldownMetadata } from './cooldown'

const analyzedAt = '2026-08-01T00:00:00.000Z'
const analyzedAtMs = new Date(analyzedAt).getTime()

describe('cooldownMetadata', () => {
  it('locks analysis until 30 full days have elapsed', () => {
    const result = cooldownMetadata(analyzedAt, analyzedAtMs + ANALYSIS_COOLDOWN_MS - 1)

    expect(result.canAnalyze).toBe(false)
    expect(result.nextAnalyzeAt).toBe('2026-08-31T00:00:00.000Z')
  })

  it('allows analysis at the 30-day boundary', () => {
    expect(cooldownMetadata(analyzedAt, analyzedAtMs + ANALYSIS_COOLDOWN_MS).canAnalyze).toBe(true)
  })

  it('bypasses the cooldown for admins', () => {
    expect(cooldownMetadata(analyzedAt, analyzedAtMs + 1, true)).toEqual({
      analyzedAt,
      nextAnalyzeAt: null,
      canAnalyze: true,
    })
  })
})
