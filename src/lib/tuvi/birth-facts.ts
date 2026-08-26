// The birth data as the reader entered it, formatted for the screen.
//
// Kept out of the page so its edge cases — a leap lunar month, a Tý hour that
// straddles midnight, no birth hour at all — are testable without rendering
// anything.
import { solarToLunar, type LunarDate } from '../lunar-calendar'
import type { HoroscopeProfile } from '../horoscope-profile'
import { BRANCHES, hourBranchFromClock } from './can-chi'

export type BirthFacts = {
  solar: string
  lunar: string
  /** Null when no birth hour was given, which is the case FR-016 asks the screen
      to say out loud rather than let pass as an ordinary blank. */
  hour: { clock: string; branch: string } | null
}

/** `1990-06-15` → `15/06/1990`. */
export function formatSolarDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

/** `23/5/1990`, with `N` marking a leap month — a different month from the
    regular one of the same number, so it cannot be left unwritten. Day and month
    stay unpadded, as a lunar date conventionally is written. */
export function formatLunarDate(lunar: LunarDate): string {
  return `${lunar.day}/${lunar.month}${lunar.isLeapMonth ? 'N' : ''}/${lunar.year}`
}

export function birthFacts(profile: HoroscopeProfile): BirthFacts {
  const [year, month, day] = profile.birthDateSolar.split('-').map(Number)

  // Derived from the solar date, never read from profile.birthDateLunar: that
  // field is browser-writable, and a stored lunar date disagreeing with the
  // solar one would put a date on screen that the reading was not built from.
  const lunar = solarToLunar({ day, month, year })

  const known = !profile.birthTimeUnknown && profile.birthTime
  return {
    solar: formatSolarDate(profile.birthDateSolar),
    lunar: formatLunarDate(lunar),
    hour: known
      ? { clock: profile.birthTime as string, branch: BRANCHES[hourBranchFromClock(profile.birthTime as string)] }
      : null,
  }
}
