import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { seedCopiedContent, seedDashboardPhase } from '@/lib/seed-account'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(request: Request) {
  const { email, password } = await request.json()

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  let admin: ReturnType<typeof getAdminClient>
  try {
    admin = getAdminClient()
  } catch (e) {
    console.error('[signup] admin client init failed:', e)
    return NextResponse.json({ error: 'server_config' }, { status: 500 })
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (createError) {
    console.error('[signup] createUser error:', createError.message)
    const msg = createError.message?.toLowerCase() ?? ''
    if (msg.includes('already') || msg.includes('exists')) {
      return NextResponse.json({ error: 'email_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'signup_failed' }, { status: 500 })
  }

  // Starter content (feature 009, FR-001a). Awaited so the dashboard is already
  // populated on its first render, but it can never fail the signup: the seeder
  // catches and logs everything itself (FR-004).
  const userId = created?.user?.id
  if (userId) {
    const claimed = await seedDashboardPhase(admin, userId)
    if (claimed) {
      // The copied-content phase runs after this response (FR-001a). `after()`
      // rather than a bare promise: on a serverless host the function can be
      // frozen the moment the response is sent, and the work would silently
      // never run. Only when the claim was won — otherwise this account has
      // already been through both phases.
      after(() => seedCopiedContent(admin, userId))
    } else {
      // This account was created moments ago, so "already seeded" is impossible
      // here — an unclaimed account means its user_profiles row is missing. The
      // seeder stays quiet about that because it cannot tell the two cases
      // apart; this call site can (see R8 and the note in claimAccount).
      console.error(`[signup] no seeding claim for a just-created userId=${userId}`)
    }
  }

  return NextResponse.json({ ok: true })
}
