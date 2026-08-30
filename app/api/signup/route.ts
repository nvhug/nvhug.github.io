import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { seedCopiedContent, seedDashboardPhase } from '@/lib/seed-account'
import { buildNotifyEmailHtml, escapeHtml, sendNotifyEmail } from '@/lib/notify'

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

  // `generateLink` creates the account *unconfirmed* and hands back the link
  // that proves ownership of the address. Never `createUser({ email_confirm:
  // true })` here: that marks an address verified with no proof at all, so
  // anyone could pre-register a stranger's email and — because Supabase links a
  // new OAuth identity to an existing account with the same verified email —
  // own the account the moment its real owner signs in with Google.
  const origin = new URL(request.url).origin
  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: 'signup',
    email: email.trim(),
    password,
    options: { redirectTo: `${origin}/api/auth/callback?next=/notes` },
  })

  if (linkError) {
    console.error('[signup] generateLink error:', linkError.message)
    const msg = linkError.message?.toLowerCase() ?? ''
    if (msg.includes('already') || msg.includes('exists')) {
      return NextResponse.json({ error: 'email_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'signup_failed' }, { status: 500 })
  }

  const actionLink = data?.properties?.action_link
  if (!actionLink) {
    console.error('[signup] generateLink returned no action_link')
    return NextResponse.json({ error: 'signup_failed' }, { status: 500 })
  }

  // Sent through Resend with our own template, like every other transactional
  // mail in the app (see donate-notify, report-bug) rather than Supabase's
  // built-in sender.
  const sent = await sendNotifyEmail(
    email.trim(),
    'Xác nhận tài khoản của bạn',
    buildNotifyEmailHtml({
      title: 'Xác nhận email',
      subtitle: 'Chỉ còn một bước nữa thôi',
      bodyHtml: `
        <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;">Nhấn nút bên dưới để xác nhận email và kích hoạt tài khoản.</p>
        <a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Xác nhận email</a>
      `,
    })
  )

  if (!sent) {
    // The account exists either way, so a transient mail failure must not fail
    // the request. There is no resend flow yet — log it for manual follow-up.
    console.error(`[signup] confirmation email failed to send for a newly created userId=${data?.user?.id}`)
  }

  // Starter content (feature 009, FR-001a). Awaited so the dashboard is already
  // populated on its first render, but it can never fail the signup: the seeder
  // catches and logs everything itself (FR-004).
  const userId = data?.user?.id
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
