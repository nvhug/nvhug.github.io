import { describe, expect, it } from 'vitest'
import { getYearOptions } from './date'

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
