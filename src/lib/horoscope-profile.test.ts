import { describe, expect, it } from 'vitest'
import {
  buildHoroscopeProfile,
  isValidLunarBirthDate,
  isValidSolarBirthDate,
  parseHoroscopeProfile,
} from './horoscope-profile'
import { solarToLunar } from './lunar-calendar'

describe('isValidSolarBirthDate', () => {
  // Local-time constructor (not a UTC ISO string) — mirrors the real `new Date()`
  // the page passes in, so this test isn't itself sensitive to the runner's timezone.
  const today = new Date(2026, 7, 24) // 2026-08-24, months are 0-indexed

  it('accepts a real past date', () => {
    expect(isValidSolarBirthDate('1998-05-12', today)).toBe(true)
  })

  it('accepts today', () => {
    expect(isValidSolarBirthDate('2026-08-24', today)).toBe(true)
  })

  it('rejects a future date', () => {
    expect(isValidSolarBirthDate('2026-08-25', today)).toBe(false)
  })

  it('rejects a non-existent calendar date', () => {
    expect(isValidSolarBirthDate('2026-02-31', today)).toBe(false)
  })

  it('rejects a malformed string', () => {
    expect(isValidSolarBirthDate('not-a-date', today)).toBe(false)
    expect(isValidSolarBirthDate('', today)).toBe(false)
  })

  it('accepts today regardless of the time-of-day component (UTC+7 boundary regression)', () => {
    // Previously compared a UTC-midnight-anchored Date against the raw `now` instant,
    // which wrongly rejected today's own date for positive-UTC-offset users during
    // the early-morning local hours. Time-of-day must never affect the calendar-day comparison.
    const justAfterMidnightLocally = new Date(2026, 7, 24, 0, 30)
    expect(isValidSolarBirthDate('2026-08-24', justAfterMidnightLocally)).toBe(true)
  })
})

describe('isValidLunarBirthDate', () => {
  const today = new Date(2026, 7, 24) // 2026-08-24

  it('accepts a real past lunar date', () => {
    expect(isValidLunarBirthDate({ day: 23, month: 5, year: 1990, isLeapMonth: false }, today)).toBe(true)
  })

  it('accepts a real leap-month date (2023 had a leap month 2)', () => {
    const lunar = solarToLunar({ day: 1, month: 4, year: 2023 })
    expect(lunar.isLeapMonth).toBe(true)
    expect(isValidLunarBirthDate(lunar, today)).toBe(true)
  })

  it('rejects a leap-month claim on the wrong month of a leap year', () => {
    // 2023's real leap month is 2, not 3.
    expect(isValidLunarBirthDate({ day: 1, month: 3, year: 2023, isLeapMonth: true }, today)).toBe(false)
  })

  it('rejects a leap-month claim in a year with no leap month at all', () => {
    expect(isValidLunarBirthDate({ day: 1, month: 6, year: 2024, isLeapMonth: true }, today)).toBe(false)
  })

  it('rejects a day or month outside the calendar range', () => {
    expect(isValidLunarBirthDate({ day: 31, month: 5, year: 1990, isLeapMonth: false }, today)).toBe(false)
    expect(isValidLunarBirthDate({ day: 1, month: 13, year: 1990, isLeapMonth: false }, today)).toBe(false)
    expect(isValidLunarBirthDate({ day: 0, month: 5, year: 1990, isLeapMonth: false }, today)).toBe(false)
  })

  it('rejects a lunar date whose solar equivalent is in the future', () => {
    // Lunar new year 2027 (month 1, day 1) falls after the `today` fixture.
    expect(isValidLunarBirthDate({ day: 1, month: 1, year: 2027, isLeapMonth: false }, today)).toBe(false)
  })
})

describe('buildHoroscopeProfile', () => {
  const now = new Date('2026-08-24T10:00:00.000Z')

  it('derives the lunar date and keeps birth time when known', () => {
    const profile = buildHoroscopeProfile({
      birthDateSolar: '1998-05-12',
      birthTime: '14:30',
      birthTimeUnknown: false,
      gender: 'nam',
      now,
    })
    expect(profile.birthDateSolar).toBe('1998-05-12')
    expect(profile.birthTime).toBe('14:30')
    expect(profile.birthTimeUnknown).toBe(false)
    expect(profile.gender).toBe('nam')
    expect(profile.updatedAt).toBe(now.toISOString())
    expect(profile.birthDateLunar).toEqual(solarToLunar({ day: 12, month: 5, year: 1998 }))
  })

  it('derives the solar date from a lunar input', () => {
    const lunar = { day: 23, month: 5, year: 1990, isLeapMonth: false } as const
    const profile = buildHoroscopeProfile({
      birthDateLunar: lunar,
      birthTime: '14:30',
      birthTimeUnknown: false,
      gender: 'nam',
      now,
    })
    expect(profile.birthDateLunar).toEqual(lunar)
    expect(profile.birthDateSolar).toBe('1990-06-15')
  })

  it('forces birthTime to null when marked unknown, even if a time string was passed in', () => {
    const profile = buildHoroscopeProfile({
      birthDateSolar: '1998-05-12',
      birthTime: '14:30',
      birthTimeUnknown: true,
      gender: 'nu',
      now,
    })
    expect(profile.birthTime).toBeNull()
    expect(profile.birthTimeUnknown).toBe(true)
  })
})

