import { describe, expect, it } from 'vitest'
import { daysInSolarMonth, getYearOptions, toVietnamISODate } from './date'

describe('getYearOptions', () => {
  it('spans 100 years back to 10 years forward by default, descending', () => {
    const options = getYearOptions(2026, 2026)
    expect(options[0]).toBe(2036)
    expect(options[options.length - 1]).toBe(1926)
    expect(options).toHaveLength(111)
  })

  it('extends the window to include a year further in the past than the default', () => {
    const options = getYearOptions(2026, 1850)
    expect(options).toContain(1850)
    expect(options[0]).toBe(2036)
    expect(options[options.length - 1]).toBe(1850)
  })

  it('extends the window to include a year further in the future than the default', () => {
    const options = getYearOptions(2026, 2100)
    expect(options).toContain(2100)
    expect(options[0]).toBe(2100)
  })
})

describe('daysInSolarMonth', () => {
  it('returns the length of a 31-day and a 30-day month', () => {
    expect(daysInSolarMonth(1, 2026)).toBe(31)
    expect(daysInSolarMonth(4, 2026)).toBe(30)
    expect(daysInSolarMonth(12, 2026)).toBe(31)
  })

  it('gives February 29 days only in a leap year', () => {
    expect(daysInSolarMonth(2, 2024)).toBe(29)
    expect(daysInSolarMonth(2, 2000)).toBe(29)
    expect(daysInSolarMonth(2, 1900)).toBe(28)
    expect(daysInSolarMonth(2, 2026)).toBe(28)
  })
})

describe('toVietnamISODate', () => {
  // The server runs in UTC on Vercel, so a moment late in the Vietnam evening
  // still belongs to the *previous* UTC day. Reading the process timezone would
  // date every row one day off (FR-007, plan R6) — and would pass on a developer
  // machine set to ICT, which is exactly why this is asserted rather than assumed.
  it('uses the Vietnam calendar day, not the process timezone', () => {
    // 2026-03-05 17:30 UTC is 2026-03-06 00:30 in Vietnam (UTC+7).
    expect(toVietnamISODate(new Date('2026-03-05T17:30:00Z'))).toBe('2026-03-06')
  })

  it('keeps the same day when the UTC instant is already inside it', () => {
    // 2026-03-05 09:00 UTC is 2026-03-05 16:00 in Vietnam.
    expect(toVietnamISODate(new Date('2026-03-05T09:00:00Z'))).toBe('2026-03-05')
  })

  it('rolls the month over at the Vietnam midnight, not the UTC one', () => {
    // 2026-02-28 17:01 UTC is 2026-03-01 00:01 in Vietnam.
    expect(toVietnamISODate(new Date('2026-02-28T17:01:00Z'))).toBe('2026-03-01')
  })

  it('pads month and day to two digits', () => {
    expect(toVietnamISODate(new Date('2026-01-02T03:00:00Z'))).toBe('2026-01-02')
  })

  it('crosses into the next year at the Vietnam new year', () => {
    // 2025-12-31 17:30 UTC is 2026-01-01 00:30 in Vietnam.
    expect(toVietnamISODate(new Date('2025-12-31T17:30:00Z'))).toBe('2026-01-01')
  })
})
