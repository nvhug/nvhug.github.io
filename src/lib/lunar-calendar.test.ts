import { describe, expect, it } from 'vitest'
import { lunarToSolar, solarToLunar } from './lunar-calendar'

describe('solarToLunar', () => {
  it('matches the well-documented Vietnamese Lunar New Year (day 1, month 1) dates', () => {
    expect(solarToLunar({ day: 22, month: 1, year: 2023 })).toEqual({
      day: 1,
      month: 1,
      year: 2023,
      isLeapMonth: false,
    })
    expect(solarToLunar({ day: 10, month: 2, year: 2024 })).toEqual({
      day: 1,
      month: 1,
      year: 2024,
      isLeapMonth: false,
    })
    expect(solarToLunar({ day: 29, month: 1, year: 2025 })).toEqual({
      day: 1,
      month: 1,
      year: 2025,
      isLeapMonth: false,
    })
    expect(solarToLunar({ day: 17, month: 2, year: 2026 })).toEqual({
      day: 1,
      month: 1,
      year: 2026,
      isLeapMonth: false,
    })
  })

  it('converts a mid-year date to a plausible non-leap lunar date', () => {
    const result = solarToLunar({ day: 1, month: 9, year: 2024 })
    expect(result.isLeapMonth).toBe(false)
    expect(result.month).toBeGreaterThanOrEqual(1)
    expect(result.month).toBeLessThanOrEqual(12)
    expect(result.day).toBeGreaterThanOrEqual(1)
    expect(result.day).toBeLessThanOrEqual(30)
  })
})

describe('lunarToSolar', () => {
  it('matches the well-documented Vietnamese Lunar New Year (day 1, month 1) dates', () => {
    expect(lunarToSolar({ day: 1, month: 1, year: 2023, isLeapMonth: false })).toEqual({
      day: 22,
      month: 1,
      year: 2023,
    })
    expect(lunarToSolar({ day: 1, month: 1, year: 2024, isLeapMonth: false })).toEqual({
      day: 10,
      month: 2,
      year: 2024,
    })
    expect(lunarToSolar({ day: 1, month: 1, year: 2026, isLeapMonth: false })).toEqual({
      day: 17,
      month: 2,
      year: 2026,
    })
  })

  it('round-trips through solarToLunar for an ordinary mid-year date', () => {
    const solar = { day: 12, month: 5, year: 1998 }
    const lunar = solarToLunar(solar)
    expect(lunarToSolar(lunar)).toEqual(solar)
  })

  it('round-trips a real leap month (2023 had a leap month 2, spanning solar April)', () => {
    const solar = { day: 1, month: 4, year: 2023 }
    const lunar = solarToLunar(solar)
    expect(lunar.isLeapMonth).toBe(true)
    expect(lunar.month).toBe(2)
    expect(lunarToSolar(lunar)).toEqual(solar)
  })

  it('returns the zero sentinel for a leap-month claim on the wrong month', () => {
    // 2023's real leap month is 2, so claiming month 3 is a leap month is invalid
    // even though the year does have a leap month somewhere.
    const result = lunarToSolar({ day: 1, month: 3, year: 2023, isLeapMonth: true })
    expect(result).toEqual({ day: 0, month: 0, year: 0 })
  })

  it('produces a date whose own solarToLunar disagrees, for a leap-month claim in a non-leap year', () => {
    // 2024 has no leap month at all. lunarToSolar doesn't special-case this (the
    // reference algorithm only guards "wrong month within a leap year"), so it
    // returns a real-looking date — but that date's true lunar reading comes back
    // non-leap, which is exactly what isValidLunarBirthDate's round-trip check
    // catches downstream.
    const result = lunarToSolar({ day: 1, month: 6, year: 2024, isLeapMonth: true })
    expect(solarToLunar(result).isLeapMonth).toBe(false)
  })
})
