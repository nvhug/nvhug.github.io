import { describe, expect, it } from 'vitest'
import { solarToLunar } from './lunar-calendar'

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
