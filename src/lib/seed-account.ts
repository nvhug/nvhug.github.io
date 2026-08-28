/**
 * Writes the starter content for a newly created account (feature 009).
 *
 * The I/O shell around the pure builder in `default-account-data.ts`. Runs with
 * the service-role client, so **every row must carry `user_id` explicitly** —
 * RLS is bypassed and will not catch an orphan row.
 *
 * Two phases (FR-001a):
 *  - `seedDashboardPhase` is awaited by the caller and must stay inside
 *    SC-003's 150 ms, so its inserts run as parallel waves rather than a loop.
 *  - the copied-content phase runs after the response via `after()`.
 *
 * `meals` is never written here: the meal plan reaches the account through the
 * app's own default daily plan (FR-010a).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  HEALTH_TAG_NAME,
  SOURCE_POST_TITLES,
  SOURCE_QUOTE_PREFIXES,
  buildCopiedPostSlug,
  buildDefaultAccountRows,
  buildFirstGoalItems,
} from './default-account-data'
import { toVietnamISODate } from './date'

/**
 * Report a seeding failure and swallow it.
 *
 * A failure must never reach the user: the account was created successfully and
 * there is nothing for them to act on (FR-004, FR-004b). The account id is not
 * optional in the message — the claim is taken before the inserts, so a partial
 * seed is never retried and this line is the only trace it happened.
 */
function reportFailure(userId: string, category: string, error: unknown): void {
  console.error(`[seed-account] userId=${userId} table=${category} failed:`, error)
}

/** Run one insert, reporting a failure instead of letting it reject the wave. */
async function insertRows<Row>(
  admin: SupabaseClient,
  userId: string,
  table: string,
  rows: Row[],
): Promise<void> {
  try {
    // `from(<dynamic string>)` has no generated row type to check against, so a
    // generic row cannot satisfy Supabase's excess-property guard. The shape is
    // guaranteed by the typed builder in `default-account-data.ts`, which is
    // where it belongs — not by this transport helper.
    const { error } = await admin.from(table).insert(rows as never)
    if (error) reportFailure(userId, table, error)
  } catch (error) {
    reportFailure(userId, table, error)
  }
}

/**
 * Take the one-time claim on the account.
 *
 * `UPDATE … WHERE seeded_at IS NULL RETURNING id` is atomic in PostgreSQL, so
 * two concurrent logins cannot both win it. The OAuth callback fires on every
 * login, not only the first, so this is what stops the seeder duplicating rows
 * (FR-002, SC-004).
 */
async function claimAccount(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from('user_profiles')
      .update({ seeded_at: new Date().toISOString() })
      .eq('id', userId)
      .is('seeded_at', null)
      .select('id')

    if (error) {
      reportFailure(userId, 'user_profiles', error)
      return false
    }
    // Zero rows means either "already seeded" (the normal case on every
    // subsequent login) or "no user_profiles row at all" (abnormal). Telling
    // them apart needs a second query, which would cost a round trip on every
    // login of every account to catch a case that implies the profile trigger
    // itself is broken — a failure with far louder symptoms than seeding. So
    // this stays quiet deliberately; the caller in the signup route knows the
    // account is brand new and is the right place to notice it (see T006).
    return Array.isArray(data) && data.length > 0
  } catch (error) {
    reportFailure(userId, 'user_profiles', error)
    return false
  }
}

/**
 * Insert the goal sub-items, attaching the parent id the `goals` insert
 * returned. Only the first starter goal carries items (FR-008a).
 */
async function insertFirstGoalItems(
  admin: SupabaseClient,
  userId: string,
  goalId: string | undefined,
): Promise<void> {
  // No id means the goals insert failed or returned nothing — writing items
  // now would create rows pointing at a goal that does not exist.
  if (!goalId) return

  const items = buildFirstGoalItems(userId).map((item) => ({ ...item, goal_id: goalId }))
  await insertRows(admin, userId, 'goal_items', items)
}

