import { describe, expect, it } from 'vitest'
import type { HoroscopeProfile } from '../horoscope-profile'
import { buildReading } from './reading'

const profile: HoroscopeProfile = {
  birthDateSolar: '1990-06-15',
  birthDateLunar: { day: 23, month: 5, year: 1990, isLeapMonth: false },
  birthTime: '12:30',
  birthTimeUnknown: false,
  gender: 'nam',
  updatedAt: '2026-08-25T00:00:00.000Z',
}

const today = { day: 25, month: 8, year: 2026 }

describe('buildReading', () => {
  it('names the birth year Canh Ngọ with its nạp âm and animal', () => {
    const reading = buildReading(profile, today)
    expect(reading.yearName).toBe('Canh Ngọ')
    expect(reading.napAm.name).toBe('Lộ Bàng Thổ')
    expect(reading.zodiac).toBe('Ngựa')
  })

  it('reports all four pillars, with the hour pillar filled in', () => {
    const reading = buildReading(profile, today)
    expect(reading.pillars.hour).not.toBeNull()
    expect(Object.keys(reading.pillars)).toEqual(['year', 'month', 'day', 'hour'])
  })

  it('marks the current Đại vận palace on the chart', () => {
    const reading = buildReading(profile, today)
    const flagged = reading.chart.palaces.filter((p) => p.isDaiVan)
    expect(flagged).toHaveLength(1)
    expect(flagged[0].index).toBe(reading.cycles.find((c) => c.key === 'daiVan')!.palaceIndex)
  })

  it('exposes the Mệnh and Thân palaces by name', () => {
    const reading = buildReading(profile, today)
    expect(reading.menh?.name).toBe('Mệnh')
    expect(reading.than).not.toBeNull()
  })

  it('produces the same reading for the same profile and viewing date', () => {
    expect(buildReading(profile, today)).toEqual(buildReading(profile, today))
  })

  it('produces a different reading for a different birth date', () => {
    const other = buildReading(
      { ...profile, birthDateSolar: '1991-03-02', birthDateLunar: { day: 17, month: 1, year: 1991, isLeapMonth: false } },
      today,
    )
    expect(other.yearName).not.toBe(buildReading(profile, today).yearName)
  })

  it('still reports the hour-independent layer when the birth hour is unknown', () => {
    const reading = buildReading({ ...profile, birthTimeUnknown: true, birthTime: null }, today)
    expect(reading.yearName).toBe('Canh Ngọ')
    expect(reading.napAm.name).toBe('Lộ Bàng Thổ')
    expect(reading.pillars.hour).toBeNull()
    expect(reading.chart.hourKnown).toBe(false)
    expect(reading.menh).toBeNull()
    expect(reading.than).toBeNull()
  })

  it('scores nothing rather than guessing when there is no chart', () => {
    const reading = buildReading({ ...profile, birthTimeUnknown: true, birthTime: null }, today)
    expect(reading.scores).toBeNull()
  })
})
