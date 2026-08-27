// AI usage recording — the only writer to ai_usage_log.
//
// Two rules govern everything here:
//   1. Telemetry never changes the outcome of the request it observes. Every failure is
//      swallowed, and the insert is bounded so a slow database cannot push a route past
//      its maxDuration.
//   2. No prompt or response content is ever recorded. Counts and metadata only. This
//      table is readable by every admin and these surfaces carry meal photographs, birth
//      data and private notes — see CLAUDE.md and spec 007 FR-014a.

import { getServiceSupabaseClient } from '@/lib/supabase-admin'
import { computeCostUsd, PRICING_VERSION } from '@/lib/ai-pricing'

/** The six AI surfaces recorded, matching the CHECK constraint in sql/54.ai_usage_log.sql. */
export const SURFACES = [
  'notes_analyze',
  'food_analyze',
  'stock_analyze',
  'stock_suggestions',
  'tuvi_interpret',
  'tuvi_palaces',
] as const

export type Surface = (typeof SURFACES)[number]
export type UsageProvider = 'deepseek' | 'gemini' | 'openai' | 'openrouter'

/**
 * How long the usage insert is allowed to take. Deliberately tiny next to a provider
 * timeout (tu-vi/palaces allows the model 50s inside a 60s ceiling): when the database is
 * slower than this, dropping one telemetry row is the right trade against risking the
 * user's request. Awaited rather than fire-and-forget because a serverless function can
 * freeze once the response is sent, and this is cost data.
 */
export const TELEMETRY_TIMEOUT_MS = 1_000

export interface NormalizedUsage {
  input_tokens: number
  /** Subset of input_tokens. */
  cached_input_tokens: number
  /** Billed output, reasoning included. */
  output_tokens: number
  /** Subset of output_tokens. */
  reasoning_tokens: number
}

/** Coerces anything to a non-negative integer; anything unusable becomes 0. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/**
 * Maps a provider's usage payload onto the four token fields.
 *
 * The two providers have OPPOSITE reasoning-token semantics, and getting it backwards is
 * silent — the numbers stay plausible, only smaller:
 *
 *   DeepSeek: `completion_tokens` already includes reasoning. `completion_tokens_details`
 *             is a breakdown of it. Adding reasoning again double-counts.
 *   Gemini:   `candidatesTokenCount` excludes `thoughtsTokenCount`, but thoughts ARE
 *             billed as output. Omitting them undercounts the bill.
 *
 * As a guard against exactly that class of mistake, the result is reconciled against the
 * provider's own reported total and a mismatch is warned about rather than shipped
 * quietly.
 *
 * Never throws: a malformed payload is clamped to something the schema accepts and warned
 * about. Telemetry must not be able to fail a user's AI request.
 */
export function normalizeUsage(raw: unknown, provider: UsageProvider): NormalizedUsage {
  const u = (raw ?? {}) as Record<string, unknown>

  let input: number
  let cached: number
  let output: number
  let reasoning: number
  let reportedTotal: number

  if (provider === 'gemini') {
    input = count(u.promptTokenCount)
    cached = count(u.cachedContentTokenCount)
    reasoning = count(u.thoughtsTokenCount)
    output = count(u.candidatesTokenCount) + reasoning
    reportedTotal = count(u.totalTokenCount)
  } else {
    input = count(u.prompt_tokens)
    // Two spellings, because `UsageProvider` has four members and they do not agree:
    // DeepSeek reports `prompt_cache_hit_tokens`, OpenAI and OpenRouter report
    // `prompt_tokens_details.cached_tokens`. Reading only the first made two of the four
    // providers record zero cached tokens on every call — which costs nothing today only
    // because their models are unpriced, and becomes a ~10x over-report the moment they are
    // priced. The token reconciliation below cannot catch it: cached is a subset of input,
    // so input + output still matches the provider's total.
    const promptDetails = (u.prompt_tokens_details ?? {}) as Record<string, unknown>
    cached = count(u.prompt_cache_hit_tokens) || count(promptDetails.cached_tokens)
    output = count(u.completion_tokens)
    const details = (u.completion_tokens_details ?? {}) as Record<string, unknown>
    reasoning = count(details.reasoning_tokens)
    reportedTotal = count(u.total_tokens)
  }

  // Clamp rather than reject: the row still tells the truth about the call having
  // happened, and the schema's CHECK constraints would otherwise refuse the insert.
  if (cached > input) {
    console.warn(`[ai-usage] ${provider}: cached input ${cached} exceeds input ${input}; clamping`)
    cached = input
  }
  if (reasoning > output) {
    console.warn(`[ai-usage] ${provider}: reasoning ${reasoning} exceeds output ${output}; clamping`)
    reasoning = output
  }

  if (reportedTotal > 0 && input + output !== reportedTotal) {
    console.warn(
      `[ai-usage] ${provider}: token mapping may be wrong — input+output=${input + output} ` +
        `but the provider reported total=${reportedTotal}`
    )
  }

  return {
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_tokens: reasoning,
  }
}

