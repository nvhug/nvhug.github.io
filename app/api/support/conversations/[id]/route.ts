// GET /api/support/conversations/[id] — one thread, owner-only.
//
// getUserThread returns null for BOTH "no such conversation" and "not
// yours" — this route relays that as a single 404 either way (SR-011); it
// never has the information to distinguish them.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getUserThread } from '@/lib/support/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params

  // Same guard as the POST sibling: the column is UUID, so a malformed id
  // reaches Postgres as a 22P02 and surfaces as a 500. It gets the same 404
  // every well-formed-but-not-yours id gets (SR-011) — a malformed id tells
  // the caller nothing either way, and a 500 here would be the one response
  // that stands out from the rest.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Paging cursor for "load older": the createdAt of the oldest message the
  // client already holds. Rejected unless it parses as a date, so a malformed
  // value can never reach the query as a raw string.
  const beforeParam = new URL(request.url).searchParams.get('before')
  const before = beforeParam && !Number.isNaN(Date.parse(beforeParam)) ? beforeParam : null

  try {
    const thread = await getUserThread(user.id, id, before)
    if (!thread) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(thread)
  } catch (error) {
    console.error('[support] failed to load thread:', error)
    return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
  }
}