/**
 * Everything the dashboard renders, written before the user reaches it.
 *
 * Returns whether this call won the claim — the caller uses that to decide
 * whether to schedule the copied-content phase.
 */
export async function seedDashboardPhase(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const startedAt = performance.now()
  const won = await claimAccount(admin, userId)
  if (!won) return false

  try {
    // Vietnam time, not the process clock: this runs in UTC on Vercel, where a
    // signup just after midnight ICT is still the previous UTC day (FR-007, R6).
    const rows = buildDefaultAccountRows(userId, toVietnamISODate(new Date()))

    // Wave 2 — every independent table at once. Sequential inserts would cost
    // one round trip each; these cost one wave in total (plan R7).
    const [goalsResult] = await Promise.all([
      insertGoalsReturningId(admin, userId, rows.goals),
      insertRows(admin, userId, 'notes', rows.notes),
      insertRows(admin, userId, 'todos', rows.todos),
      insertRows(admin, userId, 'buy_picks', rows.buy_picks),
      insertRows(admin, userId, 'gym_logs', rows.gym_logs),
      insertRows(admin, userId, 'weight_logs', rows.weight_logs),
      insertRows(admin, userId, 'calendar_events', rows.calendar_events),
      insertRows(admin, userId, 'fund_transactions', rows.fund_transactions),
      insertRows(admin, userId, 'fund_assets', rows.fund_assets),
    ])

    // Wave 3 — the only blocking insert that cannot join wave 2: it needs an id
    // that does not exist until the goals insert comes back.
    await insertFirstGoalItems(admin, userId, goalsResult)

    // SC-003 allows this phase 150 ms. Logged in development only: in production
    // it would be one more line per signup with nobody reading it, and the
    // budget is a development-time constraint, not a runtime one. If this ever
    // exceeds 150 ms the fix is wave composition — something that belongs in
    // wave 2 has ended up sequential — not a bigger budget.
    if (process.env.NODE_ENV !== 'production') {
      const elapsed = Math.round(performance.now() - startedAt)
      const verdict = elapsed <= 150 ? 'within' : 'OVER'
      console.log(`[seed-account] dashboard phase ${elapsed}ms (${verdict} the 150ms SC-003 budget)`)
    }
  } catch (error) {
    reportFailure(userId, 'dashboard-phase', error)
  }

  return true
}

/** Insert the goals and report the first one's id, which the items hang off. */
async function insertGoalsReturningId(
  admin: SupabaseClient,
  userId: string,
  goals: { title: string }[],
): Promise<string | undefined> {
  const firstTitle = goals[0]?.title
  try {
    const { data, error } = await admin.from('goals').insert(goals as never).select('id, title')
    if (error) {
      reportFailure(userId, 'goals', error)
      return undefined
    }
    // Matched by title, not by position: PostgreSQL does not promise that
    // INSERT ... RETURNING comes back in input order, so `data[0]` could be any
    // of the three goals — and the sub-items would then hang off the wrong one.
    const rows = (Array.isArray(data) ? data : []) as { id: string; title: string }[]
    return rows.find((row) => row.title === firstTitle)?.id
  } catch (error) {
    reportFailure(userId, 'goals', error)
    return undefined
  }
}

// ============================================================
// Copied-content phase (FR-011, FR-011a, FR-011b, FR-012)
//
// Runs after the response via `after()`, not on the signup path: it is the
// slowest part (a read plus a dependent write) and the most failure-prone (it
// depends on the owner's rows still existing), and it feeds pages reached by a
// separate navigation that fetch fresh anyway (FR-001a, plan R7).
// ============================================================

interface SourcePost {
  title: string
  slug: string
  content: string
  excerpt: string | null
  published: boolean
}

interface SourceQuote {
  content: string
  author: string | null
}

