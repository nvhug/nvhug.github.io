import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getPlan, buildTransferNote } from '@/lib/payment-config'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { planId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const plan = getPlan(body.planId)
  if (!plan) return NextResponse.json({ error: 'Gói không hợp lệ' }, { status: 400 })

  const email = user.email ?? user.id
  const transferNote = buildTransferNote(email, plan.id)

  // Return existing pending request if any (idempotent)
  const { data: existing } = await supabase
    .from('upgrade_requests')
    .select('id, plan_id, transfer_note')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      requestId: existing.id,
      transferNote: existing.transfer_note,
      alreadyPending: true,
    })
  }

  const { data, error } = await supabase
    .from('upgrade_requests')
    .insert({
      user_id: user.id,
      email,
      plan_id: plan.id,
      amount: plan.price,
      duration_months: plan.months,
      transfer_note: transferNote,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requestId: data.id, transferNote })
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('upgrade_requests')
    .select('id, plan_id, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ request: data ?? null })
}
