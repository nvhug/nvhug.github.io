import { describe, expect, it } from 'vitest'
import { westernZodiacSign } from './western-zodiac'

describe('westernZodiacSign', () => {
  it('picks the right sign for a date well inside its range', () => {
    expect(westernZodiacSign({ month: 5, day: 5 })).toBe('Kim Ngưu')
    expect(westernZodiacSign({ month: 8, day: 10 })).toBe('Sư Tử')
  })

  it('handles the Ma Kết range that wraps across the year boundary', () => {
    expect(westernZodiacSign({ month: 12, day: 25 })).toBe('Ma Kết')
    expect(westernZodiacSign({ month: 1, day: 5 })).toBe('Ma Kết')
  })

  it('draws exact boundaries between adjacent signs', () => {
    expect(westernZodiacSign({ month: 4, day: 19 })).toBe('Bạch Dương')
    expect(westernZodiacSign({ month: 4, day: 20 })).toBe('Kim Ngưu')
    expect(westernZodiacSign({ month: 2, day: 18 })).toBe('Bảo Bình')
    expect(westernZodiacSign({ month: 2, day: 19 })).toBe('Song Ngư')
  })

  it('covers every day of the year with exactly one sign', () => {
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= daysInMonth[month - 1]; day++) {
        expect(() => westernZodiacSign({ month, day })).not.toThrow()
      }
    }
  })
})
