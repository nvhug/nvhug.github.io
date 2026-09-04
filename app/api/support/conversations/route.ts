// GET  /api/support/conversations — the caller's own conversations.
// POST /api/support/conversations — get-or-create the caller's single active
//      thread (spec 014, plan §3). No request body: identity comes from the
//      session only.
//
// HTTP concerns only — auth, rate limiting, status codes. All business rules
// (which conversation counts as "active", the conversations-per-hour cap's
// arithmetic) live in the imported pure/service modules.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  countRecentConversations,
  createConversation,
  findActiveConversation,
  listUserConversations,
} from '@/lib/support/service'
import { isOverLimit, RATE_LIMITS, windowStart } from '@/lib/support/rate-limit'

export const dynamic = 'force-dynamic'

async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  try {
    const conversations = await listUserConversations(user.id)
    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('[support] failed to list conversations:', error)
    return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
  }
}

export async function POST() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  try {
    // Reuse first, and unconditionally: the cap below bounds how many
    // conversations a user may CREATE, and handing back the one they already
    // have creates nothing. Charging the cap for a reuse locked a user out of
    // their own open thread — a 429 for an action that would not have inserted
    // a row.
    const existing = await findActiveConversation(user.id)
    if (existing) return NextResponse.json({ conversation: existing })

    // FR-100: 6 new conversations per hour, checked only on the path that
    // actually inserts one.
    const since = windowStart(new Date(), 60 * 60 * 1000).toISOString()
    const recentCount = await countRecentConversations(user.id, since)
    if (isOverLimit(recentCount, RATE_LIMITS.conversationsPerHour)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const conversation = await createConversation(user.id)
    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('[support] failed to create conversation:', error)
    return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
  }
}
