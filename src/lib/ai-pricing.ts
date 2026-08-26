// AI provider pricing — the only place rates live, and the only place cost is computed.
//
// Cost is computed here at WRITE time and stored on the usage row, never derived on read:
// a later price change must not retroactively rewrite what past calls cost.
//
// Rates verified against official provider documentation on 2026-08-26:
//   DeepSeek — https://api-docs.deepseek.com/quick_start/pricing
//   Gemini   — https://ai.google.dev/gemini-api/docs/pricing
// Re-check both when PRICING_VERSION is bumped.

/**
 * Bump this whenever any rate below changes. Every usage row stores the version that
 * produced its cost, so "why was this call costed at this amount" stays answerable
 * months later once rates have moved.
 */
export const PRICING_VERSION = '2026-08-26'

/**
 * USD -> VND. A fixed constant on purpose: reporting AI spend does not justify an FX
 * call per page load, and a rate that is a few percent stale is fine for a cost
 * overview. Update alongside PRICING_VERSION.
 */
export const USD_TO_VND = 26_000

export interface ModelPrice {
  /** USD per 1M input tokens that were served from cache. Null when the provider has no cache tier. */
  cachedInput: number | null
  /** USD per 1M input tokens not served from cache. */
  input: number
  /** USD per 1M output tokens, reasoning included. */
  output: number
  /**
   * Whether this provider doubles its rates during peak hours. DeepSeek does; Gemini
   * does not. See isPeakHour for the window.
   */
  peakMultiplier: boolean
}

/**
 * Off-peak rates, USD per 1M tokens. A model absent from this table has NO price, which
 * is not the same as a price of zero — see computeCostUsd.
 *
 * NOTE on gemini-3.6-flash: 0.75 / 3.75 is *introductory* pricing that expires
 * 2026-12-31. From 2027-01-01 the standard rate is 1.50 / 7.50 — double. Update this
 * table then, so the increase is discovered here rather than on an invoice.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'deepseek-v4-flash': { cachedInput: 0.007, input: 0.22, output: 0.66, peakMultiplier: true },
  'deepseek-v4-pro': { cachedInput: 0.022, input: 0.66, output: 1.98, peakMultiplier: true },
  'deepseek-v4-flash-vision-exp': { cachedInput: 0.007, input: 0.22, output: 0.66, peakMultiplier: true },
  'gemini-3.6-flash': { cachedInput: null, input: 0.75, output: 3.75, peakMultiplier: false },
}

/**
 * DeepSeek peak hours: 01:00-04:00 and 06:00-10:00 UTC, Monday to Friday, during which
 * rates are double the off-peak rates in MODEL_PRICES.
 *
 * Windows are half-open — `[start, end)` — for the same reason period bounds are: two
 * adjacent windows must neither overlap nor leave a gap. So 01:00:00 is peak and
 * 04:00:00 is not.
 */
export function isPeakHour(at: Date): boolean {
  const day = at.getUTCDay() // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return false

  const hour = at.getUTCHours()
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)
}

export interface TokenCounts {
  /** Total input tokens, of which `cached` were served from cache. */
  input: number
  /** Subset of `input` served from cache — never an addition to it. */
  cached: number
  /** Billed output tokens, reasoning included. */
  output: number
}

/**
 * Cost of one provider call in USD, or `null` when the model has no known price.
 *
 * `null` is load-bearing and must not be collapsed to 0 anywhere downstream: a zero
 * claims the call was free, while null says we cannot price it yet. An aggregate
 * containing a null is a lower bound, not a total.
 *
 * A priced model that reported no tokens correctly returns 0 — a provider that refused
 * before generating anything really did cost nothing.
 */
export function computeCostUsd(tokens: TokenCounts, model: string, at: Date): number | null {
  const price = MODEL_PRICES[model]
  if (!price) return null

  // A provider with no cache tier bills cached tokens at the ordinary input rate rather
  // than for free.
  const cachedRate = price.cachedInput ?? price.input
  const cached = Math.min(tokens.cached, tokens.input)
  const uncached = tokens.input - cached

  const perMillion =
    (cached / 1e6) * cachedRate + (uncached / 1e6) * price.input + (tokens.output / 1e6) * price.output

  const multiplier = price.peakMultiplier && isPeakHour(at) ? 2 : 1
  return perMillion * multiplier
}

/**
 * Adaptive precision, because cost on this page spans five orders of magnitude: a single
 * cache-hit call is around 0.000002 USD while a 90-day total can be tens of dollars.
 * Formatting everything at two decimals — the reflex — renders every per-call figure as
 * "$0.00" and makes the raw log useless.
 */
export function formatUsd(usd: number): string {
  const digits = usd > 0 && usd < 0.01 ? 4 : 2
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

/**
 * Whole dong. At this rate a single cheap call is worth about 2 VND and a cached one
 * rounds to 0, which is why VND belongs on aggregates and not on individual log rows.
 */
export function usdToVnd(usd: number): number {
  return Math.round(usd * USD_TO_VND)
}