/**
 * Read the source articles, keeping the **oldest** row per title.
 *
 * Matching by title alone is not enough once a second account has been seeded:
 * every copy carries the same title. The original always predates its copies, so
 * ordering by `created_at` and keeping the first occurrence of each title picks
 * the owner's row without needing to know who the owner is.
 */
/**
 * The account the starter articles are copied *from*: the site's own admin.
 *
 * Without this, the source lookup matched by title alone and kept the oldest
 * row — which works only while the owner's originals still exist. Delete or
 * rename one and the oldest remaining match is another *user's* copy, which
 * that user may have edited into anything, and it would then be copied to every
 * new account. Reading the admin's id costs one query in the background phase
 * and removes that whole class of accident.
 *
 * The oldest admin is the bootstrapped owner, so multiple admins is not
 * ambiguous.
 */
async function readOwnerId(admin: SupabaseClient, userId: string): Promise<string | undefined> {
  try {
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) {
      reportFailure(userId, 'user_profiles (owner lookup)', error)
      return undefined
    }
    return (data as { id: string }[] | null)?.[0]?.id
  } catch (error) {
    reportFailure(userId, 'user_profiles (owner lookup)', error)
    return undefined
  }
}

async function readSourcePosts(
  admin: SupabaseClient,
  userId: string,
  ownerId: string,
): Promise<SourcePost[]> {
  const titles = [...SOURCE_POST_TITLES.health, ...SOURCE_POST_TITLES.blog]
  try {
    const { data, error } = await admin
      .from('posts')
      .select('title, slug, content, excerpt, published, created_at')
      .eq('user_id', ownerId)
      .in('title', titles)
      .order('created_at', { ascending: true })

    if (error) {
      reportFailure(userId, 'posts (source lookup)', error)
      return []
    }

    const oldestByTitle = new Map<string, SourcePost>()
    for (const row of (data ?? []) as SourcePost[]) {
      if (!oldestByTitle.has(row.title)) oldestByTitle.set(row.title, row)
    }
    return [...oldestByTitle.values()]
  } catch (error) {
    reportFailure(userId, 'posts (source lookup)', error)
    return []
  }
}

/** Read the source quotes by prefix — the spec quotes them truncated. */
async function readSourceQuotes(
  admin: SupabaseClient,
  userId: string,
  ownerId: string,
): Promise<SourceQuote[]> {
  const filter = SOURCE_QUOTE_PREFIXES.map((prefix) => `content.ilike.${prefix}%`).join(',')
  try {
    const { data, error } = await admin
      .from('quotes')
      .select('content, author, created_at')
      .eq('user_id', ownerId)
      .or(filter)
      .order('created_at', { ascending: true })

    if (error) {
      reportFailure(userId, 'quotes (source lookup)', error)
      return []
    }

    const seen = new Set<string>()
    const unique: SourceQuote[] = []
    for (const row of (data ?? []) as SourceQuote[]) {
      // Same reasoning as posts: keep the oldest match per prefix. Compared
      // case-insensitively to match the `ilike` that fetched these rows — a
      // case-sensitive check here would drop a row the query deliberately
      // accepted, and silently, since the loop has nothing to report.
      const content = row.content?.toLowerCase() ?? ''
      const prefix = SOURCE_QUOTE_PREFIXES.find((p) => content.startsWith(p.toLowerCase()))
      if (!prefix || seen.has(prefix)) continue
      seen.add(prefix)
      unique.push(row)
    }
    return unique
  } catch (error) {
    reportFailure(userId, 'quotes (source lookup)', error)
    return []
  }
}

/**
 * The account's own "Sức Khỏe" tag, created if it has none.
 *
 * The Health tab reads tag ids from the per-user `tags` table, so a copied
 * health article only appears there if this account owns a matching tag and a
 * `post_tags` row pointing at it (FR-011a).
 */
