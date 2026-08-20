import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { getPlan } from '@/lib/payment-config'

export const dynamic = 'force-dynamic'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (data?.role !== 'admin') return null
  return user
}

/** GET /api/admin/upgrade-requests?status=pending|all */
export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') ?? 'pending'

  const admin = serviceClient()
  let query = admin
    .from('upgrade_requests')
    .select('id, user_id, email, plan_id, amount, duration_months, transfer_note, status, admin_note, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: data })
}

/** POST /api/admin/upgrade-requests — approve or reject */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { requestId: string; action: 'approve' | 'reject'; adminNote?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { requestId, action, adminNote } = body
  if (!requestId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Missing requestId or action' }, { status: 400 })
  }

  const admin = serviceClient()

  const { data: req, error: fetchErr } = await admin
    .from('upgrade_requests')
    .select('user_id, plan_id, duration_months')
    .eq('id', requestId)
    .single()

  if (fetchErr || !req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // Update request status
  const { error: updateErr } = await admin
    .from('upgrade_requests')
    .update({ status: action === 'approve' ? 'approved' : 'rejected', admin_note: adminNote ?? null, updated_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // If approved, update user profile
  if (action === 'approve') {
    const plan = getPlan(req.plan_id)
    const months = plan?.months ?? req.duration_months
    const now = new Date()
    const expires = new Date(now)
    expires.setMonth(expires.getMonth() + months)

    const { error: profileErr } = await admin
      .from('user_profiles')
      .update({
        role: 'paid',
        plan_type: 'pro',
        subscribed_at: now.toISOString(),
        subscription_expires_at: expires.toISOString(),
      })
      .eq('id', req.user_id)

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
