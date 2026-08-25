import { lunarToSolar, solarToLunar, type LunarDate, type SolarDate } from './lunar-calendar'
import { toLocalISODate } from './date'

export type Gender = 'nam' | 'nu' | 'khac'

export type HoroscopeProfile = {
  birthDateSolar: string
  birthDateLunar: LunarDate
  birthTime: string | null
  birthTimeUnknown: boolean
  gender: Gender
  updatedAt: string
}

const SOLAR_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** True when the string is a real date on the calendar, ignoring how long ago. */
export function isRealSolarDate(value: string): boolean {
  const match = SOLAR_DATE_RE.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function isValidSolarBirthDate(value: string, today: Date): boolean {
  if (!isRealSolarDate(value)) return false
  return value <= toLocalISODate(today)
}

function solarDateToISO(date: SolarDate): string {
  const month = String(date.month).padStart(2, '0')
  const day = String(date.day).padStart(2, '0')
  return `${date.year}-${month}-${day}`
}

/**
 * True when a lunar date both exists and doesn't lie in the future. Existence
 * is checked by round-tripping through the solar calendar and back: an
 * out-of-range day/month, or an isLeapMonth claim the lunar year doesn't
 * actually have, converts to a solar date whose own lunar reading disagrees
 * with the input (see lunarToSolar's doc comment for the two ways it can fail).
 */
export function isValidLunarBirthDate(value: LunarDate, today: Date): boolean {
  if (
    !Number.isInteger(value.day) || value.day < 1 || value.day > 30 ||
    !Number.isInteger(value.month) || value.month < 1 || value.month > 12 ||
    !Number.isInteger(value.year) || value.year < 1
  ) {
    return false
  }

  const solar = lunarToSolar(value)
  if (solar.year === 0) return false

  const roundTrip = solarToLunar(solar)
  if (
    roundTrip.day !== value.day ||
    roundTrip.month !== value.month ||
    roundTrip.year !== value.year ||
    roundTrip.isLeapMonth !== value.isLeapMonth
  ) {
    return false
  }

  return solarDateToISO(solar) <= toLocalISODate(today)
}

export function buildHoroscopeProfile(
  input: {
    birthTime: string | null
    birthTimeUnknown: boolean
    gender: Gender
    now: Date
  } & ({ birthDateSolar: string; birthDateLunar?: undefined } | { birthDateLunar: LunarDate; birthDateSolar?: undefined }),
): HoroscopeProfile {
  const birthDateSolar = input.birthDateLunar
    ? solarDateToISO(lunarToSolar(input.birthDateLunar))
    : input.birthDateSolar

  const [year, month, day] = birthDateSolar.split('-').map(Number)

  return {
    birthDateSolar,
    birthDateLunar: input.birthDateLunar ?? solarToLunar({ day, month, year }),
    birthTime: input.birthTimeUnknown ? null : input.birthTime,
    birthTimeUnknown: input.birthTimeUnknown,
    gender: input.gender,
    updatedAt: input.now.toISOString(),
  }
}

const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function isLunarDate(value: unknown): value is LunarDate {
  if (typeof value !== 'object' || value === null) return false
  const lunar = value as Record<string, unknown>

  // Integrality and range matter, not just the type: a fractional month or day
  // reaches the star tables as a fractional palace index and throws mid-render.
  const inRange = (candidate: unknown, min: number, max: number) =>
    typeof candidate === 'number' &&
    Number.isInteger(candidate) &&
    candidate >= min &&
    candidate <= max

  return (
    inRange(lunar.day, 1, 30) &&
    inRange(lunar.month, 1, 12) &&
    inRange(lunar.year, 1, 9999) &&
    typeof lunar.isLeapMonth === 'boolean'
  )
}

/**
 * Validates a profile read back out of storage. The stored JSONB is free-form,
 * so a malformed record must read as "no profile" rather than reaching the chart
 * computation, where a missing lunar date would throw mid-render.
 */
export function parseHoroscopeProfile(raw: unknown): HoroscopeProfile | null {
  if (typeof raw !== 'object' || raw === null) return null
  const value = raw as Record<string, unknown>

  // Format alone is not enough: profile_data is browser-writable JSONB, and
  // "2026-13-45" would otherwise reach the JDN arithmetic as a garbage date.
  if (typeof value.birthDateSolar !== 'string' || !isRealSolarDate(value.birthDateSolar)) {
    return null
  }
  if (!isLunarDate(value.birthDateLunar)) return null
  if (typeof value.birthTimeUnknown !== 'boolean') return null
  if (value.gender !== 'nam' && value.gender !== 'nu' && value.gender !== 'khac') return null

  // A known hour must be a zero-padded HH:MM. Anything else ("9:30") slices to a
  // NaN hour that flows all the way into the star tables as an undefined lookup.
  if (!value.birthTimeUnknown && (typeof value.birthTime !== 'string' || !CLOCK_RE.test(value.birthTime))) {
    return null
  }

  return {
    birthDateSolar: value.birthDateSolar,
    birthDateLunar: value.birthDateLunar,
    birthTime: value.birthTimeUnknown ? null : (value.birthTime as string),
    birthTimeUnknown: value.birthTimeUnknown,
    gender: value.gender,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  }
}
