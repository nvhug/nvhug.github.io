import { describe, expect, it } from 'vitest'
import { MODEL_FILTER_OPTIONS, escapeIlikeTerm, intersectLogDateBounds, isFullySelected, modelFilterPattern } from './filters'
import { MODEL_PRICES, KNOWN_UNPRICED } from '@/lib/ai-pricing'

describe('isFullySelected', () => {
  it('is false for an empty page — there is nothing to call "fully selected"', () => {
    expect(isFullySelected([], new Set(['a']))).toBe(false)
  })

  it('is false when only some of the page ids are selected', () => {
    expect(isFullySelected(['a', 'b'], new Set(['a']))).toBe(false)
  })

  it('is true only when every id on the page is selected', () => {
    expect(isFullySelected(['a', 'b'], new Set(['a', 'b']))).toBe(true)
  })

  it('is false for a same-size selection that is not the same rows (a stale selection from elsewhere)', () => {
    expect(isFullySelected(['a', 'b'], new Set(['x', 'y']))).toBe(false)
  })
})

describe('escapeIlikeTerm', () => {
  it('escapes a literal underscore, common in emails, so it is not read as "any one character"', () => {
    expect(escapeIlikeTerm('jane_doe')).toBe('jane\\_doe')
  })

  it('escapes a literal percent sign so it is not read as "any run of characters"', () => {
    expect(escapeIlikeTerm('100%mine')).toBe('100\\%mine')
  })

  it('escapes a literal backslash so a user-typed escape cannot itself alter the pattern', () => {
    expect(escapeIlikeTerm('back\\slash')).toBe('back\\\\slash')
  })

  it('leaves an ordinary search term unchanged', () => {
    expect(escapeIlikeTerm('jane doe')).toBe('jane doe')
  })
})

describe('MODEL_FILTER_OPTIONS', () => {
  it('lists every model this app can serve, priced or not, with no duplicates', () => {
    const expected = new Set([...Object.keys(MODEL_PRICES), ...KNOWN_UNPRICED])

    expect(new Set(MODEL_FILTER_OPTIONS)).toEqual(expected)
    expect(MODEL_FILTER_OPTIONS.length).toBe(expected.size)
  })

  it('is sorted, so the chip row renders in a stable order', () => {
    expect(MODEL_FILTER_OPTIONS).toEqual([...MODEL_FILTER_OPTIONS].sort())
  })
})

describe('modelFilterPattern', () => {
  // ai_usage_log.model stores whatever the provider's response reported (servedModel()
  // in ai-usage.ts), which for Gemini can carry a point-release suffix the price table's
  // key does not have — resolvePriceKey already strips it when pricing a call, and this
  // filter must recognize the same served ids or the model chip silently misses real rows.
  function matches(canonical: string, served: string): boolean {
    return new RegExp(modelFilterPattern(canonical)).test(served)
  }

  it('matches the served id exactly when the provider adds no suffix', () => {
    expect(matches('deepseek-v4-flash', 'deepseek-v4-flash')).toBe(true)
  })

  it('matches a served id carrying a recognized point-release suffix', () => {
    expect(matches('gemini-3.6-flash', 'gemini-3.6-flash-002')).toBe(true)
  })

  it('does not match a sibling model that merely shares a name prefix', () => {
    // deepseek-v4-flash-vision-exp is a DIFFERENT, separately-priced model — a prefix
    // match here would silently fold two distinct chip options into one filter result.
    expect(matches('deepseek-v4-flash', 'deepseek-v4-flash-vision-exp')).toBe(false)
  })

  it('does not match an unrelated model', () => {
    expect(matches('gemini-3.6-flash', 'gemini-3.7-flash')).toBe(false)
  })
})

describe('intersectLogDateBounds', () => {
  const period = { from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T00:00:00.000Z' }

  it('returns the period bounds unchanged when no explicit range is set', () => {
    expect(intersectLogDateBounds(period, { dateFrom: null, dateTo: null })).toEqual(period)
  })

  it('narrows the lower bound to the start of the given VN calendar day when it is later than the period start', () => {
    const result = intersectLogDateBounds(period, { dateFrom: '2026-08-15', dateTo: null })

    // 2026-08-15 00:00 +07:00 == 2026-08-14 17:00 UTC
    expect(result.from).toBe('2026-08-14T17:00:00.000Z')
    expect(result.to).toBe(period.to)
  })

  it('narrows the upper bound to the start of the day AFTER the given VN calendar day (exclusive) when it is earlier than the period end', () => {
    const result = intersectLogDateBounds(period, { dateFrom: null, dateTo: '2026-08-15' })

    // exclusive upper bound: 2026-08-16 00:00 +07:00 == 2026-08-15 17:00 UTC
    expect(result.to).toBe('2026-08-15T17:00:00.000Z')
    expect(result.from).toBe(period.from)
  })

  it('applies both bounds together (AND semantics)', () => {
    const result = intersectLogDateBounds(period, { dateFrom: '2026-08-10', dateTo: '2026-08-15' })

    expect(result.from).toBe('2026-08-09T17:00:00.000Z')
    expect(result.to).toBe('2026-08-15T17:00:00.000Z')
  })

  it('never widens past the period bounds, even if the explicit range is broader', () => {
    const result = intersectLogDateBounds(period, { dateFrom: '2026-01-01', dateTo: '2026-12-31' })

    expect(result).toEqual(period)
  })

  it('normalizes an inverted range (From picked after To) instead of silently returning zero rows', () => {
    const forward = intersectLogDateBounds(period, { dateFrom: '2026-08-10', dateTo: '2026-08-15' })
    const inverted = intersectLogDateBounds(period, { dateFrom: '2026-08-15', dateTo: '2026-08-10' })

    expect(inverted).toEqual(forward)
  })

  it('never returns from > to, even when a valid explicit day falls entirely outside a since-narrowed period', () => {
    // A dateTo chosen while viewing a wide period, kept after the period narrows to
    // something more recent that no longer overlaps that day at all.
    const narrowedPeriod = { from: '2026-08-28T00:00:00.000Z', to: '2026-08-31T00:00:00.000Z' }

    const result = intersectLogDateBounds(narrowedPeriod, { dateFrom: null, dateTo: '2026-08-15' })

    expect(new Date(result.from).getTime()).toBeLessThanOrEqual(new Date(result.to).getTime())
  })
})
