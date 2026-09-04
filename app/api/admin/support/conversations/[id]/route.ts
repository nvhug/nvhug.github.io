// GET   /api/admin/support/conversations/[id] — full thread, internal notes included.
// PATCH /api/admin/support/conversations/[id] — status/priority/assignment (spec 014, FR-065).
// Admin-only (SR-002): role read server-side from user_profiles, never from the client.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  adminGetThread,
  adminPatchConversation,
  SupportNotFoundError,
  SupportValidationError,
  type AdminConversationPatch,
} from '@/lib/support/service'
import type { ConversationStatus, Priority } from '@/lib/support/types'

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

/** The `id` path segment reaches Postgres as a UUID. Anything else is a 22P02
 *  error, not a validation failure, so an unvalidated id turned a typo in the
 *  URL bar into a 500 with a stack trace in the logs. The user-facing route has
 *  always checked this; these did not. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUS_VALUES: readonly ConversationStatus[] = ['ai_active', 'waiting_admin', 'admin_active', 'resolved', 'closed']
const PRIORITY_VALUES: readonly Priority[] = ['low', 'normal', 'high', 'urgent']

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  try {
    const thread = await adminGetThread(id)
    if (!thread) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(thread)
  } catch (error) {
    console.error('[support] admin thread load failed:', error)
    return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  let body: { status?: unknown; priority?: unknown; assignedAdminId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const patch: AdminConversationPatch = {}

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !(STATUS_VALUES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
    }
    patch.status = body.status as ConversationStatus
  }

  if (body.priority !== undefined) {
    if (typeof body.priority !== 'string' || !(PRIORITY_VALUES as readonly string[]).includes(body.priority)) {
      return NextResponse.json({ error: 'invalid_priority' }, { status: 400 })
    }
    patch.priority = body.priority as Priority
  }

  if (body.assignedAdminId !== undefined) {
    if (body.assignedAdminId !== null && typeof body.assignedAdminId !== 'string') {
      return NextResponse.json({ error: 'invalid_assigned_admin_id' }, { status: 400 })
    }
    patch.assignedAdminId = body.assignedAdminId
  }

  try {
    const conversation = await adminPatchConversation(admin.id, id, patch)
    return NextResponse.json({ conversation })
  } catch (error) {
    if (error instanceof SupportNotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (error instanceof SupportValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('[support] admin patch failed:', error)
    return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
  }
}
