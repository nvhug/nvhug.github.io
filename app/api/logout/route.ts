import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST() {
  const response = NextResponse.json({ ok: true })

  // Clear owner PIN cookie
  response.cookies.delete(AUTH_COOKIE_NAME)

  // Sign out Supabase session (OAuth users) — safe to call even if no session
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
  } catch {
    // Non-fatal: session may not exist
  }

  return response
}
