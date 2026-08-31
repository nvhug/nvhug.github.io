import { describe, expect, it } from 'vitest'
import {
  SUGGESTIONS_FALLBACK_TIMEOUT_MS,
  SUGGESTIONS_MAX_TOKENS,
  SUGGESTIONS_NON_AI_RESERVE_MS,
  SUGGESTIONS_PRIMARY_TIMEOUT_MS,
  maxDuration,
} from './route'
import { MEASURED_TOKENS_PER_SECOND } from '@/lib/horoscope-interpretation'

// Pure-logic check only — no Supabase/HTTP mocking, so it doesn't need the route.test.ts
// this route deliberately doesn't have (see 3-tasks.md T012).
describe('DeepSeek fallback timeout budget', () => {
  it('waits longer than a genuinely long response takes to produce', () => {
    const worstCaseMs = (SUGGESTIONS_MAX_TOKENS / MEASURED_TOKENS_PER_SECOND) * 1000
    expect(SUGGESTIONS_FALLBACK_TIMEOUT_MS).toBeGreaterThan(worstCaseMs)
  })
})

// The three constants are one budget, and until now only half of it was checked: raising
// the ceiling pushes the fallback up, the fallback plus the primary has to stay inside
// maxDuration, and the request also spends time outside both attempts. Nothing enforced
// the second half — it lived in a comment that said the fetch loop was "NOT accounted
// for". A ceiling raised without re-splitting the timeouts is exactly what this catches.
describe('the whole request fits inside maxDuration', () => {
  it('leaves room for both attempts and the work outside them', () => {
    const worstCaseMs =
      SUGGESTIONS_PRIMARY_TIMEOUT_MS + SUGGESTIONS_FALLBACK_TIMEOUT_MS + SUGGESTIONS_NON_AI_RESERVE_MS

    expect(worstCaseMs).toBeLessThan(maxDuration * 1000)
  })

  it('reserves something for the fetch loop and the cache insert', () => {
    // Measured at 1.4s for 50 tickers; the reserve is an allowance over that, not a guess.
    expect(SUGGESTIONS_NON_AI_RESERVE_MS).toBeGreaterThanOrEqual(1_400)
  })
})
