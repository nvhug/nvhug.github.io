// POST /api/admin/support/conversations/[id]/messages — admin reply or
// internal note (spec 014, FR-065). Admin-only (SR-002).

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { adminAppendMessage, SupportNotFoundError } from '@/lib/support/service'
import { normalizeContent } from '@/lib/support/sanitize'

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  let body: { content?: unknown; kind?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const content = normalizeContent(body.content)
  if (!content) return NextResponse.json({ error: 'invalid_content' }, { status: 400 })

  const kind = body.kind === 'note' ? 'note' : 'reply'

  try {
    const message = await adminAppendMessage(admin.id, id, content, kind)
    return NextResponse.json({ message })
  } catch (error) {
    if (error instanceof SupportNotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    // Message only — see the user-side route: a raw PostgrestError from an
    // insert can echo the row, and that row is message content (FR-092).
    console.error('[support] admin message failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
  }
}
