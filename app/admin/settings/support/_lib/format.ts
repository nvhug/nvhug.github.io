// Display formatting for the admin support inbox (spec 014, WP-5).
//
// These helpers return structured, language-neutral values (a unit + a count) rather
// than strings, so the actual copy stays in the i18n dictionaries (FR-110) and these
// functions stay pure and unit-testable (CLAUDE.md §7) — they take no `t()` and read
// no clock internally, `now` is always a parameter.

export type RelativeUnit = 'justNow' | 'minutes' | 'hours' | 'days'

export interface RelativeTime {
  unit: RelativeUnit
  count: number
}

/** How long ago `iso` was, relative to `now`. Negative/clock-skew deltas clamp to 0. */
export function relativeTimeFrom(iso: string, now: Date): RelativeTime {
  const diffMs = Math.max(0, now.getTime() - new Date(iso).getTime())
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return { unit: 'justNow', count: 0 }
  if (diffMin < 60) return { unit: 'minutes', count: diffMin }
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return { unit: 'hours', count: diffHour }
  const diffDay = Math.floor(diffHour / 24)
  return { unit: 'days', count: diffDay }
}

export type DurationUnit = 'minutes' | 'hours' | 'days'

export interface Duration {
  unit: DurationUnit
  count: number
}

/**
 * Largest whole unit that fits a millisecond duration — used for the metrics header's
 * two median figures (FR-070). Minutes below an hour, hours below a day, days beyond.
 */
export function formatDurationMs(ms: number): Duration {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return { unit: 'minutes', count: Math.max(0, minutes) }
  const hours = Math.round(ms / 3_600_000)
  if (hours < 24) return { unit: 'hours', count: hours }
  const days = Math.round(ms / 86_400_000)
  return { unit: 'days', count: days }
}

/** A 0..1 fraction as a whole-number percentage string, e.g. 0.5 -> "50%". */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}
