import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveAIAccess } from './ai-trial'

type TableResult = { data: unknown; error: unknown }

/** Chainable stub: every call returns itself, and it resolves like a real query result. */
function makeBuilder(result: TableResult) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    maybeSingle: async () => result,
    then: (resolve: (value: TableResult) => void, reject: (reason: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

function makeSupabase(responses: Record<string, TableResult>) {
  return {
    from: (table: string) => makeBuilder(responses[table] ?? { data: null, error: null }),
  } as unknown as SupabaseClient
}

describe('resolveAIAccess', () => {
  it('is unlimited for admin/paid roles regardless of usage', async () => {
    const supabase = makeSupabase({})
    const access = await resolveAIAccess(supabase, 'u1', 'food_analyze', 'admin')
    expect(access).toEqual({ allowed: true, used: 0, limit: 270, unlimited: true })
  })

  it('allows a user role under the trial limit', async () => {
    const supabase = makeSupabase({
      ai_trial_usage: { data: { used_count: 5 }, error: null },
    })
    const access = await resolveAIAccess(supabase, 'u1', 'food_analyze', 'user')
    expect(access).toEqual({ allowed: true, used: 5, limit: 270, unlimited: false })
  })

  it('blocks a user role past the trial limit with no upgrade request', async () => {
    const supabase = makeSupabase({
      ai_trial_usage: { data: { used_count: 270 }, error: null },
      upgrade_requests: { data: [], error: null },
    })
    const access = await resolveAIAccess(supabase, 'u1', 'food_analyze', 'user')
    expect(access).toEqual({ allowed: false, used: 270, limit: 270, unlimited: false })
  })

  it('bypasses the block for a first-time pending upgrade request', async () => {
    const supabase = makeSupabase({
      ai_trial_usage: { data: { used_count: 270 }, error: null },
      upgrade_requests: { data: [{ status: 'pending' }], error: null },
    })
    const access = await resolveAIAccess(supabase, 'u1', 'food_analyze', 'user')
    expect(access.allowed).toBe(true)
  })

  it('keeps the block once a request has been rejected, even if a new one is pending', async () => {
    const supabase = makeSupabase({
      ai_trial_usage: { data: { used_count: 270 }, error: null },
      upgrade_requests: { data: [{ status: 'pending' }, { status: 'rejected' }], error: null },
    })
    const access = await resolveAIAccess(supabase, 'u1', 'food_analyze', 'user')
    expect(access.allowed).toBe(false)
  })
})
