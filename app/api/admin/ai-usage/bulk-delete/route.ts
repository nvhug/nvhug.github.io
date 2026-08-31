import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { LOG_PAGE_SIZE } from '../../../../admin/settings/ai-usage/_lib/types'

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
 * POST /api/admin/ai-usage/bulk-delete — drop several rows from the call log at once.
 *
 * Sibling to DELETE /api/admin/ai-usage/[id] (unchanged by this route): same admin
 * gate, same service-role write path, same RLS ("ai_usage_log: no direct writes").
 * A single `.delete().in(...).select('id')` call is what makes per-row success/failure
 * observable in one round trip — see contracts/ai-usage-bulk-delete.md.
 *
 * Capped at LOG_PAGE_SIZE: bulk delete never reaches beyond one loaded page (FR-015).
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const ids = (body as { ids?: unknown } | null)?.ids

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }
  if (ids.length > LOG_PAGE_SIZE) {
    return NextResponse.json({ error: `ids must not exceed ${LOG_PAGE_SIZE}` }, { status: 400 })
  }
  if (!ids.every((id): id is string => typeof id === 'string' && UUID.test(id))) {
    return NextResponse.json({ error: 'ids must all be valid uuids' }, { status: 400 })
  }

  const { data, error } = await serviceClient().from('ai_usage_log').delete().in('id', ids).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const deletedIds = (data ?? []).map((row) => row.id as string)
  const failedIds = ids.filter((id) => !deletedIds.includes(id))

  return NextResponse.json({ deletedIds, failedIds })
}
