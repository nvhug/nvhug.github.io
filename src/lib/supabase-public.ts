import { createClient } from '@supabase/supabase-js'

/**
 * A Supabase client that deliberately carries NO session, so every request it
 * makes runs as the PostgreSQL `anon` role.
 *
 * It exists to serve a public post to a signed-out visitor — or to one signed in
 * to a *different* account — without widening the `authenticated` RLS grant. The
 * read policy that makes a post publicly readable (`posts_public_read`,
 * sql/28) is granted `TO anon` only; `posts_authenticated_user` stays
 * owner-scoped, so a session-bearing client would simply not see another
 * account's public post. Reading it as `anon` is what makes it visible, and this
 * client can therefore read exactly what that policy allows and nothing else.
 */
export function createSupabasePublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
