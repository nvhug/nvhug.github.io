import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * DELETE /api/admin/ai-usage/[id] — drop one row from the call log.
 *
 * Goes through the service role rather than the browser client on purpose: the RLS
 * policy on ai_usage_log denies every write ("ai_usage_log: no direct writes"), and
 * that policy stays as it is — a delete is an admin action performed on the server,
 * not something a signed-in session may do for itself.
 *
 * ai_analysis_history.usage_log_id is ON DELETE SET NULL (sql/22), so removing a row
 * here orphans that link instead of taking the saved analysis with it.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  // Rejected here rather than passed through: a malformed uuid makes PostgREST return a
  // 22P02 that would surface as an opaque 500.
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const { error } = await serviceClient().from('ai_usage_log').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
