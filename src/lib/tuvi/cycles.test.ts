import { describe, expect, it } from 'vitest'
import type { HoroscopeProfile } from '../horoscope-profile'
import { BRANCHES } from './can-chi'
import { buildChart } from './build-chart'
import { buildCycles } from './cycles'

const profile: HoroscopeProfile = {
  birthDateSolar: '1990-06-15',
  birthDateLunar: { day: 23, month: 5, year: 1990, isLeapMonth: false },
  birthTime: '12:30',
  birthTimeUnknown: false,
  gender: 'nam',
  updatedAt: '2026-08-25T00:00:00.000Z',
}

const today = { day: 25, month: 8, year: 2026 }

describe('buildCycles', () => {
  it('returns Đại vận, Lưu niên and Lưu nguyệt in that order', () => {
    const cycles = buildCycles(profile, buildChart(profile), today)
    expect(cycles.map((c) => c.key)).toEqual(['daiVan', 'luuNien', 'luuNguyet'])
  })

  it('starts the first Đại vận at the age given by the cục', () => {
    const chart = buildChart(profile)
    const daiVan = buildCycles(profile, chart, today).find((c) => c.key === 'daiVan')!
    // Born 1990, viewed 2026 → tuổi âm 37, so the run has begun and the span
    // still opens on a multiple of the cục age.
    expect(daiVan.span).toHaveProperty('from')
    const from = (daiVan.span as { from: number }).from
    expect((from - chart.cuc!.number) % 10).toBe(0)
  })

  it('moves one palace per completed decade', () => {
    const chart = buildChart(profile)
    const cycles = buildCycles(profile, chart, today)
    const daiVan = cycles.find((c) => c.key === 'daiVan')!
    // Born 1990, viewed in 2026 → tuổi âm 37; with a cục of n the person has
    // passed floor((37 - n) / 10) decades since the first period opened.
    const steps = Math.floor((37 - chart.cuc!.number) / 10)
    const forward = chart.palaces[chart.menhIndex!].index
    const expected = ((forward + (chart.palaces.length ? steps : 0)) % 12 + 12) % 12
    expect([expected, ((forward - steps) % 12 + 12) % 12]).toContain(daiVan.palaceIndex)
  })

  it('puts Lưu niên on the palace carrying the current lunar year branch', () => {
    const cycles = buildCycles(profile, buildChart(profile), today)
    const luuNien = cycles.find((c) => c.key === 'luuNien')!
    // 2026 is Bính Ngọ.
    expect(BRANCHES[luuNien.palaceIndex!]).toBe('Ngọ')
    expect(luuNien.name).toBe('Bính Ngọ')
    expect(luuNien.span).toEqual({ kind: 'lunarYear', year: 2026 })
  })

  it('names the lunar month on Lưu nguyệt', () => {
    const cycles = buildCycles(profile, buildChart(profile), today)
    const luuNguyet = cycles.find((c) => c.key === 'luuNguyet')!
    expect(luuNguyet.span.kind).toBe('lunarMonth')
    // The leap flag has to travel with the month, or a leap month renders
    // identically to the regular one beside a refreshed interpretation.
    expect(luuNguyet.span).toHaveProperty('leap')
    expect(luuNguyet.palaceIndex).not.toBeNull()
  })

  it('leaves Đại vận unresolved when there is no chart to anchor it to', () => {
    const noHour = { ...profile, birthTimeUnknown: true, birthTime: null }
    const cycles = buildCycles(noHour, buildChart(noHour), today)
    expect(cycles.find((c) => c.key === 'daiVan')!.palaceIndex).toBeNull()
    expect(cycles.find((c) => c.key === 'daiVan')!.span).toEqual({ kind: 'needHour' })
    // The two time-based cycles do not need the birth hour.
    expect(cycles.find((c) => c.key === 'luuNien')!.name).toBe('Bính Ngọ')
  })

  it('is deterministic for the same inputs', () => {
    const chart = buildChart(profile)
    expect(buildCycles(profile, chart, today)).toEqual(buildCycles(profile, chart, today))
  })
})

describe('buildCycles before the first Đại vận opens', () => {
  // Born in the lunar year being viewed: age 1, below every possible cục (2-6).
  // The lunar date is derived from the solar one, so the solar date is what moves.
  const child = { ...profile, birthDateSolar: '2026-06-15' }

  it('does not claim a decade the person has not reached yet', () => {
    const chart = buildChart(child)
    const daiVan = buildCycles(child, chart, today).find((c) => c.key === 'daiVan')!
    expect(daiVan.span).toEqual({ kind: 'ageFrom', from: chart.cuc!.number })
    // It names the palace the first decade will open in, but marks no palace as
    // current — nothing should be inked or scored as a decade being lived.
    expect(daiVan.name).toBe(chart.palaces[chart.menhIndex!].name)
    expect(daiVan.palaceIndex).toBeNull()
  })

  it('still reports a real age range once the first decade has opened', () => {
    const daiVan = buildCycles(profile, buildChart(profile), today).find((c) => c.key === 'daiVan')!
    expect(daiVan.span.kind).toBe('ageRange')
  })
})
