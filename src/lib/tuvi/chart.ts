// An sao: placing the tu vi stars into the twelve palaces.
// Every rule here is pure modular arithmetic over branch indices 0..11
// (Tý = 0 … Hợi = 11); the Dần palace, index 2, is the counting origin for
// several of them, as it is in the traditional method.
import { mod, napAm } from './can-chi'
import type { Cuc, Element } from './types'

const DAN = 2

const CUC_BY_ELEMENT: Record<Element, { number: number; name: string }> = {
  Thủy: { number: 2, name: 'Thủy nhị cục' },
  Mộc: { number: 3, name: 'Mộc tam cục' },
  Kim: { number: 4, name: 'Kim tứ cục' },
  Thổ: { number: 5, name: 'Thổ ngũ cục' },
  Hỏa: { number: 6, name: 'Hỏa lục cục' },
}

/**
 * Stem of an arbitrary palace, continuing ngũ hổ độn forward from Dần. The
 * branch offset is wrapped first: Tý and Sửu come at the END of the loop that
 * starts at Dần, not two steps before it.
 */
export function palaceStem(palace: number, yearStem: number): number {
  const danStem = mod((yearStem % 5) * 2 + 2, 10)
  return mod(danStem + mod(palace - DAN, 12), 10)
}

/** Count forward from Dần to the birth month, then backward to the birth hour. */
export function menhPalace(lunarMonth: number, hourBranch: number): number {
  return mod(DAN + (lunarMonth - 1) - hourBranch, 12)
}

/** Count forward from Dần to the birth month, then forward again to the hour. */
export function thanPalace(lunarMonth: number, hourBranch: number): number {
  return mod(DAN + (lunarMonth - 1) + hourBranch, 12)
}

/** The cycle number comes from the nạp âm element of the Mệnh palace itself. */
export function cuc(menhIndex: number, yearStem: number): Cuc {
  const { element } = napAm(palaceStem(menhIndex, yearStem), menhIndex)
  return { element, ...CUC_BY_ELEMENT[element] }
}

/**
 * Tử Vi. Divide the lunar day by the cycle number, rounding up; the remainder
 * borrowed to reach a whole multiple moves the star forward when even and
 * backward when odd.
 */
export function tuViPalace(cucNumber: number, lunarDay: number): number {
  const quotient = Math.ceil(lunarDay / cucNumber)
  const borrowed = cucNumber * quotient - lunarDay
  const offset = borrowed % 2 === 0 ? borrowed : -borrowed
  return mod(DAN + (quotient - 1) + offset, 12)
}

// Offsets from Tử Vi, counted backward around the palaces.
const TU_VI_SERIES: ReadonlyArray<readonly [string, number]> = [
  ['Tử Vi', 0],
  ['Thiên Cơ', -1],
  ['Thái Dương', -3],
  ['Vũ Khúc', -4],
  ['Thiên Đồng', -5],
  ['Liêm Trinh', -8],
]

// Offsets from Thiên Phủ, counted forward.
const THIEN_PHU_SERIES: ReadonlyArray<readonly [string, number]> = [
  ['Thiên Phủ', 0],
  ['Thái Âm', 1],
  ['Tham Lang', 2],
  ['Cự Môn', 3],
  ['Thiên Tướng', 4],
  ['Thiên Lương', 5],
  ['Thất Sát', 6],
  ['Phá Quân', 10],
]

/** Thiên Phủ mirrors Tử Vi across the Dần–Thân axis. */
export function thienPhuPalace(tuVi: number): number {
  return mod(4 - tuVi, 12)
}

/** The fourteen major stars, indexed by palace. */
export function majorStars(tuVi: number): string[][] {
  const palaces: string[][] = Array.from({ length: 12 }, () => [])
  const thienPhu = thienPhuPalace(tuVi)

  for (const [name, offset] of TU_VI_SERIES) {
    palaces[mod(tuVi + offset, 12)].push(name)
  }
  for (const [name, offset] of THIEN_PHU_SERIES) {
    palaces[mod(thienPhu + offset, 12)].push(name)
  }
  return palaces
}
