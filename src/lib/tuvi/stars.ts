// Supporting stars (phụ tinh), the four transforms, the Tràng Sinh cycle and
// the Tuần / Triệt voiding markers. Each function returns branch indices so the
// caller can merge them into the palaces however it likes.
import { mod, sexagenaryIndex } from './can-chi'
import type { Transform } from './types'

export type StarPositions = Record<string, number>

/** Tả Phù counts forward from Thìn; Hữu Bật counts backward from Tuất. */
export function monthStars(lunarMonth: number): StarPositions {
  return {
    'Tả Phù': mod(4 + (lunarMonth - 1), 12),
    'Hữu Bật': mod(10 - (lunarMonth - 1), 12),
  }
}

/**
 * Văn Xương counts backward from Tuất, Văn Khúc forward from Thìn; Địa Không
 * counts backward and Địa Kiếp forward, both from Hợi.
 */
export function hourStars(hourBranch: number): StarPositions {
  return {
    'Văn Xương': mod(10 - hourBranch, 12),
    'Văn Khúc': mod(4 + hourBranch, 12),
    'Địa Không': mod(11 - hourBranch, 12),
    'Địa Kiếp': mod(11 + hourBranch, 12),
  }
}

const LOC_TON_BY_STEM = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0]

// Thiên Khôi / Thiên Việt, indexed by year stem.
const KHOI_VIET_BY_STEM: ReadonlyArray<readonly [number, number]> = [
  [1, 7], // Giáp
  [0, 8], // Ất
  [11, 9], // Bính
  [11, 9], // Đinh
  [1, 7], // Mậu
  [0, 8], // Kỷ
  [1, 7], // Canh
  [6, 2], // Tân
  [3, 5], // Nhâm
  [3, 5], // Quý
]

export function stemStars(yearStem: number): StarPositions {
  const locTon = LOC_TON_BY_STEM[yearStem]
  const [khoi, viet] = KHOI_VIET_BY_STEM[yearStem]
  return {
    'Lộc Tồn': locTon,
    'Kình Dương': mod(locTon + 1, 12),
    'Đà La': mod(locTon - 1, 12),
    'Thiên Khôi': khoi,
    'Thiên Việt': viet,
  }
}

// Four-branch groups (tam hợp), keyed by year branch.
const DAO_HOA_BY_GROUP: Record<number, number> = { 0: 9, 1: 6, 2: 3, 3: 0 }
const THIEN_MA_BY_GROUP: Record<number, number> = { 0: 2, 1: 11, 2: 8, 3: 5 }
// Seasonal groups (tam hội) for Cô Thần / Quả Tú.
const CO_QUA_BY_SEASON: ReadonlyArray<readonly [number, number]> = [
  [2, 10], // Hợi Tý Sửu
  [5, 1], // Dần Mão Thìn
  [8, 4], // Tỵ Ngọ Mùi
  [11, 7], // Thân Dậu Tuất
]

export function branchStars(yearBranch: number): StarPositions {
  const group = mod(yearBranch, 4)
  const season = Math.floor(mod(yearBranch + 1, 12) / 3)
  const [coThan, quaTu] = CO_QUA_BY_SEASON[season]
  const hongLoan = mod(3 - yearBranch, 12)
  return {
    'Đào Hoa': DAO_HOA_BY_GROUP[group],
    'Thiên Mã': THIEN_MA_BY_GROUP[group],
    'Hồng Loan': hongLoan,
    'Thiên Hỷ': mod(hongLoan + 6, 12),
    'Thiên Khốc': mod(6 - yearBranch, 12),
    'Thiên Hư': mod(6 + yearBranch, 12),
    'Cô Thần': coThan,
    'Quả Tú': quaTu,
    'Long Trì': mod(4 + yearBranch, 12),
    'Phượng Các': mod(10 - yearBranch, 12),
  }
}