describe('parseHoroscopeProfile', () => {
  const valid = {
    birthDateSolar: '1990-06-15',
    birthDateLunar: { day: 23, month: 5, year: 1990, isLeapMonth: false },
    birthTime: '12:30',
    birthTimeUnknown: false,
    gender: 'nam',
    updatedAt: '2026-08-25T00:00:00.000Z',
  }

  it('accepts a well-formed stored profile', () => {
    expect(parseHoroscopeProfile(valid)).toEqual(valid)
  })

  it('accepts a profile with an unknown birth hour', () => {
    const noHour = { ...valid, birthTime: null, birthTimeUnknown: true }
    expect(parseHoroscopeProfile(noHour)).toEqual(noHour)
  })

  it('rejects a record with no lunar date, rather than letting it reach the chart', () => {
    expect(parseHoroscopeProfile({ ...valid, birthDateLunar: undefined })).toBeNull()
    expect(parseHoroscopeProfile({ ...valid, birthDateLunar: { day: 1 } })).toBeNull()
  })

  it('rejects a malformed birth date or gender', () => {
    expect(parseHoroscopeProfile({ ...valid, birthDateSolar: '15/06/1990' })).toBeNull()
    expect(parseHoroscopeProfile({ ...valid, gender: 'male' })).toBeNull()
  })

  it('rejects anything that is not an object', () => {
    expect(parseHoroscopeProfile(null)).toBeNull()
    expect(parseHoroscopeProfile('nope')).toBeNull()
  })
})

describe('parseHoroscopeProfile birth time', () => {
  const base = {
    birthDateSolar: '1990-06-15',
    birthDateLunar: { day: 23, month: 5, year: 1990, isLeapMonth: false },
    birthTimeUnknown: false,
    gender: 'nam',
    updatedAt: '',
  }

  it('accepts a zero-padded HH:MM value', () => {
    expect(parseHoroscopeProfile({ ...base, birthTime: '09:30' })?.birthTime).toBe('09:30')
  })

  it('rejects a non-padded or malformed clock value', () => {
    // "9:30" would slice to "9:" and yield NaN all the way into the nạp âm table.
    expect(parseHoroscopeProfile({ ...base, birthTime: '9:30' })).toBeNull()
    expect(parseHoroscopeProfile({ ...base, birthTime: '25:00' })).toBeNull()
    expect(parseHoroscopeProfile({ ...base, birthTime: 'noon' })).toBeNull()
  })

  it('requires a birth time when the hour is not marked unknown', () => {
    expect(parseHoroscopeProfile({ ...base, birthTime: null })).toBeNull()
  })

  it('ignores a stale birth time when the hour is marked unknown', () => {
    const parsed = parseHoroscopeProfile({ ...base, birthTimeUnknown: true, birthTime: '09:30' })
    expect(parsed?.birthTimeUnknown).toBe(true)
    expect(parsed?.birthTime).toBeNull()
  })
})

describe('parseHoroscopeProfile lunar date', () => {
  const base = {
    birthDateSolar: '1990-06-15',
    birthTime: '12:30',
    birthTimeUnknown: false,
    gender: 'nam',
    updatedAt: '',
  }

  it('rejects a fractional lunar day, which would index a palace fractionally', () => {
    expect(
      parseHoroscopeProfile({
        ...base,
        birthDateLunar: { day: 1.5, month: 5, year: 1990, isLeapMonth: false },
      }),
    ).toBeNull()
  })

  it('rejects a lunar month or day outside the calendar', () => {
    expect(
      parseHoroscopeProfile({
        ...base,
        birthDateLunar: { day: 23, month: 13, year: 1990, isLeapMonth: false },
      }),
    ).toBeNull()
    expect(
      parseHoroscopeProfile({
        ...base,
        birthDateLunar: { day: 0, month: 5, year: 1990, isLeapMonth: false },
      }),
    ).toBeNull()
  })

  it('rejects a solar date that is not a real calendar date', () => {
    expect(
      parseHoroscopeProfile({
        ...base,
        birthDateSolar: '2026-13-45',
        birthDateLunar: { day: 23, month: 5, year: 1990, isLeapMonth: false },
      }),
    ).toBeNull()
    expect(
      parseHoroscopeProfile({
        ...base,
        birthDateSolar: '1990-02-30',
        birthDateLunar: { day: 23, month: 5, year: 1990, isLeapMonth: false },
      }),
    ).toBeNull()
  })
})