/**
 * The model the provider says it SERVED, falling back to what was requested.
 *
 * Cost must be attributed to what was actually billed: a requested id can be an alias, or
 * retired, and the response is the only authority on what ran.
 */
export function servedModel(raw: unknown, requested: string): string {
  const body = (raw ?? {}) as Record<string, unknown>
  for (const key of ['model', 'modelVersion']) {
    const value = body[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return requested
}

export interface LogAiUsageParams {
  surface: Surface
  provider: UsageProvider
  /** The model actually served — pass the result of servedModel(). */
  model: string
  usage: NormalizedUsage
  outcome: 'success' | 'error'
  /** Null for a scheduled job, or when the caller has no signed-in user. */
  userId: string | null
  /** 'system' for a scheduled job, 'user' otherwise. */
  actor: 'user' | 'system'
  /** Defaults to now; injectable so pricing can be tested at a chosen instant. */
  at?: Date
}

/**
 * Records one provider API call. Returns the new row's id, or null when the insert
 * failed or timed out.
 *
 * The null return is not a formality: `notes_analyze` stores this id on
 * `ai_analysis_history.usage_log_id`, which is why that column is nullable and why saving
 * an analysis must never depend on this succeeding.
 *
 * Cost is computed here, at write time, and stored — so a later price change cannot
 * rewrite what past calls cost. An unpriced model stores NULL cost, never 0.
 */
export async function logAiUsage(params: LogAiUsageParams): Promise<string | null> {
  const at = params.at ?? new Date()
  const cost = computeCostUsd(
    {
      input: params.usage.input_tokens,
      cached: params.usage.cached_input_tokens,
      output: params.usage.output_tokens,
    },
    params.model,
    at
  )

  // A finite number or nothing. `cost === null` alone is the wrong guard: any non-finite
  // value JSON-serialises to null while pricing_version stays set, which violates the
  // table's cost-and-version-together CHECK and loses the ENTIRE row rather than just its
  // cost. The two fields are derived from one predicate so they cannot disagree.
  const priced = typeof cost === 'number' && Number.isFinite(cost)

  // AbortController rather than Promise.race against a timer. A race leaves the timer
  // running after the insert wins — holding a serverless invocation open for the remainder
  // of the timeout on every AI call — and cancels nothing when the timer wins, so the row
  // often still lands while this function has already returned null. That combination is
  // what silently breaks the usage_log_id link.
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TELEMETRY_TIMEOUT_MS)

  try {
    const { data, error } = await getServiceSupabaseClient()
      .from('ai_usage_log')
      .insert({
        user_id: params.userId,
        actor: params.actor,
        surface: params.surface,
        provider: params.provider,
        model: params.model,
        ...params.usage,
        cost_usd: priced ? cost : null,
        pricing_version: priced ? PRICING_VERSION : null,
        outcome: params.outcome,
        created_at: at.toISOString(),
      })
      .select('id')
      // Before .single(), not after: abortSignal lives on PostgrestTransformBuilder and
      // .single() narrows to PostgrestBuilder, which does not carry it.
      .abortSignal(abort.signal)
      .single()

    if (error) throw error
    return data?.id ?? null
  } catch (err) {
    // Swallowed on purpose. An unrecorded call is a gap in a dashboard; a thrown error
    // here would be a broken feature for the user.
    console.error(`[ai-usage] failed to record ${params.surface} call:`, err)
    return null
  } finally {
    clearTimeout(timer)
  }
}
