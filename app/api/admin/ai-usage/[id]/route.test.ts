import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetUser, mockProfile, mockCreateSupabaseServerClient, mockCreateClient, deleteCalls, deleteResult } =
  vi.hoisted(() => {
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

    const deleteCalls: { table: string; id: string }[] = []
    const deleteResult = { error: null as { message: string } | null }
    const mockCreateClient = vi.fn(() => ({
      from: (table: string) => ({
        delete: () => ({
          eq: async (_col: string, id: string) => {
            deleteCalls.push({ table, id })
            return { error: deleteResult.error }
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

import { DELETE } from './route'

const ROW_ID = '3f1c2b7a-9d4e-4a51-8b0c-6e2d7f9a1c34'

function call(id: string) {
  return DELETE(new Request(`http://localhost/api/admin/ai-usage/${id}`, { method: 'DELETE' }), {
    params: Promise.resolve({ id }),
  })
}

describe('DELETE /api/admin/ai-usage/[id]', () => {
  beforeEach(() => {
    deleteCalls.length = 0
    deleteResult.error = null
    mockProfile.role = 'admin'
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  it('deletes the one log row an admin asked for', async () => {
    const response = await call(ROW_ID)

    expect(response.status).toBe(200)
    expect(deleteCalls).toEqual([{ table: 'ai_usage_log', id: ROW_ID }])
  })

  it('rejects a non-admin caller with 403 and deletes nothing', async () => {
    mockProfile.role = 'user'

    const response = await call(ROW_ID)

    expect(response.status).toBe(403)
    expect(deleteCalls).toHaveLength(0)
  })

  it('rejects a signed-out caller with 403 and deletes nothing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as never)

    const response = await call(ROW_ID)

    expect(response.status).toBe(403)
    expect(deleteCalls).toHaveLength(0)
  })

  // A malformed id reaches PostgREST as a 22P02 cast error, which would surface to the
  // admin as an opaque 500 rather than "that is not an id".
  it('rejects a non-uuid id with 400 before touching the table', async () => {
    const response = await call('not-a-uuid')

    expect(response.status).toBe(400)
    expect(deleteCalls).toHaveLength(0)
  })

  it('reports a database failure as 500', async () => {
    deleteResult.error = { message: 'boom' }

    const response = await call(ROW_ID)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'boom' })
  })
})
