// The three time cycles a reading reports on: the decade-long Đại vận, the
// lunar year (Lưu niên) and the lunar month (Lưu nguyệt).
//
// Đại vận needs the chart to anchor to, so it is unresolved when the birth hour
// is unknown; the other two depend only on today's date and still report.
// Spans are returned structured — the UI decides the wording and the language.
import { solarToLunar, type SolarDate } from '../lunar-calendar'
import type { HoroscopeProfile } from '../horoscope-profile'
import { BRANCHES, STEMS, mod, monthPillar, yearPillar } from './can-chi'
import { birthMoment } from './birth-moment'
import { runsForward } from './build-chart'
import type { Chart, Cycle } from './types'

const DECADE = 10

/** Traditional Vietnamese age: the count starts at one in the birth year. */
export function lunarAge(birthLunarYear: number, currentLunarYear: number): number {
  return currentLunarYear - birthLunarYear + 1
}

/**
 * Which palace governs the Đại vận decade covering a given age — the same
 * count-by-decades-from-Mệnh rule `daiVan()` uses for "now", generalised to
 * any age so a fixed later-life age (see scoring.ts's "Hậu vận") can be
 * projected without waiting for the person to actually reach it.
 * Null before the first Đại vận opens (age below the cục's own number).
 */
export function daiVanPalaceAtAge(
  menhIndex: number,
  cucNumber: number,
  forward: boolean,
  age: number,
): number | null {
  if (age < cucNumber) return null
  const steps = Math.floor((age - cucNumber) / DECADE)
  return mod(menhIndex + (forward ? steps : -steps), 12)
}

function daiVan(profile: HoroscopeProfile, chart: Chart, currentLunarYear: number): Cycle {
  if (chart.menhIndex === null || !chart.cuc) {
    return { key: 'daiVan', name: null, span: { kind: 'needHour' }, palaceIndex: null }
  }

  // Same resolved moment the chart was built from, so a late-Tý birth on the
  // last day of a lunar year is reckoned in the year the chart used.
  const birthLunarYear = birthMoment(profile).lunar.year
  const age = lunarAge(birthLunarYear, currentLunarYear)
  const forward = runsForward(yearPillar(birthLunarYear).stem, profile.gender)

  // The first Đại vận opens at the age given by the cục. Someone younger than
  // that has not entered any decade yet, so the first one is reported as
  // upcoming rather than as the decade they are currently living.
  if (age < chart.cuc.number) {
    // No palace index: the person is not living any Đại vận yet, so nothing
    // should be inked as current, and the overall score must not average the
    // Mệnh palace with itself.
    return {
      key: 'daiVan',
      name: chart.palaces[chart.menhIndex].name,
      span: { kind: 'ageFrom', from: chart.cuc.number },
      palaceIndex: null,
    }
  }

  const palaceIndex = daiVanPalaceAtAge(chart.menhIndex, chart.cuc.number, forward, age)!
  const steps = Math.floor((age - chart.cuc.number) / DECADE)
  const fromAge = chart.cuc.number + steps * DECADE

  return {
    key: 'daiVan',
    name: chart.palaces[palaceIndex].name,
    span: { kind: 'ageRange', from: fromAge, to: fromAge + DECADE - 1 },
    palaceIndex,
  }
}

function luuNien(currentLunarYear: number): Cycle {
  const { stem, branch } = yearPillar(currentLunarYear)
  return {
    key: 'luuNien',
    name: `${STEMS[stem]} ${BRANCHES[branch]}`,
    span: { kind: 'lunarYear', year: currentLunarYear },
    palaceIndex: branch,
  }
}

function luuNguyet(currentLunarYear: number, currentLunarMonth: number, leap: boolean): Cycle {
  const pillar = monthPillar(currentLunarMonth, yearPillar(currentLunarYear).stem)
  return {
    key: 'luuNguyet',
    name: `${STEMS[pillar.stem]} ${BRANCHES[pillar.branch]}`,
    span: { kind: 'lunarMonth', month: currentLunarMonth, leap },
    palaceIndex: pillar.branch,
  }
}

export function buildCycles(
  profile: HoroscopeProfile,
  chart: Chart,
  todaySolar: SolarDate,
): Cycle[] {
  const todayLunar = solarToLunar(todaySolar)
  return [
    daiVan(profile, chart, todayLunar.year),
    luuNien(todayLunar.year),
    luuNguyet(todayLunar.year, todayLunar.month, todayLunar.isLeapMonth),
  ]
}
