import type { SupabaseClient } from '@supabase/supabase-js'
import { isAIFreeModeEnabled } from './ai-free-mode'
import { MONETIZATION_ENABLED } from './monetization'

// Free trial limits per feature (~3 months of typical usage):
//   notes_analyze:     1/week × 12 weeks
//   food_analyze:      3/day  × 90 days
//   stock_analyze:     ~3 tickers/month × 3 months
//   stock_suggestions: ~5/month × 3 months
//
// ADDING A NEW AI FEATURE? It must get an entry here, or it will have no quota at
// all — neither a cost brake today nor a paywall if MONETIZATION_ENABLED is ever
// switched back on. This table is the checklist; see ADR-017.
export const AI_TRIAL_LIMITS = {
  notes_analyze: 12,
  food_analyze: 270,
  stock_analyze: 9,
  stock_suggestions: 15,
} as const

export type AIFeature = keyof typeof AI_TRIAL_LIMITS

export type TrialQuotaResult =
  | { allowed: true; unlimited: true; used?: never; limit?: never; remaining?: never }
  | { allowed: true; unlimited?: false; used: number; limit: number; remaining: number }
  | { allowed: false; unlimited?: false; used: number; limit: number }

/**
 * Check whether a user may use an AI feature.
 * - admin / paid: always allowed (unlimited)
 * - user: allowed until the free trial limit is reached
 */
export async function checkAITrialQuota(
  supabase: SupabaseClient,
  userId: string,
  feature: AIFeature,
  role: string,
): Promise<TrialQuotaResult> {
  if (role === 'admin' || role === 'paid') {
    return { allowed: true, unlimited: true }
  }

  if (await isAIFreeModeEnabled(supabase)) {
    return { allowed: true, unlimited: true }
  }

  const { data } = await supabase
    .from('ai_trial_usage')
    .select('used_count')
    .eq('user_id', userId)
    .eq('feature', feature)
    .maybeSingle()

  const used = (data?.used_count as number | null) ?? 0
  const limit = AI_TRIAL_LIMITS[feature]

  if (used < limit) {
    return { allowed: true, used, limit, remaining: limit - used }
  }
  return { allowed: false, used, limit }
}

/**
 * Full access decision for an AI feature: trial quota plus the "pending upgrade,
 * no rejection yet" bypass. Single source of truth for both the enforcement path
 * (the route that actually spends money) and any client-facing status check, so
 * the two can never disagree.
 */
export async function resolveAIAccess(
  supabase: SupabaseClient,
  userId: string,
  feature: AIFeature,
  role: string,
): Promise<{ allowed: boolean; used: number; limit: number; unlimited: boolean }> {
  const quota = await checkAITrialQuota(supabase, userId, feature, role)
  if (quota.allowed) {
    return {
      allowed: true,
      used: quota.used ?? 0,
      limit: quota.limit ?? AI_TRIAL_LIMITS[feature],
      unlimited: !!quota.unlimited,
    }
  }

  // The bypass exists so someone who has already transferred money isn't locked out
  // while an admin approves by hand. With monetization off nobody can file a request,
  // so skip the round-trip entirely.
  if (!MONETIZATION_ENABLED) {
    return { allowed: false, used: quota.used, limit: quota.limit, unlimited: false }
  }

  const { data: requests } = await supabase
    .from('upgrade_requests')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['pending', 'rejected'])
  const statuses = (requests ?? []).map((r: { status: string }) => r.status)
  const hasPending = statuses.includes('pending')
  const hasRejected = statuses.includes('rejected')
  const bypassed = hasPending && !hasRejected

  return { allowed: bypassed, used: quota.used, limit: quota.limit, unlimited: false }
}

/**
 * Atomically increment a user's usage count for a feature.
 * Uses a SECURITY DEFINER RPC to bypass RLS.
 */
export async function incrementAITrialUsage(
  supabase: SupabaseClient,
  feature: AIFeature,
): Promise<void> {
  const { error } = await supabase.rpc('increment_ai_trial_usage', {
    p_feature: feature,
  })
  if (error) {
    console.error(`[ai-trial] increment failed for ${feature}:`, error.message)
  }
}

/**
 * HTTP status for an exhausted quota.
 *
 * 402 Payment Required only when something can actually be bought. With
 * monetization off the cap is a plain rate limit, so it answers 429 — nothing is
 * for sale and the status code should not imply otherwise. Clients accept both.
 */
export const QUOTA_EXHAUSTED_STATUS = MONETIZATION_ENABLED ? 402 : 429

/** Standard response body when a user's quota is exhausted. */
export function trialExhaustedBody(
  feature: AIFeature,
  used: number,
  limit: number,
  lang: 'vi' | 'en' = 'vi',
) {
  const msg = MONETIZATION_ENABLED
    ? lang === 'en'
      ? `Free trial exhausted (${used}/${limit} uses). Please upgrade to Pro to continue using this feature.`
      : `Đã dùng hết ${used}/${limit} lượt dùng thử miễn phí. Vui lòng nâng cấp lên gói Pro để tiếp tục.`
    : // No "come back later" — this cap is lifetime, not a daily reset, so promising
      // a refill would be a lie. Nothing is for sale either; an admin grants more.
      lang === 'en'
      ? `You've used all ${used}/${limit} free runs for this feature.`
      : `Bạn đã dùng hết ${used}/${limit} lượt miễn phí của tính năng này.`
  return { error: msg, trialExhausted: true, feature, used, limit }
}
