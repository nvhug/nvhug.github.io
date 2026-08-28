import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { seedDashboardPhase } from './seed-account'

const USER = '9f8c1b2a-3d4e-4f56-8a7b-0c1d2e3f4a5b'

type Insert = { table: string; rows: Record<string, unknown>[] }

interface StubOptions {
  /** Rows the claim UPDATE reports back. `[]` means the account was already seeded. */
  claimed?: { id: string }[]
  /** Table whose insert should fail. */
  failInsertOn?: string
  /** Make the claim itself throw, simulating a dead connection. */
  claimThrows?: boolean
  /** Id the `goals` insert reports back. */
  goalId?: string
  /** Make the `goals` insert come back with no usable id. */
  goalsReturnNoId?: boolean
}

/**
 * Minimal stand-in for the service-role client: records every insert so a test
 * can assert what the seeder wrote, and can be told to fail at one specific
 * point. Chainable like the real builder.
 */
function makeAdminStub(options: StubOptions = {}) {
  const {
    claimed = [{ id: USER }],
    failInsertOn,
    claimThrows,
    goalId = 'goal-1',
    goalsReturnNoId = false,
  } = options
  const inserts: Insert[] = []

  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {}
      let pending: Promise<{ data: unknown; error: unknown }> = Promise.resolve({
        data: null,
        error: null,
      })

      builder.update = () => builder
      builder.eq = () => builder
      builder.is = () => builder

      builder.insert = (rows: Record<string, unknown>[]) => {
        inserts.push({ table, rows })
        pending =
          failInsertOn === table
            ? Promise.resolve({ data: null, error: { message: `insert into ${table} failed` } })
            : Promise.resolve({
                data:
                  table === 'goals' && !goalsReturnNoId
                    ? // Deliberately REVERSED: PostgreSQL does not promise that
                      // INSERT ... RETURNING comes back in input order, so the
                      // seeder must find its goal by title. Returning the rows
                      // backwards is what proves it does.
                      rows
                        .map((row, i) => ({ id: i === 0 ? goalId : `other-goal-${i}`, title: row.title }))
                        .reverse()
                    : null,
                error: null,
              })
        return builder
      }

      builder.select = () => {
        if (table === 'user_profiles') {
          pending = claimThrows
            ? Promise.reject(new Error('connection lost'))
            : Promise.resolve({ data: claimed, error: null })
        }
        return builder
      }

      builder.then = (
        resolve: (value: { data: unknown; error: unknown }) => void,
        reject: (reason: unknown) => void,
      ) => pending.then(resolve, reject)

      return builder
    },
  }

  return { admin: client as unknown as SupabaseClient, inserts }
}

function insertedInto(inserts: Insert[], table: string) {
  return inserts.find((entry) => entry.table === table)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('seedDashboardPhase — the one-time claim (FR-002)', () => {
  it('reports that it won the claim on a fresh account', async () => {
    const { admin } = makeAdminStub()
    await expect(seedDashboardPhase(admin, USER)).resolves.toBe(true)
  })

  it('writes nothing and reports false when the account is already seeded', async () => {
    const { admin, inserts } = makeAdminStub({ claimed: [] })
    await expect(seedDashboardPhase(admin, USER)).resolves.toBe(false)
    expect(inserts).toHaveLength(0)
  })
})

describe('seedDashboardPhase — what it writes (FR-001a, FR-008)', () => {
  it('inserts the dashboard tables and leaves the copied-content tables alone', async () => {
    const { admin, inserts } = makeAdminStub()
    await seedDashboardPhase(admin, USER)

    const written = inserts.map((entry) => entry.table)
    for (const table of [
      'notes',
      'todos',
      'buy_picks',
      'gym_logs',
      'weight_logs',
      'goals',
      'goal_items',
      'calendar_events',
    ]) {
      expect(written).toContain(table)
    }
    for (const table of ['posts', 'tags', 'post_tags', 'quotes', 'meals']) {
      expect(written).not.toContain(table)
    }
  })

  it('attaches the inserted goal id to the goal items (FR-008a)', async () => {
    const { admin, inserts } = makeAdminStub({ goalId: 'the-first-goal' })
    await seedDashboardPhase(admin, USER)

    const items = insertedInto(inserts, 'goal_items')
    expect(items?.rows.length).toBeGreaterThan(0)
    for (const row of items!.rows) {
      expect(row.goal_id).toBe('the-first-goal')
      expect(row.user_id).toBe(USER)
    }
  })

  it('skips the goal items rather than writing orphans when no goal id comes back', async () => {
    const { admin, inserts } = makeAdminStub({ goalsReturnNoId: true })
    await seedDashboardPhase(admin, USER)
    expect(insertedInto(inserts, 'goal_items')).toBeUndefined()
  })
})

describe('seedDashboardPhase — a failure never reaches the caller (FR-004, FR-004a)', () => {
  it('resolves instead of throwing when one table fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin } = makeAdminStub({ failInsertOn: 'weight_logs' })
    await expect(seedDashboardPhase(admin, USER)).resolves.not.toThrow()
  })

  it('still writes the other tables when one fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, inserts } = makeAdminStub({ failInsertOn: 'weight_logs' })
    await seedDashboardPhase(admin, USER)
    expect(insertedInto(inserts, 'notes')).toBeDefined()
    expect(insertedInto(inserts, 'calendar_events')).toBeDefined()
  })

  it('resolves instead of throwing when the claim itself dies', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin } = makeAdminStub({ claimThrows: true })
    await expect(seedDashboardPhase(admin, USER)).resolves.toBe(false)
  })
})

describe('seedDashboardPhase — failure logging (FR-004b)', () => {
  it('logs the account id and the failing table, so a partial seed is diagnosable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin } = makeAdminStub({ failInsertOn: 'weight_logs' })
    await seedDashboardPhase(admin, USER)

    expect(spy).toHaveBeenCalled()
    const logged = spy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(logged).toContain(USER)
    expect(logged).toContain('weight_logs')
  })

  it('logs nothing on a clean run', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin } = makeAdminStub()
    await seedDashboardPhase(admin, USER)
    expect(spy).not.toHaveBeenCalled()
  })
})
