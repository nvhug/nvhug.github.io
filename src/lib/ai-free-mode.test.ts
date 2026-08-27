import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isAIFreeModeEnabled } from './ai-free-mode'

type TableResult = { data: unknown; error: unknown }

/** Chainable stub: every call returns itself, and it resolves like a real query result. */
function makeBuilder(result: TableResult) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
    then: (resolve: (value: TableResult) => void, reject: (reason: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

/** Chainable stub whose terminal call rejects, simulating a thrown/network failure. */
function makeThrowingBuilder(reason: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => {
      throw reason
    },
  }
  return builder
}

function makeSupabase(result: TableResult) {
  return {
    from: () => makeBuilder(result),
  } as unknown as SupabaseClient
}

function makeThrowingSupabase(reason: unknown) {
  return {
    from: () => makeThrowingBuilder(reason),
  } as unknown as SupabaseClient
}

describe('isAIFreeModeEnabled', () => {
  it('returns true when the row is enabled', async () => {
    const supabase = makeSupabase({ data: { enabled: true }, error: null })
    expect(await isAIFreeModeEnabled(supabase)).toBe(true)
  })

  it('returns false when the row is disabled', async () => {
    const supabase = makeSupabase({ data: { enabled: false }, error: null })
    expect(await isAIFreeModeEnabled(supabase)).toBe(false)
  })

  it('fails closed when the query returns an error', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'boom' } })
    expect(await isAIFreeModeEnabled(supabase)).toBe(false)
  })

  it('fails closed when the row is missing', async () => {
    const supabase = makeSupabase({ data: null, error: null })
    expect(await isAIFreeModeEnabled(supabase)).toBe(false)
  })

  it('fails closed when the query throws', async () => {
    const supabase = makeThrowingSupabase(new Error('network down'))
    expect(await isAIFreeModeEnabled(supabase)).toBe(false)
  })
})
