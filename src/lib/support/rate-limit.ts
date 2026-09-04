// Rate-limit arithmetic for the support endpoints (spec 014, FR-100/101).
// Pure only. The counting query against the database — "how many rows exist
// since this timestamp" — belongs to service.ts; this module never reads or
// writes anything, it only does the window/threshold math.

/**
 * FR-100.
 *
 * `messagesPerMinute` was 30, which made the per-minute cap almost decorative:
 * the daily AI fuse is 40 (`claim_support_ai`), so 30/min let a user burn a
 * whole day's AI budget in about two minutes. And running the fuse out does not
 * simply stop — it escalates the conversation to a human (FR-041), so the brake
 * that exists to protect the operator was converting a burst into work for
 * them, and locking that user out of the assistant on the way.
 *
 * 8/min spreads 40 calls over at least five minutes. A person typing by hand
 * never reaches it: a real exchange waits several seconds for each reply, so
 * four or five messages a minute is already a fast conversation.
 */
export const RATE_LIMITS = {
  messagesPerMinute: 8,
  conversationsPerHour: 6,
}

/**
 * Returns the start of a rolling window of `ms` milliseconds ending at `now`.
 * `service.ts` counts rows with `created_at >= windowStart(now, ms)`.
 */
export function windowStart(now: Date, ms: number): Date {
  return new Date(now.getTime() - ms)
}

/**
 * Whether `recentCount` rows already in the window means the next action must
 * be blocked. The limit itself counts as over: a count of exactly `limit`
 * means `limit` actions have already happened in the window, so the action
 * that would make it `limit + 1` is refused. This matches the plan's
 * send-message sequence ("over 60s >= 30 -> 429"): at most `limit` actions are
 * allowed per window, never `limit + 1`.
 */
export function isOverLimit(recentCount: number, limit: number): boolean {
  return recentCount >= limit
}
