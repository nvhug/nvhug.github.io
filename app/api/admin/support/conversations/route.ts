// GET /api/admin/support/conversations — inbox list (filters, search, page)
// plus header counts (spec 014, FR-063/064/068). Admin-only.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { adminListConversations } from '@/lib/support/service'
import type { ConversationStatus, InboxFilters, Priority } from '@/lib/support/types'

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

const STATUS_VALUES: readonly ConversationStatus[] = ['ai_active', 'waiting_admin', 'admin_active', 'resolved', 'closed']
const PRIORITY_VALUES: readonly Priority[] = ['low', 'normal', 'high', 'urgent']

export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')
  const priorityParam = searchParams.get('priority')
  const assignmentParam = searchParams.get('assignment')
  const pageParam = Number(searchParams.get('page') ?? '1')

  const filters: InboxFilters = {
    status: statusParam && (STATUS_VALUES as readonly string[]).includes(statusParam) ? (statusParam as ConversationStatus) : 'all',
    priority: priorityParam && (PRIORITY_VALUES as readonly string[]).includes(priorityParam) ? (priorityParam as Priority) : 'all',
    assignment: assignmentParam === 'mine' || assignmentParam === 'unassigned' ? assignmentParam : 'all',
    search: searchParams.get('search') ?? '',
    page: Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1,
  }

  try {
    const result = await adminListConversations(admin.id, filters)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[support] admin list failed:', error)
    return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
  }
}
