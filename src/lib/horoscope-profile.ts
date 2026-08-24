import { solarToLunar, type LunarDate } from './lunar-calendar'
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

export function isValidSolarBirthDate(value: string, today: Date): boolean {
  const match = SOLAR_DATE_RE.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  const isRealCalendarDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  if (!isRealCalendarDate) return false

  return value <= toLocalISODate(today)
}

export function buildHoroscopeProfile(input: {
  birthDateSolar: string
  birthTime: string | null
  birthTimeUnknown: boolean
  gender: Gender
  now: Date
}): HoroscopeProfile {
  const [year, month, day] = input.birthDateSolar.split('-').map(Number)

  return {
    birthDateSolar: input.birthDateSolar,
    birthDateLunar: solarToLunar({ day, month, year }),
    birthTime: input.birthTimeUnknown ? null : input.birthTime,
    birthTimeUnknown: input.birthTimeUnknown,
    gender: input.gender,
    updatedAt: input.now.toISOString(),
  }
}
