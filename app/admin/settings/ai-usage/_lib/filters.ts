// Raw-log filtering helpers. Pure functions only — the query itself stays in page.tsx,
// where the Supabase client lives.

import { MODEL_PRICES, KNOWN_UNPRICED, MODEL_SUFFIX_PATTERN } from '@/lib/ai-pricing'

/**
 * Every model this app can serve, priced or knowingly unpriced. Not a `SELECT DISTINCT`
 * over `ai_usage_log`: `ai-pricing.ts` is already the authoritative registry an unlisted
 * served model would fail loudly against (see `computeCostUsd`), so this list satisfies
 * "every model that has ever appeared" (FR-002) without a new query or a period scope.
 */
export const MODEL_FILTER_OPTIONS: string[] = [
  ...new Set([...Object.keys(MODEL_PRICES), ...KNOWN_UNPRICED]),
].sort()

/**
 * Whether every id in `pageIds` is present in `selectedIds` — the single definition of
 * "this page is fully selected", shared by the header checkbox's own display (UsageLog)
 * and the click handler that decides what it toggles to (page.tsx's toggleAllRows), so the
 * two can never desync into a checkbox that looks checked but toggles as if it weren't.
 * Membership, not a size comparison: a same-size selection left over from a different page
 * or filter is not "this page, fully selected".
 */
export function isFullySelected(pageIds: string[], selectedIds: Set<string>): boolean {
  return pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
}

/**
 * Escapes ILIKE's own wildcard characters — `%` (any run), `_` (any one character) — and
 * its escape character `\`, so a literal occurrence in admin-typed search text (an
 * underscore is common in emails) is matched literally instead of read as a wildcard.
 */
export function escapeIlikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ai-pricing.ts's own suffix pattern, minus its trailing `$` anchor, so it can be reused
// as an optional group here — its leading `-` is kept, since that's what makes a served
// id's suffix (e.g. "-002") read as "-002" and not "002" against the canonical model.
const SUFFIX_BODY = MODEL_SUFFIX_PATTERN.source.slice(0, -1)

/**
 * A Postgres-regex (`~` / `.filter(col, 'match', ...)`) pattern matching every served
 * model id that prices to `canonicalModel` — the exact id, or that id plus a recognized
 * point-release suffix. Exact `.eq()` on `model` would miss real rows for any model a
 * provider answers with a suffixed id (FR-002's "every model" chip must not silently
 * exclude the app's highest-spend surface). Anchored on both ends so a canonical model
 * that is itself a string-prefix of a *different*, separately-priced model (e.g.
 * `deepseek-v4-flash` vs. `deepseek-v4-flash-vision-exp`) never over-matches.
 */
export function modelFilterPattern(canonicalModel: string): string {
  return `^${escapeRegExp(canonicalModel)}(${SUFFIX_BODY})?$`
}

/**
 * Vietnam has a fixed UTC+7 offset with no daylight saving, so a calendar day's UTC
 * boundary is a constant shift — no timezone-table lookup needed (same assumption
 * `ai-pricing.ts`'s peak-hour windows already make).
 */
function vnDateOnlyToUtcInstant(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00+07:00`).getTime()
}

/**
 * Narrows `period` to the intersection with an optional explicit VN calendar-day range
 * (FR-005/FR-006: the date filter is one more AND'd constraint on top of the existing
 * 7/30/90-day period, never a replacement for it). `dateTo` is inclusive of that whole
 * day, so the returned upper bound is the start of the *next* VN day — consistent with
 * the half-open `[from, to)` convention `periodBounds()` already uses.
 */
export function intersectLogDateBounds(
  period: { from: string; to: string },
  range: { dateFrom: string | null; dateTo: string | null }
): { from: string; to: string } {
  // Neither `<DatePicker>` constrains the other's range, so a "From" picked after "To" is
  // reachable from the UI. Normalizing here means an inverted pick still narrows the log
  // to the intended days, rather than silently returning zero rows with no indication the
  // range itself was backwards.
  const { dateFrom, dateTo } =
    range.dateFrom && range.dateTo && range.dateFrom > range.dateTo
      ? { dateFrom: range.dateTo, dateTo: range.dateFrom }
      : range

  let fromMs = new Date(period.from).getTime()
  let toMs = new Date(period.to).getTime()

  if (dateFrom) {
    fromMs = Math.max(fromMs, vnDateOnlyToUtcInstant(dateFrom))
  }
  if (dateTo) {
    const nextDayMs = vnDateOnlyToUtcInstant(dateTo) + 24 * 60 * 60 * 1000
    toMs = Math.min(toMs, nextDayMs)
  }

  // An explicit day and the period bound can each be individually valid and still not
  // overlap (e.g. a `dateTo` from before the period was narrowed to a more recent one) —
  // the two Math.max/min above narrow independently and don't themselves guarantee
  // from <= to. Collapsing to an empty-but-valid range beats handing the query an
  // inverted one, which some clients treat as "unbounded" rather than "matches nothing".
  if (fromMs > toMs) toMs = fromMs

  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() }
}
