// Resolves the date an an sao chart is actually built from.
//
// The Tý hour opens at 23:00 and belongs to the day that is *starting*, so a
// birth at 23:00-23:59 is reckoned on the following day. Without this roll the
// hour branch would say Tý (the new day) while the lunar day still said the old
// one, putting Tử Vi — which is placed from the lunar day — one palace off.
import { solarToLunar, type LunarDate, type SolarDate } from '../lunar-calendar'
import type { HoroscopeProfile } from '../horoscope-profile'
import { hourBranchFromClock } from './can-chi'

export type BirthMoment = {
  solar: SolarDate
  lunar: LunarDate
  hourBranch: number | null
}

const LATE_TY_HOUR = 23

function nextDay(solar: SolarDate): SolarDate {
  const date = new Date(Date.UTC(solar.year, solar.month - 1, solar.day + 1))
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  }
}

export function birthMoment(profile: HoroscopeProfile): BirthMoment {
  const [year, month, day] = profile.birthDateSolar.split('-').map(Number)
  const solar = { day, month, year }

  // The lunar date is always derived from the validated solar date rather than
  // read from the profile: profile_data is browser-writable, and a stored lunar
  // date that disagrees with the solar one would silently shift the whole chart.
  if (profile.birthTimeUnknown || !profile.birthTime) {
    return { solar, lunar: solarToLunar(solar), hourBranch: null }
  }

  const hourBranch = hourBranchFromClock(profile.birthTime)
  if (Number(profile.birthTime.slice(0, 2)) < LATE_TY_HOUR) {
    return { solar, lunar: solarToLunar(solar), hourBranch }
  }

  const rolled = nextDay(solar)
  return { solar: rolled, lunar: solarToLunar(rolled), hourBranch }
}
