// GET /api/admin/support/metrics — the FR-070 inbox header figures.
// Admin-only (SR-002). `?days=N` selects the trailing window, default 30.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { adminMetrics } from '@/lib/support/service'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle()
  if (data?.role !== 'admin') return null
  return user
}

const DEFAULT_RANGE_DAYS = 30

export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const daysParam = Number(searchParams.get('days') ?? String(DEFAULT_RANGE_DAYS))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.floor(daysParam) : DEFAULT_RANGE_DAYS

  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)

  try {
    const metrics = await adminMetrics({ from, to })
    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('[support] admin metrics failed:', error)
    return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
  }
}
