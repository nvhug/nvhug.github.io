// Turning a chart into 0-100 scores.
//
// The rule is a stated, auditable weight table rather than anything random or
// AI-generated (spec FR-007): every star carries a fixed weight, the four
// transforms adjust it, Tuần/Triệt dampen the palace, and a fixed formula maps
// the total onto the 0-100 scale. A wrong weight is a one-line fix here.
import type { Palace, Scores, Star, Transform } from './types'

const STAR_WEIGHT: Record<string, number> = {
  // Major stars.
  'Tử Vi': 3,
  'Thiên Phủ': 3,
  'Thiên Tướng': 2,
  'Thiên Lương': 2,
  'Thái Dương': 2,
  'Thái Âm': 2,
  'Vũ Khúc': 2,
  'Thiên Đồng': 2,
  'Thiên Cơ': 1,
  'Cự Môn': 0,
  'Tham Lang': 0,
  'Liêm Trinh': 0,
  'Thất Sát': -1,
  'Phá Quân': -1,
  // Supporting stars.
  'Lộc Tồn': 2,
  'Tả Phù': 1,
  'Hữu Bật': 1,
  'Văn Xương': 1,
  'Văn Khúc': 1,
  'Thiên Khôi': 1,
  'Thiên Việt': 1,
  'Long Trì': 1,
  'Phượng Các': 1,
  'Hồng Loan': 1,
  'Thiên Hỷ': 1,
  'Đào Hoa': 1,
  'Thiên Mã': 1,
  'Thiên Khốc': -1,
  'Thiên Hư': -1,
  'Cô Thần': -1,
  'Quả Tú': -1,
  'Kình Dương': -2,
  'Đà La': -2,
  'Địa Không': -2,
  'Địa Kiếp': -2,
  'Hỏa Tinh': -2,
  'Linh Tinh': -2,
}

const TRANSFORM_WEIGHT = { loc: 2, quyen: 1, khoa: 1, ky: -2 } as const

/** Display names for the four transforms — shared by every place (chart, area
    breakdown, AI prompt) that shows a star's hóa Lộc/Quyền/Khoa/Kỵ. */
export const TRANSFORM_LABEL = { loc: 'Lộc', quyen: 'Quyền', khoa: 'Khoa', ky: 'Kỵ' } as const

/** Which palace each life area is read from. */
export const AREA_PALACE = {
  career: 'Quan Lộc',
  wealth: 'Tài Bạch',
  love: 'Phu Thê',
  family: 'Phúc Đức',
  health: 'Tật Ách',
} as const

export type Area = keyof typeof AREA_PALACE

// Empirically the real range of a single palace's weight total, brute-forced
// across every reachable (năm Can Chi × tháng × ngày × giờ) combination through
// the actual star-placement rules — not a guessed ceiling.
const MIN_TOTAL = -9
const MAX_TOTAL = 13
// A neutral palace (total 0) reads as clearly favourable, not a coin flip —
// "no distinguishing stars" found is not the same as "found something bad".
const CENTER_PERCENT = 84
// Even the worst reachable total (MIN_TOTAL) stays above this floor. This is a
// reference reading, not a diagnosis: the star weights still separate a
// strong palace from a weak one (that ordering is what findWeakestArea and
// the area breakdown rely on), but no palace should read as a verdict of
// failure — only as "weaker than the others", which the floor keeps intact.
const FLOOR_PERCENT = 65

/** Maps a weight total onto a 0-100 score, piecewise-linear around 0. */
export function toPercent(total: number): number {
  const percent =
    total >= 0
      ? CENTER_PERCENT + (total / MAX_TOTAL) * (100 - CENTER_PERCENT)
      : CENTER_PERCENT + (total / Math.abs(MIN_TOTAL)) * (CENTER_PERCENT - FLOOR_PERCENT)
  return Math.max(0, Math.min(100, Math.round(percent)))
}

function starWeight(star: Star): number {
  const base = STAR_WEIGHT[star.name] ?? 0
  return base + (star.transform ? TRANSFORM_WEIGHT[star.transform] : 0)
}

export function palaceScore(palace: Palace): number {
  const total = palace.stars.reduce((sum, star) => sum + starWeight(star), 0)
  // Tuần and Triệt void a palace: whatever it holds counts for half.
  const dampened = palace.tuan || palace.triet ? total / 2 : total
  return toPercent(dampened)
}

export type StarBreakdown = { name: string; kind: Star['kind']; transform?: Transform; weight: number }

export type ScoreBreakdown = {
  stars: StarBreakdown[]
  /** Sum of every star's weight, before the Tuần/Triệt halving below. */
  rawTotal: number
  dampened: boolean
  tuan: boolean
  triet: boolean
  /** rawTotal, halved when dampened — this is what toPercent() actually reads. */
  total: number
  percent: number
}

