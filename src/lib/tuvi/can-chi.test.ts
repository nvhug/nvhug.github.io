import { describe, expect, it } from 'vitest'
import { julianDayNumber } from '../lunar-calendar'
import {
  BRANCHES,
  STEMS,
  dayPillar,
  hourBranchFromClock,
  hourPillar,
  monthPillar,
  napAm,
  yearPillar,
  zodiacAnimal,
} from './can-chi'

describe('julianDayNumber', () => {
  it('returns the known Julian Day Number for the Gregorian epoch reference date', () => {
    // 2000-01-01 is JDN 2451545 (the standard J2000.0 reference).
    expect(julianDayNumber({ day: 1, month: 1, year: 2000 })).toBe(2451545)
  })

  it('advances by exactly one per calendar day across a month boundary', () => {
    const jan31 = julianDayNumber({ day: 31, month: 1, year: 2026 })
    const feb1 = julianDayNumber({ day: 1, month: 2, year: 2026 })
    expect(feb1 - jan31).toBe(1)
  })
})

describe('yearPillar', () => {
  it('names the lunar year 2026 Bính Ngọ', () => {
    const { stem, branch } = yearPillar(2026)
    expect(STEMS[stem]).toBe('Bính')
    expect(BRANCHES[branch]).toBe('Ngọ')
  })

  it('names the lunar year 1990 Canh Ngọ', () => {
    const { stem, branch } = yearPillar(1990)
    expect(STEMS[stem]).toBe('Canh')
    expect(BRANCHES[branch]).toBe('Ngọ')
  })

  it('names the lunar year 2000 Canh Thìn', () => {
    const { stem, branch } = yearPillar(2000)
    expect(STEMS[stem]).toBe('Canh')
    expect(BRANCHES[branch]).toBe('Thìn')
  })

  it('repeats on a 60-year cycle', () => {
    expect(yearPillar(1990)).toEqual(yearPillar(2050))
  })
})

describe('monthPillar', () => {
  it('puts lunar month 1 on the Dần branch', () => {
    expect(BRANCHES[monthPillar(1, yearPillar(2026).stem).branch]).toBe('Dần')
  })

  it('applies ngũ hổ độn: a Bính year opens with Canh Dần', () => {
    const { stem, branch } = monthPillar(1, yearPillar(2026).stem)
    expect(STEMS[stem]).toBe('Canh')
    expect(BRANCHES[branch]).toBe('Dần')
  })

  it('applies ngũ hổ độn: a Giáp year opens with Bính Dần', () => {
    // 1984 is Giáp Tý.
    expect(STEMS[monthPillar(1, yearPillar(1984).stem).stem]).toBe('Bính')
  })

  it('applies ngũ hổ độn: a Mậu year opens with Giáp Dần', () => {
    // 1988 is Mậu Thìn.
    expect(STEMS[monthPillar(1, yearPillar(1988).stem).stem]).toBe('Giáp')
  })

  it('advances the stem by one for each following lunar month', () => {
    const first = monthPillar(1, yearPillar(2026).stem)
    const second = monthPillar(2, yearPillar(2026).stem)
    expect(second.stem).toBe((first.stem + 1) % 10)
    expect(BRANCHES[second.branch]).toBe('Mão')
  })
})

describe('dayPillar', () => {
  it('names 2000-01-01 a Mậu Ngọ day', () => {
    const { stem, branch } = dayPillar({ day: 1, month: 1, year: 2000 })
    expect(STEMS[stem]).toBe('Mậu')
    expect(BRANCHES[branch]).toBe('Ngọ')
  })

  it('repeats on an unbroken 60-day cycle', () => {
    const start = dayPillar({ day: 1, month: 1, year: 2000 })
    const sixtyDaysLater = dayPillar({ day: 1, month: 3, year: 2000 })
    // 2000 is a leap year: Jan has 31 days, Feb has 29 → 1 Jan + 60 days = 1 Mar.
    expect(sixtyDaysLater).toEqual(start)
  })
})

describe('hourBranchFromClock', () => {
  it('opens the Tý hour at 23:00, not at midnight', () => {
    expect(BRANCHES[hourBranchFromClock('23:00')]).toBe('Tý')
    expect(BRANCHES[hourBranchFromClock('00:30')]).toBe('Tý')
  })

  it('maps each two-hour block to its branch', () => {
    expect(BRANCHES[hourBranchFromClock('01:00')]).toBe('Sửu')
    expect(BRANCHES[hourBranchFromClock('02:59')]).toBe('Sửu')
    expect(BRANCHES[hourBranchFromClock('03:00')]).toBe('Dần')
    expect(BRANCHES[hourBranchFromClock('12:00')]).toBe('Ngọ')
  })
})

describe('hourPillar', () => {
  it('opens a Giáp day with the Giáp Tý hour', () => {
    const { stem, branch } = hourPillar(0, 0)
    expect(STEMS[stem]).toBe('Giáp')
    expect(BRANCHES[branch]).toBe('Tý')
  })

  it('opens an Ất day with the Bính Tý hour', () => {
    expect(STEMS[hourPillar(1, 0).stem]).toBe('Bính')
  })
})

describe('napAm', () => {
  it('gives Canh Ngọ the Lộ Bàng Thổ attribute', () => {
    const { stem, branch } = yearPillar(1990)
    expect(napAm(stem, branch)).toEqual({ name: 'Lộ Bàng Thổ', element: 'Thổ' })
  })

  it('gives Bính Dần the Lư Trung Hỏa attribute', () => {
    expect(napAm(2, 2)).toEqual({ name: 'Lư Trung Hỏa', element: 'Hỏa' })
  })

  it('gives Giáp Tý the Hải Trung Kim attribute', () => {
    expect(napAm(0, 0)).toEqual({ name: 'Hải Trung Kim', element: 'Kim' })
  })

  it('covers all 60 stem/branch combinations', () => {
    for (let i = 0; i < 60; i++) {
      const entry = napAm(i % 10, i % 12)
      expect(entry.name).toBeTruthy()
      expect(['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ']).toContain(entry.element)
    }
  })
})

describe('zodiacAnimal', () => {
  it('names the animal of the year branch', () => {
    expect(zodiacAnimal(yearPillar(1990).branch)).toBe('Ngựa')
    expect(zodiacAnimal(yearPillar(2026).branch)).toBe('Ngựa')
    expect(zodiacAnimal(0)).toBe('Chuột')
  })
})
