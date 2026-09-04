import { describe, expect, it } from 'vitest'
import { RATE_LIMITS, isOverLimit, windowStart } from './rate-limit'

describe('RATE_LIMITS', () => {
  it('matches FR-100', () => {
    expect(RATE_LIMITS).toEqual({ messagesPerMinute: 8, conversationsPerHour: 6 })
  })
})

describe('windowStart', () => {
  it('subtracts the window size from now', () => {
    const now = new Date('2026-09-10T12:00:00.000Z')
    expect(windowStart(now, 60_000)).toEqual(new Date('2026-09-10T11:59:00.000Z'))
  })

  it('returns now itself for a zero-length window', () => {
    const now = new Date('2026-09-10T12:00:00.000Z')
    expect(windowStart(now, 0)).toEqual(now)
  })
})

describe('isOverLimit — boundary at exactly the limit', () => {
  it('is not over the limit one below it', () => {
    expect(isOverLimit(29, 30)).toBe(false)
  })

  it('is over the limit at exactly the limit', () => {
    expect(isOverLimit(30, 30)).toBe(true)
  })

  it('is over the limit one above it', () => {
    expect(isOverLimit(31, 30)).toBe(true)
  })

  it('is not over the limit at zero recent actions', () => {
    expect(isOverLimit(0, 30)).toBe(false)
  })

  it('applies the same boundary rule to the conversations-per-hour limit', () => {
    expect(isOverLimit(5, RATE_LIMITS.conversationsPerHour)).toBe(false)
    expect(isOverLimit(6, RATE_LIMITS.conversationsPerHour)).toBe(true)
    expect(isOverLimit(7, RATE_LIMITS.conversationsPerHour)).toBe(true)
  })
})

describe('the per-minute cap versus the daily AI fuse', () => {
  // claim_support_ai allows 40 AI calls a day. At the old 30/min a user could
  // burn all of them in about two minutes, and exhausting the fuse escalates to
  // a human (FR-041) — so the brake protecting the operator produced work for
  // them instead.
  const DAILY_AI_FUSE = 40

  it('cannot let the daily fuse be spent in under five minutes', () => {
    const minutes = DAILY_AI_FUSE / RATE_LIMITS.messagesPerMinute
    expect(minutes).toBeGreaterThanOrEqual(5)
  })

  it('still allows a fast human conversation', () => {
    // A real exchange waits seconds for each reply; four or five a minute is
    // already quick. The cap must sit above that, not on it.
    expect(RATE_LIMITS.messagesPerMinute).toBeGreaterThanOrEqual(6)
  })
})
