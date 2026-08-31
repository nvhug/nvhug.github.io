import { describe, expect, it } from 'vitest'
import { ANALYZE_FALLBACK_TIMEOUT_MS, ANALYZE_MAX_TOKENS, ANALYZE_SECTION_KEYS } from './route'
import { stockAnalysisSchema } from './schema'
import { MEASURED_TOKENS_PER_SECOND } from '@/lib/horoscope-interpretation'

// Pure-logic check only — no Supabase/HTTP mocking, so it doesn't need the route.test.ts
// this route deliberately doesn't have (see 3-tasks.md T011).
describe('DeepSeek fallback timeout budget', () => {
  it('waits longer than a genuinely long analysis takes to produce', () => {
    const worstCaseMs = (ANALYZE_MAX_TOKENS / MEASURED_TOKENS_PER_SECOND) * 1000
    expect(ANALYZE_FALLBACK_TIMEOUT_MS).toBeGreaterThan(worstCaseMs)
  })
})

// The progress bar the reader watches counts top-level keys of the completion as they
// close, against ANALYZE_SECTION_KEYS as the denominator. The schema is the contract for
// what that completion contains, so the two must not drift: a field added to the schema
// (and the prompt) but not to the list leaves the bar permanently short of full.
describe('streamed progress denominator', () => {
  // Attached by applyEvidence from Vietcap/Vietstock after the completion arrives — the
  // model is never asked for them, so they are not sections it can finish writing.
  const SERVER_SUPPLIED = ['fundamentals', 'governanceDisclosures']

  it('lists exactly the keys the model is asked to write', () => {
    const modelWritten = Object.keys(stockAnalysisSchema.shape)
      .filter(key => !SERVER_SUPPLIED.includes(key))

    expect([...ANALYZE_SECTION_KEYS].sort()).toEqual(modelWritten.sort())
  })

  it('counts every one of them, so the bar can reach full', () => {
    expect(new Set(ANALYZE_SECTION_KEYS).size).toBe(ANALYZE_SECTION_KEYS.length)
  })
})
