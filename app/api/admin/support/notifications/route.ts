// GET /api/admin/support/notifications — unread-for-admin conversations for the
// admin notification bell (spec 014 WP-6). Admin-only (SR-002): role read
// server-side from user_profiles, never trusted from the client.
//
// No new table/column/migration: unread is derived from
// support_conversations.admin_last_read_at vs last_message_at — see
// adminListUnreadConversations (service.ts) and isUnreadForAdmin (unread.ts).
//
// The `preview` field is message content (CLAUDE.md / ADR-014): it must be
// rendered as text only and never written to a log. This route only ever
// forwards it in the JSON response — nothing here logs it.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { adminListUnreadConversations } from '@/lib/support/service'

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

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { notifications, total } = await adminListUnreadConversations()
    return NextResponse.json({ notifications, total })
  } catch (error) {
    console.error('[support] admin notifications failed:', error)
    return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
  }
}
