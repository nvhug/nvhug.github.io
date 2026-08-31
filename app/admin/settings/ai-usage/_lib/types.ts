// Shapes returned by the ai_usage_report RPC, mirroring
// specs/007-ai-usage-dashboard/contracts/ai-usage-report.md.
//
// Every token field name matches its ai_usage_log column exactly, so there is only one
// spelling of each concept between the database and the screen.

export const PERIODS = [7, 30, 90] as const
export type PeriodDays = (typeof PERIODS)[number]

/**
 * Raw-log page size, and also bulk delete's cap (FR-015): a bulk delete never reaches
 * beyond one loaded page. Shared with the server route so the enforcement point and the
 * UI's page size can never drift apart.
 */
export const LOG_PAGE_SIZE = 15

export type Surface =
  | 'notes_analyze'
  | 'food_analyze'
  | 'stock_analyze'
  | 'stock_suggestions'
  | 'tuvi_interpret'
  | 'tuvi_palaces'

/** Figures shared by the summary and by every breakdown row. */
export interface UsageFigures {
  calls: number
  input_tokens: number
  /** A subset of input_tokens. Never added to a total. */
  cached_input_tokens: number
  /** Billed output, reasoning included. */
  output_tokens: number
  /** A subset of output_tokens. Never added to a total. */
  reasoning_tokens: number
  /** Sum of priced calls only — see unpriced_calls before presenting it as a total. */
  cost_usd: number
  /** Rows whose cost could not be computed. Non-zero makes cost_usd a lower bound. */
  unpriced_calls: number
}

export interface UsageSummary extends UsageFigures {
  unpriced_models: string[]
  active_users: number
  failed_calls: number
  failed_cost_usd: number
}

export interface SurfaceRow extends UsageFigures {
  surface: Surface
}

export interface ModelRow extends UsageFigures {
  provider: string
  model: string
}

export interface UserRow extends UsageFigures {
  /** Null for the system actor, and for the collapsed deleted-accounts group. */
  user_id: string | null
  actor: 'user' | 'system'
}

export interface DayRow extends UsageFigures {
  /** YYYY-MM-DD in Asia/Ho_Chi_Minh. Dense: every day in the period is present. */
  day: string
}

export interface UsageReport {
  summary: UsageSummary
  by_surface: SurfaceRow[]
  by_model: ModelRow[]
  by_user: UserRow[]
  daily: DayRow[]
}

export interface LogRow {
  id: string
  user_id: string | null
  actor: 'user' | 'system'
  surface: Surface
  provider: string
  model: string
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  /** Null means the model has no price, which is NOT the same as free. */
  cost_usd: number | null
  outcome: 'success' | 'error'
  created_at: string
}

/**
 * Which account a row belongs to, as one value the UI can switch on.
 *
 * `user_id` alone cannot express this: null means "deleted account" when the actor is a
 * user and "scheduled job" when it is the system, and those must never share a row or a
 * label. Drill-down uses the same three cases.
 */
export type ActorScope =
  | { kind: 'user'; userId: string }
  | { kind: 'deleted' }
  | { kind: 'system' }

export function actorScopeOf(row: { user_id: string | null; actor: 'user' | 'system' }): ActorScope {
  if (row.actor === 'system') return { kind: 'system' }
  if (row.user_id === null) return { kind: 'deleted' }
  return { kind: 'user', userId: row.user_id }
}

export function sameScope(a: ActorScope, b: ActorScope): boolean {
  if (a.kind !== b.kind) return false
  return a.kind !== 'user' || a.userId === (b as { userId: string }).userId
}

/** A row's total. Cached and reasoning are subsets and are never part of this sum. */
export function totalTokens(f: Pick<UsageFigures, 'input_tokens' | 'output_tokens'>): number {
  return f.input_tokens + f.output_tokens
}

export const EMPTY_SUMMARY: UsageSummary = {
  calls: 0,
  input_tokens: 0,
  cached_input_tokens: 0,
  output_tokens: 0,
  reasoning_tokens: 0,
  cost_usd: 0,
  unpriced_calls: 0,
  unpriced_models: [],
  active_users: 0,
  failed_calls: 0,
  failed_cost_usd: 0,
}
