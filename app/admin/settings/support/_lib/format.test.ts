import { describe, expect, it } from 'vitest'
import { formatDurationMs, formatPercent, relativeTimeFrom } from './format'

describe('relativeTimeFrom', () => {
  const now = new Date('2026-09-03T12:00:00.000Z')

  it('returns justNow for anything under a minute', () => {
    expect(relativeTimeFrom('2026-09-03T11:59:30.000Z', now)).toEqual({ unit: 'justNow', count: 0 })
  })

  it('clamps a future timestamp (clock skew) to justNow rather than a negative count', () => {
    expect(relativeTimeFrom('2026-09-03T12:05:00.000Z', now)).toEqual({ unit: 'justNow', count: 0 })
  })

  it('returns minutes under an hour', () => {
    expect(relativeTimeFrom('2026-09-03T11:45:00.000Z', now)).toEqual({ unit: 'minutes', count: 15 })
  })

  it('returns hours under a day', () => {
    expect(relativeTimeFrom('2026-09-03T09:00:00.000Z', now)).toEqual({ unit: 'hours', count: 3 })
  })

  it('returns days beyond a day', () => {
    expect(relativeTimeFrom('2026-09-01T12:00:00.000Z', now)).toEqual({ unit: 'days', count: 2 })
  })
})

describe('formatDurationMs', () => {
  it('uses minutes below an hour', () => {
    expect(formatDurationMs(15 * 60_000)).toEqual({ unit: 'minutes', count: 15 })
  })

  it('uses hours below a day', () => {
    expect(formatDurationMs(5 * 3_600_000)).toEqual({ unit: 'hours', count: 5 })
  })

  it('uses days at and beyond 24 hours', () => {
    expect(formatDurationMs(2 * 86_400_000)).toEqual({ unit: 'days', count: 2 })
  })

  it('never returns a negative count', () => {
    expect(formatDurationMs(-500)).toEqual({ unit: 'minutes', count: 0 })
  })
})

describe('formatPercent', () => {
  it('rounds to a whole-number percentage', () => {
    expect(formatPercent(0.5)).toBe('50%')
    expect(formatPercent(0.333)).toBe('33%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(1)).toBe('100%')
  })
})
