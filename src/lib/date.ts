export function toLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayLocalISODate(): string {
  return toLocalISODate(new Date())
}

/**
 * The calendar day an instant falls on **in Vietnam**, as `YYYY-MM-DD`.
 *
 * Unlike `toLocalISODate`, this does not read the process timezone. Server code
 * runs in UTC on Vercel, where a moment just after midnight in Vietnam still
 * belongs to the previous UTC day — so any row dated from the process clock
 * would be a day off for anyone acting late in the evening or early morning.
 * Use this wherever a date is part of the product's meaning rather than of the
 * viewer's own locale.
 */
export function toVietnamISODate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}`
}

// Year choices for a date picker's quick-jump dropdown: a generous window
// around `currentYear` (100 back for a birth date, 10 forward for a future
// plan date), always widened to include `includeYear` so a value outside the
// default window (e.g. an already-saved date decades in the past) still has
// a matching <option> instead of silently mismatching the select's display.
export function getYearOptions(currentYear: number, includeYear: number): number[] {
  const min = Math.min(currentYear - 100, includeYear)
  const max = Math.max(currentYear + 10, includeYear)
  const options: number[] = []
  for (let year = max; year >= min; year--) options.push(year)
  return options
}

// How many days a solar month actually has, so a day <select> cannot offer
// 31 February. Day 0 of the next month is the last day of this one.
export function daysInSolarMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
