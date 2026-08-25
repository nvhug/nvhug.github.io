// Solar (Gregorian) → Vietnamese lunar calendar conversion.
// Pure, offline computation (Ho Ngoc Duc's public-domain astronomical algorithm,
// timezone-adjusted for Vietnam/UTC+7) — no external API call needed. See
// specs/005-tu-vi-onboarding/research.md (Decision 2) for why this approach was chosen.

const VN_TIMEZONE = 7
const DEG_TO_RAD = Math.PI / 180

export type SolarDate = { day: number; month: number; year: number }
export type LunarDate = { day: number; month: number; year: number; isLeapMonth: boolean }

function jdFromDate({ day, month, year }: SolarDate): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  let jd =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  if (jd < 2299161) {
    jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083
  }
  return jd
}

function newMoonJd(k: number): number {
  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * DEG_TO_RAD)

  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3

  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * DEG_TO_RAD) + 0.0021 * Math.sin(2 * DEG_TO_RAD * M)
  c1 -= 0.4068 * Math.sin(Mpr * DEG_TO_RAD) - 0.0161 * Math.sin(DEG_TO_RAD * 2 * Mpr)
  c1 -= 0.0004 * Math.sin(DEG_TO_RAD * 3 * Mpr)
  c1 += 0.0104 * Math.sin(DEG_TO_RAD * 2 * F) - 0.0051 * Math.sin(DEG_TO_RAD * (M + Mpr))
  c1 -= 0.0074 * Math.sin(DEG_TO_RAD * (M - Mpr)) - 0.0004 * Math.sin(DEG_TO_RAD * (2 * F + M))
  c1 -= 0.0004 * Math.sin(DEG_TO_RAD * (2 * F - M)) + 0.0006 * Math.sin(DEG_TO_RAD * (2 * F + Mpr))
  c1 += 0.001 * Math.sin(DEG_TO_RAD * (2 * F - Mpr)) + 0.0005 * Math.sin(DEG_TO_RAD * (2 * Mpr + M))

  const deltaT =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2

  return jd1 + c1 - deltaT
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525
  const T2 = T * T
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let deltaL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(DEG_TO_RAD * M)
  deltaL += (0.019993 - 0.000101 * T) * Math.sin(DEG_TO_RAD * 2 * M) + 0.00029 * Math.sin(DEG_TO_RAD * 3 * M)
  let L = (L0 + deltaL) * DEG_TO_RAD
  L -= Math.PI * 2 * Math.floor(L / (Math.PI * 2))
  return Math.floor(((L / Math.PI) * 180) / 30)
}

function getNewMoonDay(k: number): number {
  return Math.floor(newMoonJd(k) + 0.5 + VN_TIMEZONE / 24)
}

function getSunLongitude(dayNumber: number): number {
  return sunLongitude(dayNumber - 0.5 - VN_TIMEZONE / 24)
}

function getLunarMonth11(year: number): number {
  const off = jdFromDate({ day: 31, month: 12, year }) - 2415021
  const k = Math.floor(off / 29.530588853)
  let nm = getNewMoonDay(k)
  if (getSunLongitude(nm) >= 9) {
    nm = getNewMoonDay(k - 1)
  }
  return nm
}

function getLeapMonthOffset(a11: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let i = 1
  let last = getSunLongitude(getNewMoonDay(k + i))
  let arc = last
  do {
    last = arc
    i++
    arc = getSunLongitude(getNewMoonDay(k + i))
  } while (arc !== last && i < 14)
  return i - 1
}

export function solarToLunar(date: SolarDate): LunarDate {
  const dayNumber = jdFromDate(date)
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = getNewMoonDay(k + 1)
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k)
  }

  let a11 = getLunarMonth11(date.year)
  let b11 = a11
  let lunarYear: number
  if (a11 >= monthStart) {
    lunarYear = date.year
    a11 = getLunarMonth11(date.year - 1)
  } else {
    lunarYear = date.year + 1
    b11 = getLunarMonth11(date.year + 1)
  }

  const lunarDay = dayNumber - monthStart + 1
  const diff = Math.floor((monthStart - a11) / 29)
  let isLeapMonth = false
  let lunarMonth = diff + 11

  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11)
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10
      isLeapMonth = diff === leapMonthDiff
    }
  }

  if (lunarMonth > 12) {
    lunarMonth -= 12
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1
  }

  return { day: lunarDay, month: lunarMonth, year: lunarYear, isLeapMonth }
}

// Julian Day Number for a solar date. Exposed because the tu vi day pillar
// (can chi of the day) runs on an unbroken 60-day cycle defined on the JDN,
// independent of lunar months. See src/lib/tuvi/can-chi.ts.
export function julianDayNumber(date: SolarDate): number {
  return jdFromDate(date)
}

/** Inverse of jdFromDate: a Julian Day Number back to a Gregorian date. */
function jdToDate(jd: number): SolarDate {
  let a: number
  let b: number
  let c: number
  if (jd > 2299160) {
    a = jd + 32044
    b = Math.floor((4 * a + 3) / 146097)
    c = a - Math.floor((b * 146097) / 4)
  } else {
    b = 0
    c = jd + 32082
  }
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  const day = e - Math.floor((153 * m + 2) / 5) + 1
  const month = m + 3 - 12 * Math.floor(m / 10)
  const year = b * 100 + d - 4800 + Math.floor(m / 10)
  return { day, month, year }
}

/**
 * Inverse of solarToLunar. Returns { day: 0, month: 0, year: 0 } when the
 * input claims a leap month that lunarYear does not actually have — the
 * caller (isValidLunarBirthDate) treats that sentinel as invalid input
 * rather than a real date.
 */
export function lunarToSolar(lunar: LunarDate): SolarDate {
  const { day, month, year, isLeapMonth } = lunar

  let a11: number
  let b11: number
  if (month < 11) {
    a11 = getLunarMonth11(year - 1)
    b11 = getLunarMonth11(year)
  } else {
    a11 = getLunarMonth11(year)
    b11 = getLunarMonth11(year + 1)
  }

  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853)
  let off = month - 11
  if (off < 0) off += 12

  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11)
    let leapMonth = leapOff - 2
    if (leapMonth < 0) leapMonth += 12
    if (isLeapMonth && month !== leapMonth) {
      return { day: 0, month: 0, year: 0 }
    } else if (isLeapMonth || off >= leapOff) {
      off += 1
    }
  }

  const monthStart = getNewMoonDay(k + off)
  return jdToDate(monthStart + day - 1)
}
