import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { seedCopiedContent } from './seed-account'
import { HEALTH_TAG_NAME, SOURCE_POST_TITLES } from './default-account-data'

const USER = '9f8c1b2a-3d4e-4f56-8a7b-0c1d2e3f4a5b'

type Insert = { table: string; rows: Record<string, unknown>[] }

/**
 * A source post as it comes back from the owner's account. `isPublic` is here
 * only so a test can prove the seeder ignores it — the source lookup no longer
 * selects that column at all.
 */
function sourcePost(title: string, slug: string, isPublic = true) {
  return {
    id: `src-${slug}`,
    title,
    slug,
    content: `body of ${title}`,
    excerpt: 'x',
    is_public: isPublic,
  }
}

const ALL_SOURCE_POSTS = [
  ...SOURCE_POST_TITLES.health.map((t, i) => sourcePost(t, `health-${i}`)),
  ...SOURCE_POST_TITLES.blog.map((t, i) => sourcePost(t, `blog-${i}`)),
]

const ALL_SOURCE_QUOTES = [
  { id: 'q1', content: 'Đời người như dòng nước, chảy mãi không ngừng', author: 'A' },
  { id: 'q2', content: 'Hoa nở một mùa, người sống một kiếp', author: 'B' },
  { id: 'q3', content: 'Hạnh phúc không phải là điều sẵn có', author: null },
]

interface StubOptions {
  posts?: ReturnType<typeof sourcePost>[]
  quotes?: typeof ALL_SOURCE_QUOTES
  /** An existing "Sức Khỏe" tag already owned by this account. */
  existingTagId?: string
  /** Table whose insert should fail. */
  failInsertOn?: string
  /** Make the posts lookup reject outright. */
  postsSelectThrows?: boolean
  /** No admin row, so there is no account to copy from. */
  ownerMissing?: boolean
}

function makeAdminStub(options: StubOptions = {}) {
  const {
    posts = ALL_SOURCE_POSTS,
    quotes = ALL_SOURCE_QUOTES,
    existingTagId,
    failInsertOn,
    postsSelectThrows,
    ownerMissing = false,
  } = options
  const inserts: Insert[] = []

  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {}
      let mode: 'select' | 'insert' = 'select'
      let insertedRows: Record<string, unknown>[] = []

      const result = () => {
        if (mode === 'insert') {
          if (failInsertOn === table) {
            return { data: null, error: { message: `insert into ${table} failed` } }
          }
          if (table === 'posts') {
            // One statement per copy now, so this returns a single row. Copies
            // come back with ids so post_tags can reference them.
            return {
              data: insertedRows.map((row) => ({ id: `copy-${row.slug}`, title: row.title })),
              error: null,
            }
          }
          if (table === 'tags') return { data: [{ id: 'new-tag' }], error: null }
          return { data: null, error: null }
        }
        if (table === 'posts') {
          if (postsSelectThrows) throw new Error('posts lookup died')
          return { data: posts, error: null }
        }
        if (table === 'user_profiles') {
          return { data: ownerMissing ? [] : [{ id: 'owner-1' }], error: null }
        }
        if (table === 'quotes') return { data: quotes, error: null }
        if (table === 'tags') {
          return { data: existingTagId ? [{ id: existingTagId }] : [], error: null }
        }
        return { data: [], error: null }
      }

      for (const method of ['select', 'eq', 'in', 'or', 'order', 'limit']) {
        builder[method] = () => builder
      }
      builder.insert = (rows: Record<string, unknown>[]) => {
        mode = 'insert'
        insertedRows = rows
        inserts.push({ table, rows })
        return builder
      }
      builder.then = (
        resolve: (value: unknown) => void,
        reject: (reason: unknown) => void,
      ) => {
        try {
          return Promise.resolve(result()).then(resolve, reject)
        } catch (e) {
          return Promise.reject(e).then(resolve, reject)
        }
      }
      return builder
    },
  }

  return { admin: client as unknown as SupabaseClient, inserts }
}

/** Every row written to a table, across however many statements it took. */
function rowsInserted(inserts: Insert[], table: string) {
  return inserts.filter((entry) => entry.table === table).flatMap((entry) => entry.rows)
}

