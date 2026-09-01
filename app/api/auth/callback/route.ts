import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, after } from 'next/server'
import { safeNextPath } from '@/lib/permissions'
import { seedCopiedContent, seedDashboardPhase } from '@/lib/seed-account'

/**
 * Starter content for an account arriving through OAuth (feature 009).
 *
 * This route fires on **every** OAuth login and on the password-reset redirect,
 * not only the first — the seeder's atomic claim on `user_profiles.seeded_at` is
 * what makes that safe (FR-002, plan R2).
 *
 * Everything here is contained: a missing service-role key, or any failure at
 * all, must never stop the user reaching the app (FR-004). The SSR client above
 * cannot be reused because it holds the user's anon-key session, while seeding
 * writes rows for a user whose own RLS context is not yet established.
 */
async function seedIfNewAccount(userId: string): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('[auth/callback] cannot seed: missing Supabase service-role env vars')
      return
    }
    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    if (await seedDashboardPhase(admin, userId)) {
      // After the redirect, not before it (FR-001a). `after()` rather than a
      // bare promise: a serverless function can be frozen as soon as the
      // response is sent, which would drop this work silently.
      after(() => seedCopiedContent(admin, userId))
    }
  } catch (e) {
    console.error(`[auth/callback] seeding failed for userId=${userId}:`, e)
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Defaults to the dashboard, not '/': '/' is the public landing page now, so a
  // callback arriving without `next` (an email confirmation link, say) would drop
  // a freshly signed-in user on the product pitch and bounce them.
  const next = safeNextPath(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Awaited before the redirect so the dashboard's first render already has
  // content (FR-001a). On a returning login the claim is already taken, so this
  // costs one UPDATE that matches no row.
  const userId = data.session?.user?.id ?? data.user?.id
  if (userId) await seedIfNewAccount(userId)

  return NextResponse.redirect(`${origin}${next}`)
}
