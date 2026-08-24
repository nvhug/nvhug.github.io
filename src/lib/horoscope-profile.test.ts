import { describe, expect, it } from 'vitest'
import { buildHoroscopeProfile, isValidSolarBirthDate } from './horoscope-profile'
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
