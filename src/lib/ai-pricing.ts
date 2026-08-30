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
  // Free tier (spec 010, FR-008/FR-010/FR-011): input/output/cache are all "Free of
  // charge" on ai.google.dev today, verified 2026-08-30. When Google retires the free
  // tier or this project moves to a billed Gemini tier, replace the zeros below with the
  // real paid rate ($0.75 / $3.75 per 1M input/output, introductory through 2026-12-31,
  // doubling after per the same note already on gemini-3.6-flash above) and bump
  // PRICING_VERSION.
  'gemini-3.7-flash': { cachedInput: 0, input: 0, output: 0, peakMultiplier: false },
  // Same free-tier note as above. Paid rate to switch to: $0.30 / $2.50 per 1M input/output.
  'gemini-3.1-flash-lite': { cachedInput: 0, input: 0, output: 0, peakMultiplier: false },
}

/**
 * Models we knowingly do not price, so a miss can be told apart from an oversight. Anything
 * absent from both this set and MODEL_PRICES means the table needs updating.
 */
export const KNOWN_UNPRICED = new Set<string>(['gpt-4o-mini', 'google/gemini-3.6-flash'])

/**
 * Maps a served model id onto a price-table key.
 *
 * Providers answer with point-release ids the table does not carry: ask Gemini for
 * `gemini-3.6-flash` and its response reports `gemini-3.6-flash-002`. Indexing the table
 * with the served id would therefore miss on every Gemini call and record NULL cost for the
 * most expensive surface in the product — a $0 report for real spend.
 *
 * Order: exact match, then the id with a point-release/date/preview suffix stripped, then
 * the model that was requested. `null` when none of those is priced.
 */
export function resolvePriceKey(servedModel: string, requestedModel?: string): string | null {
  const stripped = servedModel.replace(
    /-(\d{3,4}|latest|preview|exp|preview-\d{2}-\d{2}|\d{4}-\d{2}-\d{2})$/,
    ''
  )
  for (const candidate of [servedModel, stripped, requestedModel]) {
    // Object.hasOwn, never a bare index: `MODEL_PRICES['constructor']` resolves through the
    // prototype chain to a truthy non-price, and the arithmetic below then yields NaN, which
    // JSON-serialises to null while pricing_version stays set — violating the table's
    // cost-and-version-together CHECK and losing the entire row, not just its cost. `model`
    // is provider-controlled text, so this is reachable.
    if (candidate && Object.hasOwn(MODEL_PRICES, candidate)) return candidate
  }
  return null
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
export function computeCostUsd(
  tokens: TokenCounts,
  model: string,
  at: Date,
  requestedModel?: string
): number | null {
  const key = resolvePriceKey(model, requestedModel)
  if (key === null) {
    if (!KNOWN_UNPRICED.has(model)) {
      // Loud on purpose. Otherwise the only signal that a model is unpriced is a count on a
      // dashboard, and by then the bill has already arrived.
      console.error(`[ai-pricing] no price for model "${model}" — add it to MODEL_PRICES`)
    }
    return null
  }
  const price = MODEL_PRICES[key]

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
 * Adaptive precision, because cost here spans five orders of magnitude: a single cache-hit
 * call is around 0.000002 USD while a 90-day total can be tens of dollars.
 *
 * The invariant, and the thing worth testing: a non-zero cost NEVER formats to all-zero
 * digits. Any string of zeros reads as "this was free", which is the same false claim
 * FR-010 forbids the storage layer from making.
 */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return '—'
  const fmt = (d: number) =>
    `$${usd.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`

  if (usd === 0 || usd >= 0.01) return fmt(2)

  // Scale the digit count to the magnitude rather than bucketing at one cent. A fixed four
  // decimals looked adaptive but rendered 0.0000021 as "$0.0000" — the same false "this was
  // free" claim that two decimals makes, which is the failure this function exists to avoid.
  // Below the display floor, say so with a bound rather than with zeros.
  const digits = 1 - Math.floor(Math.log10(Math.abs(usd)))
  if (digits > 10) return '< $0.0000000001'
  return fmt(digits)
}

/**
 * Aggregate contexts — tiles, breakdown totals — want a floor, not precision. A quiet week
 * reading "$0.0083" in 30px type is noise where "< $0.01" is the answer.
 */
export function formatUsdAggregate(usd: number): string {
  if (!Number.isFinite(usd)) return '—'
  if (usd > 0 && usd < 0.01) return '< $0.01'
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Whole dong. At this rate a single cheap call is worth about 2 VND and a cached one
 * rounds to 0, which is why VND belongs on aggregates and not on individual log rows.
 */
export function usdToVnd(usd: number): number {
  return Math.round(usd * USD_TO_VND)
}
