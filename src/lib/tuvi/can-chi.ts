// Sexagenary (Can Chi) layer for tu vi: the four pillars, the nap am element
// and the zodiac animal. Pure arithmetic and lookup tables — no I/O, no clock.
import { julianDayNumber, type SolarDate } from '../lunar-calendar'
import type { Element, NapAm, Pillar } from './types'

export const STEMS = [
  'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý',
] as const

export const BRANCHES = [
  'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi',
] as const

const ANIMALS = [
  'Chuột', 'Trâu', 'Hổ', 'Mèo', 'Rồng', 'Rắn', 'Ngựa', 'Dê', 'Khỉ', 'Gà', 'Chó', 'Lợn',
] as const

// One entry per pair of consecutive positions in the 60-term cycle.
const NAP_AM: ReadonlyArray<readonly [string, Element]> = [
  ['Hải Trung Kim', 'Kim'],
  ['Lư Trung Hỏa', 'Hỏa'],
  ['Đại Lâm Mộc', 'Mộc'],
  ['Lộ Bàng Thổ', 'Thổ'],
  ['Kiếm Phong Kim', 'Kim'],
  ['Sơn Đầu Hỏa', 'Hỏa'],
  ['Giản Hạ Thủy', 'Thủy'],
  ['Thành Đầu Thổ', 'Thổ'],
  ['Bạch Lạp Kim', 'Kim'],
  ['Dương Liễu Mộc', 'Mộc'],
  ['Tuyền Trung Thủy', 'Thủy'],
  ['Ốc Thượng Thổ', 'Thổ'],
  ['Tích Lịch Hỏa', 'Hỏa'],
  ['Tùng Bách Mộc', 'Mộc'],
  ['Trường Lưu Thủy', 'Thủy'],
  ['Sa Trung Kim', 'Kim'],
  ['Sơn Hạ Hỏa', 'Hỏa'],
  ['Bình Địa Mộc', 'Mộc'],
  ['Bích Thượng Thổ', 'Thổ'],
  ['Kim Bạch Kim', 'Kim'],
  ['Phúc Đăng Hỏa', 'Hỏa'],
  ['Thiên Hà Thủy', 'Thủy'],
  ['Đại Trạch Thổ', 'Thổ'],
  ['Thoa Xuyến Kim', 'Kim'],
  ['Tang Đố Mộc', 'Mộc'],
  ['Đại Khê Thủy', 'Thủy'],
  ['Sa Trung Thổ', 'Thổ'],
  ['Thiên Thượng Hỏa', 'Hỏa'],
  ['Thạch Lựu Mộc', 'Mộc'],
  ['Đại Hải Thủy', 'Thủy'],
]

export function mod(value: number, size: number): number {
  return ((value % size) + size) % size
}

/** Position of a stem/branch pair within the 60-term sexagenary cycle. */
export function sexagenaryIndex(stem: number, branch: number): number {
  return mod(stem * 6 - branch * 5, 60)
}

export function yearPillar(lunarYear: number): Pillar {
  return { stem: mod(lunarYear + 6, 10), branch: mod(lunarYear + 8, 12) }
}

/**
 * Month pillar. Lunar month 1 always sits on the Dần branch; its stem comes
 * from ngũ hổ độn, which keys the Dần stem off the year stem.
 */
export function monthPillar(lunarMonth: number, yearStem: number): Pillar {
  const danStem = mod((yearStem % 5) * 2 + 2, 10)
  return {
    stem: mod(danStem + (lunarMonth - 1), 10),
    branch: mod(lunarMonth + 1, 12),
  }
}

/** Day pillar, defined on the unbroken 60-day cycle carried by the JDN. */
export function dayPillar(solar: SolarDate): Pillar {
  const jdn = julianDayNumber(solar)
  return { stem: mod(jdn + 9, 10), branch: mod(jdn + 1, 12) }
}

/**
 * Branch of the birth hour from a "HH:MM" clock value. The Tý hour opens at
 * 23:00 of the previous evening, so the day is offset by one hour first.
 */
export function hourBranchFromClock(clock: string): number {
  const hours = Number(clock.slice(0, 2))
  return Math.floor(mod(hours + 1, 24) / 2)
}

/** Hour pillar. The hour stem cycles twice per day off the day stem. */
export function hourPillar(dayStem: number, hourBranch: number): Pillar {
  return { stem: mod(dayStem * 2 + hourBranch, 10), branch: hourBranch }
}

export function napAm(stem: number, branch: number): NapAm {
  const [name, element] = NAP_AM[Math.floor(sexagenaryIndex(stem, branch) / 2)]
  return { name, element }
}

export function zodiacAnimal(branch: number): string {
  return ANIMALS[branch]
}

export function pillarName(pillar: Pillar): string {
  return `${STEMS[pillar.stem]} ${BRANCHES[pillar.branch]}`
}