function wrote(inserts: Insert[], table: string) {
  return inserts.some((entry) => entry.table === table)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('seedCopiedContent — post copies (FR-011, FR-011a)', () => {
  it('copies all five articles for the new account', async () => {
    const { admin, inserts } = makeAdminStub()
    await seedCopiedContent(admin, USER)
    expect(rowsInserted(inserts, 'posts')).toHaveLength(5)
  })

  it('stamps the new user_id on every copy', async () => {
    const { admin, inserts } = makeAdminStub()
    await seedCopiedContent(admin, USER)
    for (const row of rowsInserted(inserts, 'posts')) {
      expect(row.user_id).toBe(USER)
    }
  })

  it('suffixes each slug with the account id so two accounts never collide', async () => {
    const { admin, inserts } = makeAdminStub()
    await seedCopiedContent(admin, USER)
    for (const row of rowsInserted(inserts, 'posts')) {
      expect(String(row.slug)).toMatch(/-9f8c1b2a$/)
    }
  })

  it('writes every copy private and flagged as seeded, whatever the source says (ADR-024)', async () => {
    // A seeded copy is byte-identical in every account, so it is never public —
    // and `is_seeded_copy` is what the posts_seeded_copy_never_public CHECK
    // constraint keys on. One public and one private source prove the source
    // state is ignored rather than carried over.
    const mixed = [
      sourcePost(SOURCE_POST_TITLES.health[0], 'h0', true),
      sourcePost(SOURCE_POST_TITLES.blog[0], 'b0', false),
    ]
    const { admin, inserts } = makeAdminStub({ posts: mixed })
    await seedCopiedContent(admin, USER)
    const rows = rowsInserted(inserts, 'posts')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.is_public).toBe(false)
      expect(row.is_seeded_copy).toBe(true)
    }
  })

  it('never copies the source id, which would collide on the primary key', async () => {
    const { admin, inserts } = makeAdminStub()
    await seedCopiedContent(admin, USER)
    for (const row of rowsInserted(inserts, 'posts')) {
      expect(row).not.toHaveProperty('id')
    }
  })
})

describe('seedCopiedContent — the health tag link (FR-011a)', () => {
  it('creates the account its own Sức Khỏe tag when it has none', async () => {
    const { admin, inserts } = makeAdminStub()
    await seedCopiedContent(admin, USER)
    const tag = rowsInserted(inserts, 'tags')
    expect(tag).toEqual([expect.objectContaining({ name: HEALTH_TAG_NAME, user_id: USER })])
  })

  it('reuses an existing tag instead of creating a duplicate', async () => {
    const { admin, inserts } = makeAdminStub({ existingTagId: 'already-here' })
    await seedCopiedContent(admin, USER)
    expect(wrote(inserts, 'tags')).toBe(false)
    for (const row of rowsInserted(inserts, 'post_tags')) {
      expect(row.tag_id).toBe('already-here')
    }
  })

  it('links only the two health copies, not the three blog ones', async () => {
    const { admin, inserts } = makeAdminStub()
    await seedCopiedContent(admin, USER)
    expect(rowsInserted(inserts, 'post_tags')).toHaveLength(2)
  })
})

describe('seedCopiedContent — quote copies (FR-012)', () => {
  it('copies the three quotes with the new user_id and no source id', async () => {
    const { admin, inserts } = makeAdminStub()
    await seedCopiedContent(admin, USER)
    const rows = rowsInserted(inserts, 'quotes')
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.user_id).toBe(USER)
      expect(row).not.toHaveProperty('id')
    }
  })
})

describe('seedCopiedContent — a missing or broken source is not fatal (Edge Cases)', () => {
  it('copies what it found when a source article is gone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, inserts } = makeAdminStub({ posts: ALL_SOURCE_POSTS.slice(0, 3) })
    await seedCopiedContent(admin, USER)
    expect(rowsInserted(inserts, 'posts')).toHaveLength(3)
  })

  it('still copies the quotes when every article is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, inserts } = makeAdminStub({ posts: [] })
    await seedCopiedContent(admin, USER)
    expect(wrote(inserts, 'posts')).toBe(false)
    expect(rowsInserted(inserts, 'quotes')).toHaveLength(3)
  })

  it('resolves instead of throwing when the posts lookup dies', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin } = makeAdminStub({ postsSelectThrows: true })
    await expect(seedCopiedContent(admin, USER)).resolves.toBeUndefined()
  })

  it('resolves and logs the account and table when an insert fails (FR-004b)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin } = makeAdminStub({ failInsertOn: 'quotes' })
    await expect(seedCopiedContent(admin, USER)).resolves.toBeUndefined()
    const logged = spy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(logged).toContain(USER)
    expect(logged).toContain('quotes')
  })

  it('logs nothing on a clean run', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin } = makeAdminStub()
    await seedCopiedContent(admin, USER)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('seedCopiedContent — the source is the owner, not just the oldest match', () => {
  it('copies nothing when there is no admin account to copy from', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, inserts } = makeAdminStub({ ownerMissing: true })
    await seedCopiedContent(admin, USER)
    // Without an owner the lookup would otherwise fall back to "oldest row with
    // this title", which after a few signups is another user's copy — possibly
    // one they have edited. Better to copy nothing.
    expect(inserts).toHaveLength(0)
  })

  it('one article failing does not lose the other four', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, inserts } = makeAdminStub({ failInsertOn: 'posts' })
    await seedCopiedContent(admin, USER)
    // Each copy is its own statement, so a slug collision on one is one lost
    // article rather than all five. All five are still attempted.
    expect(inserts.filter((entry) => entry.table === 'posts')).toHaveLength(5)
  })
})