// Lộc / Quyền / Khoa / Kỵ, one row per year stem.
const FOUR_TRANSFORMS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['Liêm Trinh', 'Phá Quân', 'Vũ Khúc', 'Thái Dương'], // Giáp
  ['Thiên Cơ', 'Thiên Lương', 'Tử Vi', 'Thái Âm'], // Ất
  ['Thiên Đồng', 'Thiên Cơ', 'Văn Xương', 'Liêm Trinh'], // Bính
  ['Thái Âm', 'Thiên Đồng', 'Thiên Cơ', 'Cự Môn'], // Đinh
  ['Tham Lang', 'Thái Âm', 'Hữu Bật', 'Thiên Cơ'], // Mậu
  ['Vũ Khúc', 'Tham Lang', 'Thiên Lương', 'Văn Khúc'], // Kỷ
  ['Thái Dương', 'Vũ Khúc', 'Thái Âm', 'Thiên Đồng'], // Canh
  ['Cự Môn', 'Thái Dương', 'Văn Khúc', 'Văn Xương'], // Tân
  ['Thiên Lương', 'Tử Vi', 'Tả Phù', 'Vũ Khúc'], // Nhâm
  ['Phá Quân', 'Cự Môn', 'Thái Âm', 'Tham Lang'], // Quý
]

const TRANSFORM_ORDER: Transform[] = ['loc', 'quyen', 'khoa', 'ky']

export function fourTransforms(yearStem: number): Record<string, Transform> {
  const row = FOUR_TRANSFORMS[yearStem]
  const table: Record<string, Transform> = {}
  row.forEach((star, index) => {
    table[star] = TRANSFORM_ORDER[index]
  })
  return table
}

const TRANG_SINH_STAGES = [
  'Trường Sinh', 'Mộc Dục', 'Quan Đới', 'Lâm Quan', 'Đế Vượng', 'Suy',
  'Bệnh', 'Tử', 'Mộ', 'Tuyệt', 'Thai', 'Dưỡng',
]

const TRANG_SINH_START: Record<number, number> = { 2: 8, 5: 8, 3: 11, 4: 5, 6: 2 }

/** The twelve-stage cycle, indexed by palace. Direction depends on the chart. */
export function trangSinh(cucNumber: number, forward: boolean): string[] {
  const start = TRANG_SINH_START[cucNumber]
  const cycle: string[] = Array.from({ length: 12 }, () => '')
  TRANG_SINH_STAGES.forEach((stage, step) => {
    cycle[mod(start + (forward ? step : -step), 12)] = stage
  })
  return cycle
}

/**
 * Tuần: the two branches left uncovered by the ten terms of the year's own
 * Giáp decade within the sixty-term cycle.
 */
export function tuanBranches(yearStem: number, yearBranch: number): [number, number] {
  const decadeStart = Math.floor(sexagenaryIndex(yearStem, yearBranch) / 10) * 10
  const firstBranch = mod(decadeStart, 12)
  return [mod(firstBranch + 10, 12), mod(firstBranch + 11, 12)]
}

// Triệt falls across one branch pair, keyed by the year stem's pair group.
const TRIET_BY_STEM_PAIR: ReadonlyArray<readonly [number, number]> = [
  [8, 9], // Giáp, Kỷ
  [6, 7], // Ất, Canh
  [4, 5], // Bính, Tân
  [2, 3], // Đinh, Nhâm
  [0, 1], // Mậu, Quý
]

export function trietBranches(yearStem: number): [number, number] {
  const [first, second] = TRIET_BY_STEM_PAIR[yearStem % 5]
  return [first, second]
}

// Hỏa Tinh and Linh Tinh: the starting palace comes from the year-branch triad,
// then both count forward by the birth hour.
const HOA_LINH_BY_GROUP: Record<number, readonly [number, number]> = {
  2: [1, 3], // Dần, Ngọ, Tuất — Hỏa at Sửu, Linh at Mão
  0: [2, 10], // Thân, Tý, Thìn
  1: [3, 10], // Tỵ, Dậu, Sửu
  3: [9, 10], // Hợi, Mão, Mùi
}

export function hoaLinhStars(yearBranch: number, hourBranch: number): StarPositions {
  const [hoa, linh] = HOA_LINH_BY_GROUP[mod(yearBranch, 4)]
  return {
    'Hỏa Tinh': mod(hoa + hourBranch, 12),
    'Linh Tinh': mod(linh + hourBranch, 12),
  }
}
