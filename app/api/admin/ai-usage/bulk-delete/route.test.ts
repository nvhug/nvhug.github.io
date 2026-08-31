import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetUser,
  mockProfile,
  mockCreateSupabaseServerClient,
  mockCreateClient,
  deleteCalls,
  deleteResult,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn(async () => ({ data: { user: { id: 'admin-1' } } }))
  const mockProfile = { role: 'admin' as string | null }
  const mockProfileBuilder = {
    select: () => mockProfileBuilder,
    eq: () => mockProfileBuilder,
    maybeSingle: async () => ({ data: { role: mockProfile.role }, error: null }),
  }
  const mockCreateSupabaseServerClient = vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: () => mockProfileBuilder,
  }))

  const deleteCalls: { table: string; ids: string[] }[] = []
  // Rows the mocked delete() actually "finds" and removes — set per-test to simulate
  // full success, partial success, or a database error.
  const deleteResult = { returnedIds: [] as string[], error: null as { message: string } | null }
  const mockCreateClient = vi.fn(() => ({
    from: (table: string) => ({
      delete: () => ({
        in: (_col: string, ids: string[]) => {
          deleteCalls.push({ table, ids })
          return {
            select: async () => ({
              data: deleteResult.error ? null : deleteResult.returnedIds.map((id) => ({ id })),
              error: deleteResult.error,
            }),
          }
        },
      }),
    }),
  }))

  return { mockGetUser, mockProfile, mockCreateSupabaseServerClient, mockCreateClient, deleteCalls, deleteResult }
})

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

import { POST } from './route'

const ID_A = '3f1c2b7a-9d4e-4a51-8b0c-6e2d7f9a1c34'
const ID_B = 'a1b2c3d4-e5f6-4789-a012-3456789abcde'

function call(body: unknown) {
  return POST(
    new Request('http://localhost/api/admin/ai-usage/bulk-delete', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  )
}

describe('POST /api/admin/ai-usage/bulk-delete', () => {
  beforeEach(() => {
    deleteCalls.length = 0
    deleteResult.returnedIds = []
    deleteResult.error = null
    mockProfile.role = 'admin'
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  it('deletes every requested row and reports them all as deleted', async () => {
    deleteResult.returnedIds = [ID_A, ID_B]

    const response = await call({ ids: [ID_A, ID_B] })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deletedIds: [ID_A, ID_B], failedIds: [] })
    expect(deleteCalls).toEqual([{ table: 'ai_usage_log', ids: [ID_A, ID_B] }])
  })

  it('reports an id Postgres did not find as failed, alongside the ones it deleted', async () => {
    deleteResult.returnedIds = [ID_A] // ID_B did not exist / was already gone

    const response = await call({ ids: [ID_A, ID_B] })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deletedIds: [ID_A], failedIds: [ID_B] })
  })

  it('rejects a non-admin caller with 403 and deletes nothing', async () => {
    mockProfile.role = 'user'

    const response = await call({ ids: [ID_A] })

    expect(response.status).toBe(403)
    expect(deleteCalls).toHaveLength(0)
  })

  it('rejects a signed-out caller with 403 and deletes nothing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as never)

    const response = await call({ ids: [ID_A] })

    expect(response.status).toBe(403)
    expect(deleteCalls).toHaveLength(0)
  })

  it('rejects an empty ids array with 400 before touching the table', async () => {
    const response = await call({ ids: [] })

    expect(response.status).toBe(400)
    expect(deleteCalls).toHaveLength(0)
  })

  it('rejects a non-array ids field with 400', async () => {
    const response = await call({ ids: ID_A })

    expect(response.status).toBe(400)
    expect(deleteCalls).toHaveLength(0)
  })

  it('rejects a request over the page-size cap with 400 before touching the table', async () => {
    const tooMany = Array.from({ length: 16 }, () => ID_A)

    const response = await call({ ids: tooMany })

    expect(response.status).toBe(400)
    expect(deleteCalls).toHaveLength(0)
  })

  // Same reasoning as the single-row route: a malformed id would otherwise reach
  // PostgREST as a 22P02 cast error and surface as an opaque 500.
  it('rejects a request containing a non-uuid id with 400 before touching the table', async () => {
    const response = await call({ ids: [ID_A, 'not-a-uuid'] })

    expect(response.status).toBe(400)
    expect(deleteCalls).toHaveLength(0)
  })

  it('reports a database failure as 500, distinct from a 200 with failedIds', async () => {
    deleteResult.error = { message: 'boom' }

    const response = await call({ ids: [ID_A] })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'boom' })
  })
})
