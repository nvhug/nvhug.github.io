export function toLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayLocalISODate(): string {
  return toLocalISODate(new Date())
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
