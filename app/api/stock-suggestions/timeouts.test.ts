import { describe, expect, it } from 'vitest'
import { SUGGESTIONS_FALLBACK_TIMEOUT_MS, SUGGESTIONS_MAX_TOKENS } from './route'
import { MEASURED_TOKENS_PER_SECOND } from '@/lib/horoscope-interpretation'

// Pure-logic check only — no Supabase/HTTP mocking, so it doesn't need the route.test.ts
// this route deliberately doesn't have (see 3-tasks.md T012).
describe('DeepSeek fallback timeout budget', () => {
  it('waits longer than a genuinely long response takes to produce', () => {
    const worstCaseMs = (SUGGESTIONS_MAX_TOKENS / MEASURED_TOKENS_PER_SECOND) * 1000
    expect(SUGGESTIONS_FALLBACK_TIMEOUT_MS).toBeGreaterThan(worstCaseMs)
  })
})
