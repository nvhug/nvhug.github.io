import { describe, expect, it } from 'vitest'
import type { HoroscopeProfile } from '../horoscope-profile'
import { BRANCHES } from './can-chi'
import { buildChart } from './build-chart'

const profile = (overrides: Partial<HoroscopeProfile> = {}): HoroscopeProfile => ({
  birthDateSolar: '1990-06-15',
  birthDateLunar: { day: 23, month: 5, year: 1990, isLeapMonth: false },
  birthTime: '12:30',
  birthTimeUnknown: false,
  gender: 'nam',
  updatedAt: '2026-08-25T00:00:00.000Z',
  ...overrides,
})

describe('buildChart', () => {
  it('returns twelve palaces named from Mệnh outward', () => {
    const chart = buildChart(profile())
    expect(chart.palaces).toHaveLength(12)

    const menh = chart.palaces[chart.menhIndex!]
    expect(menh.name).toBe('Mệnh')
    expect(menh.isMenh).toBe(true)

    const opposite = chart.palaces[(chart.menhIndex! + 6) % 12]
    expect(opposite.name).toBe('Thiên Di')
  })

  it('keeps Mệnh, Tài Bạch and Quan Lộc in the same four-palace triangle', () => {
    const chart = buildChart(profile())
    const nameAt = (offset: number) => chart.palaces[(chart.menhIndex! + offset) % 12].name
    expect(nameAt(4)).toBe('Tài Bạch')
    expect(nameAt(8)).toBe('Quan Lộc')
  })

  it('gives every palace its own Can Chi', () => {
    const chart = buildChart(profile())
    chart.palaces.forEach((palace, index) => {
      expect(palace.pillar.branch).toBe(index)
    })
    expect(new Set(chart.palaces.map((p) => p.pillar.stem)).size).toBeGreaterThan(1)
  })

  it('places all fourteen major stars plus the supporting set', () => {
    const chart = buildChart(profile())
    const names = chart.palaces.flatMap((p) => p.stars.map((s) => s.name))
    expect(names).toContain('Tử Vi')
    expect(names).toContain('Thiên Phủ')
    expect(names).toContain('Lộc Tồn')
    expect(names).toContain('Văn Xương')
    expect(names).toContain('Đào Hoa')
    expect(names.filter((n) => n === 'Tử Vi')).toHaveLength(1)
    expect(chart.palaces.flatMap((p) => p.stars).filter((s) => s.kind === 'chinh')).toHaveLength(14)
  })

  it('marks exactly two palaces with Tuần and two with Triệt', () => {
    const chart = buildChart(profile())
    expect(chart.palaces.filter((p) => p.tuan)).toHaveLength(2)
    expect(chart.palaces.filter((p) => p.triet)).toHaveLength(2)
  })

  it('gives every palace a Tràng Sinh stage', () => {
    const chart = buildChart(profile())
    expect(new Set(chart.palaces.map((p) => p.trangSinh)).size).toBe(12)
  })

  it('applies the four transforms of the birth year to the stars carrying them', () => {
    // 1990 is a Canh year: Thái Dương hóa Lộc, Thiên Đồng hóa Kỵ.
    const chart = buildChart(profile())
    const stars = chart.palaces.flatMap((p) => p.stars)
    expect(stars.find((s) => s.name === 'Thái Dương')?.transform).toBe('loc')
    expect(stars.find((s) => s.name === 'Thiên Đồng')?.transform).toBe('ky')
  })

  it('is deterministic for the same profile', () => {
    expect(buildChart(profile())).toEqual(buildChart(profile()))
  })

  it('changes when the birth hour changes', () => {
    const noon = buildChart(profile({ birthTime: '12:30' }))
    const dawn = buildChart(profile({ birthTime: '05:30' }))
    expect(noon.menhIndex).not.toBe(dawn.menhIndex)
  })

  it('still lays out the hour-independent layer when the birth hour is unknown', () => {
    const chart = buildChart(profile({ birthTimeUnknown: true, birthTime: null }))
    expect(chart.hourKnown).toBe(false)
    expect(chart.menhIndex).toBeNull()
    expect(chart.thanIndex).toBeNull()
    expect(chart.cuc).toBeNull()
    // The twelve branches, their Can Chi and the year/month-derived stars do not
    // need the hour, so the chart is still openable (spec FR-016, FR-017).
    expect(chart.palaces).toHaveLength(12)
    chart.palaces.forEach((palace, index) => {
      expect(palace.pillar.branch).toBe(index)
      expect(palace.name).toBeNull()
      expect(palace.trangSinh).toBeNull()
    })
    const names = chart.palaces.flatMap((p) => p.stars.map((s) => s.name))
    expect(names).toContain('Đào Hoa')
    expect(names).toContain('Lộc Tồn')
    expect(names).toContain('Tả Phù')
  })

  it('omits every hour-derived star rather than placing it on a guess', () => {
    const chart = buildChart(profile({ birthTimeUnknown: true, birthTime: null }))
    const names = chart.palaces.flatMap((p) => p.stars.map((s) => s.name))
    // Chính tinh reach the chart through Mệnh → cục → Tử Vi, all hour-derived.
    expect(names).not.toContain('Tử Vi')
    expect(names).not.toContain('Thiên Phủ')
    // Văn Xương, Văn Khúc, Địa Không and Địa Kiếp are placed from the hour.
    expect(names).not.toContain('Văn Xương')
    expect(names).not.toContain('Địa Kiếp')
    expect(chart.palaces.flatMap((p) => p.stars).every((s) => s.kind === 'phu')).toBe(true)
  })

  it('still marks Tuần and Triệt, which come from the birth year alone', () => {
    const chart = buildChart(profile({ birthTimeUnknown: true, birthTime: null }))
    expect(chart.palaces.filter((p) => p.tuan)).toHaveLength(2)
    expect(chart.palaces.filter((p) => p.triet)).toHaveLength(2)
  })

  it('never substitutes a default hour for an unknown one', () => {
    const unknown = buildChart(profile({ birthTimeUnknown: true, birthTime: null }))
    const midnight = buildChart(profile({ birthTime: '00:00' }))
    expect(unknown.palaces).not.toEqual(midnight.palaces)
    expect(unknown.hourKnown).toBe(false)
    expect(midnight.hourKnown).toBe(true)
  })

  it('marks the Thân palace on the chart', () => {
    const chart = buildChart(profile())
    expect(chart.palaces[chart.thanIndex!].isThan).toBe(true)
    expect(BRANCHES[chart.thanIndex!]).toBeTruthy()
  })
})

