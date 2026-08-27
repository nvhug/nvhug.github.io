// Display formatting for the AI usage page.
//
// Kept out of the components because two of these rules are correctness rules, not
// cosmetics: an unpriced figure must never look like a free one, and a Vietnamese page must
// not put "." in two opposite meanings on the same tile.

import { usdToVnd } from '@/lib/ai-pricing'

/**
 * Token counts. No suffix below 10,000 so small figures stay exact; K then M above, where
 * the extra digits are noise.
 */
export function formatTokens(n: number): string {
  if (n < 10_000) return n.toLocaleString('en-US')
  if (n < 1_000_000) return `${Math.round(n / 1_000).toLocaleString('en-US')}K`
  return `${(n / 1_000_000).toFixed(1)}M`
}

/**
 * VND, Vietnamese-style. USD renders US-style elsewhere, and the two must never sit
 * adjacent without their currency marker: "$13.02" beside "338.500 ₫" puts "." in two
 * opposite meanings one line apart, on a page whose readers use the second one.
 */
export function formatVnd(usd: number): string {
  return `${usdToVnd(usd).toLocaleString('vi-VN')} ₫`
}

/**
 * Whether a figure is a lower bound rather than a total.
 *
 * Cost sums exclude calls whose model has no price, so any figure computed from a set
 * containing one is "at least this much" (FR-010a). The UI must say so; the alternative is
 * an authoritative-looking number that under-reports real spend.
 */
export function isLowerBound(unpricedCalls: number): boolean {
  return unpricedCalls > 0
}

/** A day bucket's axis label: "26/8". Short because 90 of them share one axis. */
export function formatDayShort(isoDay: string): string {
  const [, month, day] = isoDay.split('-')
  return `${Number(day)}/${Number(month)}`
}

/** Full timestamp for the raw log, in the page's one timezone. */
export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** A row's share of a total, guarding the empty-period divide-by-zero. */
export function share(value: number, total: number): number {
  return total > 0 ? value / total : 0
}

export function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(fraction < 0.1 ? 1 : 0)}%`
}
