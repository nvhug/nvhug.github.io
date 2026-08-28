import { describe, expect, it } from 'vitest'
import {
  formatDayShort,
  formatPercent,
  formatTokens,
  formatUserIdentity,
  formatVnd,
  isLowerBound,
  share,
} from './format'
import { actorScopeOf, EMPTY_SUMMARY, sameScope, totalTokens } from './types'

describe('formatTokens', () => {
  it('keeps small counts exact', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(9_999)).toBe('9,999')
  })

  it('abbreviates above the threshold', () => {
    expect(formatTokens(10_000)).toBe('10K')
    expect(formatTokens(412_500)).toBe('413K')
    expect(formatTokens(2_400_000)).toBe('2.4M')
  })
})

describe('formatVnd', () => {
  it('uses Vietnamese thousands separators', () => {
    // The point of this function: "." must not mean "decimal point" on the same tile where
    // it means "thousands separator".
    expect(formatVnd(13.0241)).toMatch(/^338\.\d{3} ₫$/)
  })

  it('renders a sub-dong cost as zero, which is why VND is aggregate-only', () => {
    expect(formatVnd(0.0000021)).toBe('0 ₫')
  })
})

describe('formatUserIdentity', () => {
  it('joins both halves when both exist', () => {
    expect(formatUserIdentity('Trọng Nghĩa Nguyễn', 'nvhug001@gmail.com')).toBe(
      'Trọng Nghĩa Nguyễn - nvhug001@gmail.com'
    )
  })

  it('falls back to whichever half is present, with no dangling separator', () => {
    expect(formatUserIdentity('Trọng Nghĩa Nguyễn', null)).toBe('Trọng Nghĩa Nguyễn')
    expect(formatUserIdentity(null, 'nvhug001@gmail.com')).toBe('nvhug001@gmail.com')
    expect(formatUserIdentity('  ', 'nvhug001@gmail.com')).toBe('nvhug001@gmail.com')
  })

  it('is empty when the profile carries neither, so the caller can show its unknown label', () => {
    expect(formatUserIdentity(null, null)).toBe('')
  })
})

describe('isLowerBound', () => {
  it('is true whenever any call in the set went unpriced', () => {
    expect(isLowerBound(0)).toBe(false)
    expect(isLowerBound(1)).toBe(true)
  })
})

describe('share', () => {
  it('divides safely on an empty period', () => {
    // The empty-period case is a valid answer, not an error, so this must not be NaN.
    expect(share(0, 0)).toBe(0)
    expect(Number.isNaN(share(5, 0))).toBe(false)
  })

  it('computes a fraction', () => {
    expect(share(25, 100)).toBe(0.25)
  })
})

describe('formatPercent', () => {
  it('adds a decimal only where a whole number would round to zero', () => {
    expect(formatPercent(0.25)).toBe('25%')
    expect(formatPercent(0.004)).toBe('0.4%')
  })
})

describe('formatDayShort', () => {
  it('strips leading zeros for a dense axis', () => {
    expect(formatDayShort('2026-08-06')).toBe('6/8')
    expect(formatDayShort('2026-12-26')).toBe('26/12')
  })
})

describe('actorScopeOf — three kinds, never two', () => {
  // user_id alone cannot express this: null means "deleted account" for a user actor and
  // "scheduled job" for the system, and those must never share a row or a label.
  it('reads a live account', () => {
    expect(actorScopeOf({ user_id: 'u1', actor: 'user' })).toEqual({ kind: 'user', userId: 'u1' })
  })

  it('reads a deleted account', () => {
    expect(actorScopeOf({ user_id: null, actor: 'user' })).toEqual({ kind: 'deleted' })
  })

  it('reads the system actor, even though its user_id is also null', () => {
    expect(actorScopeOf({ user_id: null, actor: 'system' })).toEqual({ kind: 'system' })
  })

  it('never confuses the deleted group with the system actor', () => {
    const deleted = actorScopeOf({ user_id: null, actor: 'user' })
    const system = actorScopeOf({ user_id: null, actor: 'system' })
    expect(sameScope(deleted, system)).toBe(false)
  })

  it('distinguishes two live accounts', () => {
    expect(sameScope({ kind: 'user', userId: 'a' }, { kind: 'user', userId: 'b' })).toBe(false)
    expect(sameScope({ kind: 'user', userId: 'a' }, { kind: 'user', userId: 'a' })).toBe(true)
  })
})

describe('totalTokens', () => {
  it('is input plus output, and nothing else', () => {
    // Cached and reasoning are subsets. Adding either would overstate every cached call.
    expect(totalTokens({ input_tokens: 100, output_tokens: 40 })).toBe(140)
  })
})

describe('EMPTY_SUMMARY', () => {
  it('is all zeros with empty lists, so an empty period needs no null checks', () => {
    expect(EMPTY_SUMMARY.calls).toBe(0)
    expect(EMPTY_SUMMARY.unpriced_models).toEqual([])
    expect(isLowerBound(EMPTY_SUMMARY.unpriced_calls)).toBe(false)
  })
})
