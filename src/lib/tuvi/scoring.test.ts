import { describe, expect, it } from 'vitest'
import type { Palace, Star } from './types'
import { AREA_PALACE, explainPalaceScore, findWeakestArea, palaceScore, scoreChart, toPercent } from './scoring'

const star = (name: string, overrides: Partial<Star> = {}): Star => ({
  name,
  kind: 'chinh',
  ...overrides,
})

const palace = (name: string, stars: Star[], overrides: Partial<Palace> = {}): Palace => ({
  index: 0,
  name,
  pillar: { stem: 0, branch: 0 },
  stars,
  trangSinh: 'Đế Vượng',
  tuan: false,
  triet: false,
  isMenh: false,
  isThan: false,
  isDaiVan: false,
  ...overrides,
})

describe('toPercent', () => {
  it('centres a neutral total (0) above the midpoint, at 84', () => {
    expect(toPercent(0)).toBe(84)
  })

  it('reaches the floor and the ceiling at the empirical min/max totals', () => {
    expect(toPercent(-9)).toBe(65)
    expect(toPercent(13)).toBe(100)
  })

  it('clamps beyond the empirical range instead of going negative or past 100', () => {
    expect(toPercent(-50)).toBe(0)
    expect(toPercent(50)).toBe(100)
  })

  it('never leaves the 0-100 range and is monotonic', () => {
    let previous = -1
    for (let total = -50; total <= 50; total++) {
      const value = toPercent(total)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

describe('palaceScore', () => {
  it('rates a palace of auspicious stars near the top of the scale', () => {
    const p = palace('Mệnh', [star('Tử Vi'), star('Thiên Phủ'), star('Lộc Tồn', { kind: 'phu' })])
    expect(palaceScore(p)).toBe(toPercent(8))
  })

  it('rates a palace of inauspicious stars at the floor of the scale', () => {
    const p = palace('Mệnh', [
      star('Thất Sát'),
      star('Phá Quân'),
      star('Kình Dương', { kind: 'phu' }),
      star('Địa Kiếp', { kind: 'phu' }),
      star('Đà La', { kind: 'phu' }),
      star('Thiên Khốc', { kind: 'phu' }),
    ])
    expect(palaceScore(p)).toBe(65)
  })

  it('lifts a palace when a star carries hóa Lộc and lowers it on hóa Kỵ', () => {
    const base = palace('Mệnh', [star('Thiên Cơ')])
    const blessed = palace('Mệnh', [star('Thiên Cơ', { transform: 'loc' })])
    const cursed = palace('Mệnh', [star('Thiên Cơ', { transform: 'ky' })])
    expect(palaceScore(blessed)).toBeGreaterThanOrEqual(palaceScore(base))
    expect(palaceScore(cursed)).toBeLessThanOrEqual(palaceScore(base))
  })

  it('pulls a strong palace back toward the middle when Tuần or Triệt falls on it', () => {
    const stars = [star('Tử Vi'), star('Thiên Phủ'), star('Lộc Tồn', { kind: 'phu' })]
    const plain = palace('Mệnh', stars)
    const voided = palace('Mệnh', stars, { tuan: true })
    expect(palaceScore(voided)).toBeLessThan(palaceScore(plain))
  })

  it('rates an empty palace as neutral rather than failing', () => {
    expect(palaceScore(palace('Mệnh', []))).toBe(84)
  })
})

describe('explainPalaceScore', () => {
  it('lists every star with its individual weight, matching the total palaceScore uses', () => {
    const p = palace('Quan Lộc', [star('Tử Vi'), star('Thiên Phủ'), star('Lộc Tồn', { kind: 'phu' })])
    const breakdown = explainPalaceScore(p)
    expect(breakdown.stars).toEqual([
      { name: 'Tử Vi', kind: 'chinh', transform: undefined, weight: 3 },
      { name: 'Thiên Phủ', kind: 'chinh', transform: undefined, weight: 3 },
      { name: 'Lộc Tồn', kind: 'phu', transform: undefined, weight: 2 },
    ])
    expect(breakdown.rawTotal).toBe(8)
    expect(breakdown.dampened).toBe(false)
    expect(breakdown.total).toBe(8)
    expect(breakdown.percent).toBe(palaceScore(p))
  })

  it('halves rawTotal into total when Tuần or Triệt falls on the palace, same as palaceScore', () => {
    const stars = [star('Tử Vi'), star('Thiên Phủ')]
    const voided = palace('Quan Lộc', stars, { triet: true })
    const breakdown = explainPalaceScore(voided)
    expect(breakdown.rawTotal).toBe(6)
    expect(breakdown.dampened).toBe(true)
    expect(breakdown.total).toBe(3)
    expect(breakdown.percent).toBe(palaceScore(voided))
  })

  it('carries each star\'s transform through to the breakdown', () => {
    const p = palace('Quan Lộc', [star('Thiên Cơ', { transform: 'ky' })])
    const breakdown = explainPalaceScore(p)
    expect(breakdown.stars[0].transform).toBe('ky')
    expect(breakdown.stars[0].weight).toBe(1 - 2) // base 1, hóa Kỵ -2
  })

  it('is empty and neutral for a palace with no stars', () => {
    const breakdown = explainPalaceScore(palace('Quan Lộc', []))
    expect(breakdown.stars).toEqual([])
    expect(breakdown.rawTotal).toBe(0)
    expect(breakdown.percent).toBe(84)
  })
})

describe('scoreChart', () => {
  const twelve = (): Palace[] =>
    Array.from({ length: 12 }, (_, index) =>
      palace(
        ['Mệnh', 'Huynh Đệ', 'Phu Thê', 'Tử Tức', 'Tài Bạch', 'Tật Ách',
          'Thiên Di', 'Nô Bộc', 'Quan Lộc', 'Điền Trạch', 'Phúc Đức', 'Phụ Mẫu'][index],
        [star('Thiên Cơ')],
        { index, isMenh: index === 0 },
      ),
    )

  it('scores each of the five life areas from its own palace', () => {
    const palaces = twelve()
    const quanLoc = palaces.findIndex((p) => p.name === (AREA_PALACE.career as string))
    palaces[quanLoc] = palace(AREA_PALACE.career, [star('Tử Vi'), star('Thiên Phủ'), star('Lộc Tồn', { kind: 'phu' })], { index: quanLoc })

    const scores = scoreChart(palaces, 0, null)
    expect(scores.areas.career).toBe(palaceScore(palaces[quanLoc]))
    expect(scores.areas.wealth).toBeLessThan(scores.areas.career)
  })

  it('reads the overall score off Mệnh together with the current Đại vận palace', () => {
    const palaces = twelve()
    const strong = scoreChart(
      palaces.map((p, i) =>
        i === 0 || i === 3
          ? palace(p.name!, [star('Tử Vi'), star('Thiên Phủ'), star('Lộc Tồn', { kind: 'phu' })], { index: i, isMenh: i === 0 })
          : p,
      ),
      3,
      null,
    )
    const weak = scoreChart(palaces, 3, null)
    expect(strong.overall).toBeGreaterThan(weak.overall)
  })

  it('falls back to Mệnh alone when the Đại vận palace is unknown', () => {
    const palaces = twelve()
    expect(scoreChart(palaces, null, null).overall).toBe(palaceScore(palaces[0]))
  })

  it('is deterministic', () => {
    const palaces = twelve()
    expect(scoreChart(palaces, 4, null)).toEqual(scoreChart(palaces, 4, null))
  })

  it('mindWillpower reads Mệnh alone, independent of the Đại vận blend overall uses', () => {
    const palaces = twelve()
    palaces[0] = palace('Mệnh', [star('Tử Vi'), star('Thiên Phủ'), star('Lộc Tồn', { kind: 'phu' })], {
      index: 0,
      isMenh: true,
    })
    const scores = scoreChart(palaces, 3, null) // palace 3 stays weak (plain Thiên Cơ)
    expect(scores.mindWillpower).toBe(palaceScore(palaces[0]))
    expect(scores.mindWillpower).not.toBe(scores.overall)
  })

  it('laterLife scores the projected age-60 palace passed in by the caller', () => {
    const palaces = twelve()
    const projected = palace('Tật Ách', [star('Tử Vi'), star('Thiên Phủ')], { index: 5 })
    const withProjected = palaces.map((p, i) => (i === 5 ? projected : p))
    const scores = scoreChart(withProjected, 3, projected)
    expect(scores.laterLife).toBe(palaceScore(projected))
    expect(scores.laterLife).not.toBe(scores.overall)
  })

  it('falls back to mindWillpower when there is no projected later-life palace yet', () => {
    const palaces = twelve()
    const scores = scoreChart(palaces, null, null)
    expect(scores.laterLife).toBe(scores.mindWillpower)
  })

  describe('luck', () => {
    it('counts a quý nhân star only when it lands in Mệnh, Thân, the current Đại vận, or a life area', () => {
      const palaces = twelve()
      palaces[0] = palace('Mệnh', [star('Lộc Tồn', { kind: 'phu' })], { index: 0, isMenh: true })
      // Thiên Khôi lands at Thiên Di — not Mệnh, Thân, the (unknown) Đại vận, or any of the five areas.
      palaces[6] = palace('Thiên Di', [star('Thiên Khôi', { kind: 'phu' })], { index: 6 })
      const scores = scoreChart(palaces, null, null)
      expect(scores.luck).toBe(72) // 1 of 5 quý nhân stars counted, off the 65 floor
    })

    it('also counts a quý nhân star landing in one of the five life-area palaces', () => {
      const palaces = twelve()
      palaces[4] = palace('Tài Bạch', [star('Lộc Tồn', { kind: 'phu' })], { index: 4 }) // wealth palace
      expect(scoreChart(palaces, null, null).luck).toBe(72)
    })

    it('is not a constant: the same star scores differently depending on where it lands', () => {
      const inMenh = twelve()
      inMenh[0] = palace('Mệnh', [star('Lộc Tồn', { kind: 'phu' })], { index: 0, isMenh: true })

      const elsewhere = twelve()
      elsewhere[6] = palace('Thiên Di', [star('Lộc Tồn', { kind: 'phu' })], { index: 6 })

      expect(scoreChart(inMenh, null, null).luck).not.toBe(scoreChart(elsewhere, null, null).luck)
    })
  })
})

describe('findWeakestArea', () => {
  const twelve = (): Palace[] =>
    Array.from({ length: 12 }, (_, index) =>
      palace(
        ['Mệnh', 'Huynh Đệ', 'Phu Thê', 'Tử Tức', 'Tài Bạch', 'Tật Ách',
          'Thiên Di', 'Nô Bộc', 'Quan Lộc', 'Điền Trạch', 'Phúc Đức', 'Phụ Mẫu'][index],
        [star('Thiên Cơ')],
        { index, isMenh: index === 0 },
      ),
    )

  it('picks the lowest-scoring entry among Mệnh and the five life areas', () => {
    const palaces = twelve()
    palaces[4] = palace('Tài Bạch', [star('Thất Sát'), star('Kình Dương', { kind: 'phu' })], { index: 4 })
    expect(findWeakestArea(palaces)?.key).toBe('wealth')
  })

  it('can pick Mệnh itself when it scores lower than every area', () => {
    const palaces = twelve()
    palaces[0] = palace(
      'Mệnh',
      [star('Thất Sát'), star('Phá Quân'), star('Kình Dương', { kind: 'phu' })],
      { index: 0, isMenh: true },
    )
    expect(findWeakestArea(palaces)?.key).toBe('menh')
  })
})