describe('births in the late Tý hour', () => {
  it('treats 23:30 as the Tý hour of the following day, matching 00:30 the next morning', () => {
    // 23:00 opens the Tý hour, and that hour belongs to the day that is starting.
    const late = buildChart(
      profile({ birthDateSolar: '1990-06-15', birthTime: '23:30' }),
    )
    const early = buildChart(
      profile({
        birthDateSolar: '1990-06-16',
        birthDateLunar: { day: 24, month: 5, year: 1990, isLeapMonth: false },
        birthTime: '00:30',
      }),
    )
    expect(late.menhIndex).toBe(early.menhIndex)
    expect(late.palaces.map((p) => p.stars.map((s) => s.name))).toEqual(
      early.palaces.map((p) => p.stars.map((s) => s.name)),
    )
  })

  it('does not roll the day for a birth at 22:30, which is still the Hợi hour', () => {
    const hoi = buildChart(profile({ birthTime: '22:30' }))
    const tyLate = buildChart(profile({ birthTime: '23:30' }))
    expect(hoi.menhIndex).not.toBe(tyLate.menhIndex)
  })
})

// Full-chart regression lock. The external anchors live in chart.test.ts
// (published Mệnh/Thân worked example, the Tử Phủ Dần/Thân axis); this one pins
// the ENTIRE star layout for one fixed profile so that a rule silently dropping
// out — which is exactly how Hỏa Tinh and Linh Tinh went missing once — fails
// loudly instead of passing every structural assertion.
describe('full chart layout for a fixed profile', () => {
  it('places every star where the rule tables put it', () => {
    const chart = buildChart(profile())
    const layout = Object.fromEntries(
      chart.palaces.map((palace) => [
        BRANCHES[palace.index],
        palace.stars.map((s) => s.name).sort(),
      ]),
    )

    // Born 1990-06-15 12:30 (lunar 23/5/1990, Canh Ngọ, giờ Ngọ), male.
    const allStars = Object.values(layout).flat()
    // 14 chính tinh + 23 phụ tinh.
    expect(allStars).toHaveLength(37)

    // All 14 chính tinh present exactly once.
    const chinh = [
      'Tử Vi', 'Thiên Cơ', 'Thái Dương', 'Vũ Khúc', 'Thiên Đồng', 'Liêm Trinh',
      'Thiên Phủ', 'Thái Âm', 'Tham Lang', 'Cự Môn', 'Thiên Tướng', 'Thiên Lương',
      'Thất Sát', 'Phá Quân',
    ]
    chinh.forEach((name) => expect(allStars.filter((s) => s === name)).toHaveLength(1))

    // All 23 phụ tinh present exactly once, including the two that went missing.
    const phu = [
      'Tả Phù', 'Hữu Bật', 'Văn Xương', 'Văn Khúc', 'Địa Không', 'Địa Kiếp',
      'Lộc Tồn', 'Kình Dương', 'Đà La', 'Thiên Khôi', 'Thiên Việt',
      'Hỏa Tinh', 'Linh Tinh',
      'Đào Hoa', 'Thiên Mã', 'Hồng Loan', 'Thiên Hỷ', 'Thiên Khốc', 'Thiên Hư',
      'Cô Thần', 'Quả Tú', 'Long Trì', 'Phượng Các',
    ]
    phu.forEach((name) => expect(allStars.filter((s) => s === name)).toHaveLength(1))

    // Snapshot of the exact placement, so any rule change surfaces in review.
    expect(layout).toMatchSnapshot()
  })
})
