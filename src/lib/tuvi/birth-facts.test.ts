import { describe, expect, it } from 'vitest'
import type { HoroscopeProfile } from '../horoscope-profile'
import { birthFacts, formatLunarDate, formatSolarDate } from './birth-facts'

const profile: HoroscopeProfile = {
  birthDateSolar: '1990-06-15',
  birthDateLunar: { day: 23, month: 5, year: 1990, isLeapMonth: false },
  birthTime: '14:30',
  birthTimeUnknown: false,
  gender: 'nam',
  updatedAt: '2026-08-26T00:00:00.000Z',
}

describe('formatSolarDate', () => {
  it('reads as a Vietnamese date, day first', () => {
    expect(formatSolarDate('1990-06-15')).toBe('15/06/1990')
  })
})

describe('formatLunarDate', () => {
  it('leaves the lunar day and month unpadded, as a lunar date is written', () => {
    expect(formatLunarDate({ day: 5, month: 3, year: 1990, isLeapMonth: false })).toBe('5/3/1990')
  })

  it('marks a leap month, which is a different month from the regular one', () => {
    expect(formatLunarDate({ day: 5, month: 3, year: 1990, isLeapMonth: true })).toBe('5/3N/1990')
  })
})

describe('birthFacts', () => {
  it('shows the solar date exactly as entered', () => {
    expect(birthFacts(profile).solar).toBe('15/06/1990')
  })

  it('derives the lunar date from the solar one rather than trusting the stored field', () => {
    // profile_data is browser-writable. A stored lunar date that disagreed with
    // the solar one would show a date the reading was never built from.
    const tampered = {
      ...profile,
      birthDateLunar: { day: 1, month: 1, year: 1800, isLeapMonth: false },
    }
    expect(birthFacts(tampered).lunar).toBe(birthFacts(profile).lunar)
    expect(birthFacts(profile).lunar).toBe('23/5/1990')
  })

  it('names the Can Chi hour the clock time falls in', () => {
    expect(birthFacts(profile).hour).toEqual({ clock: '14:30', branch: 'Mùi' })
  })

  it('puts a Tý-hour birth in Tý, which straddles midnight', () => {
    expect(birthFacts({ ...profile, birthTime: '23:30' }).hour?.branch).toBe('Tý')
    expect(birthFacts({ ...profile, birthTime: '00:30' }).hour?.branch).toBe('Tý')
  })

  it('reports no hour when the reader said they do not know it', () => {
    expect(birthFacts({ ...profile, birthTimeUnknown: true }).hour).toBeNull()
  })

  it('reports no hour when none was stored, whatever the flag says', () => {
    expect(birthFacts({ ...profile, birthTime: null }).hour).toBeNull()
  })
})
