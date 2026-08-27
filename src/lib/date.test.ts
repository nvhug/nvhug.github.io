import { describe, expect, it } from 'vitest'
import { daysInSolarMonth, getYearOptions } from './date'

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