/** Same rule as palaceScore, but returning every number that fed the result
    so the UI can show why a score is what it is, not just the final count. */
export function explainPalaceScore(palace: Palace): ScoreBreakdown {
  const stars = palace.stars.map((star) => ({
    name: star.name,
    kind: star.kind,
    transform: star.transform,
    weight: starWeight(star),
  }))
  const rawTotal = stars.reduce((sum, star) => sum + star.weight, 0)
  const dampened = palace.tuan || palace.triet
  const total = dampened ? rawTotal / 2 : rawTotal
  return { stars, rawTotal, dampened, tuan: palace.tuan, triet: palace.triet, total, percent: toPercent(total) }
}

// Stars classical practice reads as "quý nhân" (a helpful patron/luck bringer).
// All five are placed somewhere in every chart unconditionally (their
// placement rules take no auspicious/inauspicious condition), so "does the
// chart have them" is always true and would score every chart identically.
// What actually differs between charts is whether one lands in a palace that
// matters right now, or falls somewhere irrelevant, so that is what this
// counts — across Mệnh, Thân, the current Đại vận, AND the five life areas
// (a quý nhân star backing your own Tài Bạch or Quan Lộc is still a real,
// classically-read support, not a stretch).
export const QUY_NHAN_STARS = ['Thiên Khôi', 'Thiên Việt', 'Tả Phù', 'Hữu Bật', 'Lộc Tồn'] as const

/** Every palace "quý nhân" is read against — exported so the UI and the AI
    prompt can list which stars actually landed there, consistently with the
    score this feeds. */
export function luckKeyPalaceIndexes(
  palaces: Palace[],
  menhIndex: number,
  thanIndex: number | null,
  daiVanIndex: number | null,
): number[] {
  const areaIndexes = (Object.values(AREA_PALACE) as string[]).map(
    (name) => palaces.find((p) => p.name === name)?.index,
  )
  return [...new Set([menhIndex, thanIndex, daiVanIndex, ...areaIndexes].filter((i): i is number => i != null))]
}

function luckScore(palaces: Palace[], keyIndexes: number[]): number {
  const present = new Set<string>()
  for (const index of keyIndexes) {
    for (const star of palaces[index]?.stars ?? []) {
      if ((QUY_NHAN_STARS as readonly string[]).includes(star.name)) present.add(star.name)
    }
  }
  // Same floor as toPercent: having none of the five stars land in a key
  // palace is a "less lucky than others" signal, not a "no luck at all" one.
  const fraction = present.size / QUY_NHAN_STARS.length
  return Math.round(FLOOR_PERCENT + fraction * (100 - FLOOR_PERCENT))
}

export function scoreChart(
  palaces: Palace[],
  daiVanIndex: number | null,
  // The "Hậu vận" palace (Đại vận projected to age 60) — resolved by the
  // caller (reading.ts), which already needs it as a Reading field of its
  // own, so the age/gender-direction math lives in one place, not two.
  laterLifePalace: Palace | null,
): Scores {
  const menh = palaces.find((p) => p.isMenh) ?? palaces[0]
  const than = palaces.find((p) => p.isThan) ?? null
  const menhScore = palaceScore(menh)
  const overall =
    daiVanIndex === null
      ? menhScore
      : Math.round((menhScore + palaceScore(palaces[daiVanIndex])) / 2)

  const areas = {} as Record<Area, number>
  for (const [area, palaceName] of Object.entries(AREA_PALACE) as [Area, string][]) {
    const palace = palaces.find((p) => p.name === palaceName)
    areas[area] = palace ? palaceScore(palace) : 0
  }

  const laterLife = laterLifePalace ? palaceScore(laterLifePalace) : menhScore
  const luck = luckScore(palaces, luckKeyPalaceIndexes(palaces, menh.index, than?.index ?? null, daiVanIndex))

  return { overall, areas, mindWillpower: menhScore, laterLife, luck }
}

export type WeakestArea = { key: Area | 'menh'; breakdown: ScoreBreakdown }

/** The single lowest-scoring palace among Mệnh and the five life areas —
    grounds "Điểm yếu" in a real, already-computed number instead of a guess. */
export function findWeakestArea(palaces: Palace[]): WeakestArea | null {
  const candidates: Array<{ key: Area | 'menh'; palace: Palace | undefined }> = [
    { key: 'menh', palace: palaces.find((p) => p.isMenh) },
    ...(Object.entries(AREA_PALACE) as [Area, string][]).map(([area, palaceName]) => ({
      key: area,
      palace: palaces.find((p) => p.name === palaceName),
    })),
  ]

  let weakest: WeakestArea | null = null
  for (const { key, palace } of candidates) {
    if (!palace) continue
    const breakdown = explainPalaceScore(palace)
    if (!weakest || breakdown.percent < weakest.breakdown.percent) {
      weakest = { key, breakdown }
    }
  }
  return weakest
}
