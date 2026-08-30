import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetUser, mockCreateSupabaseServerClient, mockDeleteUser, mockCreateClient, deletedTables } =
  vi.hoisted(() => {
    const mockGetUser = vi.fn(async () => ({ data: { user: { id: 'admin-1' } } }))
    const mockProfileBuilder = {
      select: () => mockProfileBuilder,
      eq: () => mockProfileBuilder,
      maybeSingle: async () => ({ data: { role: 'admin' }, error: null }),
    }
    const mockCreateSupabaseServerClient = vi.fn(async () => ({
      auth: { getUser: mockGetUser },
      from: () => mockProfileBuilder,
    }))

    const deletedTables: string[] = []
    const mockDeleteUser = vi.fn(async () => ({ error: null }))
    const mockCreateClient = vi.fn(() => ({
      from: (table: string) => ({
        delete: () => ({
          eq: async () => {
            deletedTables.push(table)
            return { error: null }
          },
        }),
      }),
      auth: { admin: { deleteUser: mockDeleteUser } },
    }))

    return { mockGetUser, mockCreateSupabaseServerClient, mockDeleteUser, mockCreateClient, deletedTables }
  })

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

import { DELETE } from './route'

function makeRequest() {
  return new Request('http://localhost/api/admin/users/victim-1', { method: 'DELETE' })
}

describe('DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    deletedTables.length = 0
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockDeleteUser.mockResolvedValue({ error: null })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  // Regression: posts/tags are written for every new signup by seedCopiedContent
  // (src/lib/seed-account.ts) and neither has ON DELETE CASCADE (sql/17.blog.sql),
  // so deleting a freshly-seeded account 500ed with a foreign key violation until
  // both tables were added to OWNED_TABLES.
  it('clears posts and tags before deleting the auth user', async () => {
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'victim-1' }) })

    expect(response.status).toBe(200)
    expect(deletedTables).toContain('posts')
    expect(deletedTables).toContain('tags')
    expect(mockDeleteUser).toHaveBeenCalledWith('victim-1')
  })

  it('rejects a non-admin caller with 403 and deletes nothing', async () => {
    mockCreateSupabaseServerClient.mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'user' }, error: null }) }) }),
      }),
    } as never)

    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'victim-1' }) })

    expect(response.status).toBe(403)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('refuses to let an admin delete their own account', async () => {
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'admin-1' }) })

    expect(response.status).toBe(400)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('returns 500 if clearing an owned table fails', async () => {
    mockCreateClient.mockReturnValueOnce({
      from: (table: string) => ({
        delete: () => ({
          eq: async () =>
            table === 'notes' ? { error: { message: 'db error' } } : { error: null },
        }),
      }),
      auth: { admin: { deleteUser: mockDeleteUser } },
    } as never)

    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'victim-1' }) })

    expect(response.status).toBe(500)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })
})