async function findOrCreateHealthTag(
  admin: SupabaseClient,
  userId: string,
): Promise<string | undefined> {
  try {
    const { data: existing, error: readError } = await admin
      .from('tags')
      .select('id')
      .eq('user_id', userId)
      .eq('name', HEALTH_TAG_NAME)
      .limit(1)

    if (readError) {
      reportFailure(userId, 'tags (lookup)', readError)
      return undefined
    }
    const found = (existing as { id: string }[] | null)?.[0]?.id
    if (found) return found

    const { data: created, error: writeError } = await admin
      .from('tags')
      .insert([{ user_id: userId, name: HEALTH_TAG_NAME }] as never)
      .select('id')

    if (writeError) {
      reportFailure(userId, 'tags', writeError)
      return undefined
    }
    return (created as { id: string }[] | null)?.[0]?.id
  } catch (error) {
    reportFailure(userId, 'tags', error)
    return undefined
  }
}

/**
 * Give the account its own private copy of the owner's five articles and three
 * quotes. Anything missing is skipped, never fatal (Edge Cases).
 */
export async function seedCopiedContent(admin: SupabaseClient, userId: string): Promise<void> {
  const ownerId = await readOwnerId(admin, userId)
  if (!ownerId) {
    // Nothing to copy from. Logged by readOwnerId; the dashboard phase has
    // already succeeded, so the account is usable either way.
    return
  }

  const [sourcePosts, sourceQuotes] = await Promise.all([
    readSourcePosts(admin, userId, ownerId),
    readSourceQuotes(admin, userId, ownerId),
  ])

  const healthTitles = new Set<string>(SOURCE_POST_TITLES.health)

  if (sourcePosts.length > 0) {
    // `id` and `created_at` are deliberately not carried over: the copy is a new
    // row, and reusing the source id would collide on the primary key.
    const copies = sourcePosts.map((post) => ({
      user_id: userId,
      title: post.title,
      slug: buildCopiedPostSlug(post.slug, userId),
      content: post.content,
      excerpt: post.excerpt,
      // Kept from the source (FR-011b). Safe to keep published now that the
      // blog is private (sql/61): the copy shows on its own owner's blog, which
      // is exactly what FR-011c asks for, and nowhere else.
      published: post.published,
    }))

    try {
      // One statement per copy rather than one for all five. `posts.slug` is
      // globally UNIQUE and the suffix is only 8 hex characters of the account
      // id, so a collision is unlikely but not impossible — and in a single
      // statement it would lose all five articles at once. This phase is off the
      // signup path (FR-001a), so the extra round trips cost the user nothing.
      const [insertedRows, tagId] = await Promise.all([
        Promise.all(
          copies.map(async (copy) => {
            try {
              const { data, error } = await admin
                .from('posts')
                .insert([copy] as never)
                .select('id, title')
              if (error) {
                reportFailure(userId, `posts (${copy.slug})`, error)
                return undefined
              }
              return (data as { id: string; title: string }[] | null)?.[0]
            } catch (error) {
              reportFailure(userId, `posts (${copy.slug})`, error)
              return undefined
            }
          }),
        ),
        // Only worth resolving when there is a health article to attach it to.
        sourcePosts.some((post) => healthTitles.has(post.title))
          ? findOrCreateHealthTag(admin, userId)
          : Promise.resolve(undefined),
      ])

      if (tagId) {
        const links = insertedRows
          .filter((row): row is { id: string; title: string } => !!row)
          .filter((row) => healthTitles.has(row.title))
          .map((row) => ({ post_id: row.id, tag_id: tagId }))
        if (links.length > 0) await insertRows(admin, userId, 'post_tags', links)
      }
    } catch (error) {
      reportFailure(userId, 'posts', error)
    }
  }

  if (sourceQuotes.length > 0) {
    await insertRows(
      admin,
      userId,
      'quotes',
      sourceQuotes.map((quote) => ({
        user_id: userId,
        content: quote.content,
        author: quote.author,
      })),
    )
  }
}
