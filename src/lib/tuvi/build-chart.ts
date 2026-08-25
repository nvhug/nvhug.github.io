// Assembles a lá số from a saved horoscope profile.
//
// The birth hour drives Mệnh, Thân, the cục and therefore every chính tinh. When
// the profile records the hour as unknown, this returns the hour-independent
// layer only — the twelve branches with their Can Chi, the stars placed from the
// birth year and month, and Tuần/Triệt — and leaves everything hour-derived out
// rather than defaulting to midnight. A guessed hour would produce a confident
// but wrong chart (spec FR-009, FR-016, FR-017, FR-019b).
import type { HoroscopeProfile } from '../horoscope-profile'
import { birthMoment } from './birth-moment'
import { mod, yearPillar } from './can-chi'
import { cuc, majorStars, menhPalace, palaceStem, thanPalace, tuViPalace } from './chart'
import {
  branchStars,
  fourTransforms,
  hoaLinhStars,
  hourStars,
  monthStars,
  stemStars,
  trangSinh,
  trietBranches,
  tuanBranches,
} from './stars'
import type { Chart, Palace, Star } from './types'

// Palace names read forward (thuận) from Mệnh around the twelve branches.
const PALACE_NAMES = [
  'Mệnh', 'Huynh Đệ', 'Phu Thê', 'Tử Tức', 'Tài Bạch', 'Tật Ách',
  'Thiên Di', 'Nô Bộc', 'Quan Lộc', 'Điền Trạch', 'Phúc Đức', 'Phụ Mẫu',
] as const

/**
 * Tràng Sinh and Đại vận both run forward for a yang man or a yin woman, and
 * backward otherwise. The tradition is binary; a profile that records neither
 * follows the same branch as "nam" so the chart stays computable and stable.
 */
export function runsForward(yearStem: number, gender: HoroscopeProfile['gender']): boolean {
  const isYangYear = yearStem % 2 === 0
  return gender === 'nu' ? !isYangYear : isYangYear
}

export function buildChart(profile: HoroscopeProfile): Chart {
  const moment = birthMoment(profile)
  const lunar = moment.lunar
  const hourBranch = moment.hourBranch
  const year = yearPillar(lunar.year)

  const menhIndex = hourBranch === null ? null : menhPalace(lunar.month, hourBranch)
  const thanIndex = hourBranch === null ? null : thanPalace(lunar.month, hourBranch)
  const cucValue = menhIndex === null ? null : cuc(menhIndex, year.stem)

  // Chính tinh, the hour-placed phụ tinh and the Tràng Sinh cycle all need the
  // hour; the rest of the layout does not.
  const major = cucValue === null ? null : majorStars(tuViPalace(cucValue.number, lunar.day))
  const supporting: Record<string, number> = {
    ...monthStars(lunar.month),
    ...stemStars(year.stem),
    ...branchStars(year.branch),
    ...(hourBranch === null
      ? {}
      : { ...hourStars(hourBranch), ...hoaLinhStars(year.branch, hourBranch) }),
  }
  const stages =
    cucValue === null ? null : trangSinh(cucValue.number, runsForward(year.stem, profile.gender))

  const transforms = fourTransforms(year.stem)
  const tuan = tuanBranches(year.stem, year.branch)
  const triet = trietBranches(year.stem)

  const palaces: Palace[] = Array.from({ length: 12 }, (_, index) => {
    const stars: Star[] = (major?.[index] ?? []).map((name) => ({
      name,
      kind: 'chinh',
      transform: transforms[name],
    }))

    for (const [name, position] of Object.entries(supporting)) {
      if (position !== index) continue
      stars.push({ name, kind: 'phu', transform: transforms[name] })
    }

    return {
      index,
      name: menhIndex === null ? null : PALACE_NAMES[mod(index - menhIndex, 12)],
      pillar: { stem: palaceStem(index, year.stem), branch: index },
      stars,
      trangSinh: stages?.[index] ?? null,
      tuan: tuan.includes(index),
      triet: triet.includes(index),
      isMenh: index === menhIndex,
      isThan: index === thanIndex,
      isDaiVan: false,
    }
  })

  return { palaces, menhIndex, thanIndex, cuc: cucValue, hourKnown: hourBranch !== null }
}
