import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(request: Request) {
  const { email, password } = await request.json()

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  let admin: ReturnType<typeof getAdminClient>
  try {
    admin = getAdminClient()
  } catch (e) {
    console.error('[signup] admin client init failed:', e)
    return NextResponse.json({ error: 'server_config' }, { status: 500 })
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (createError) {
    console.error('[signup] createUser error:', createError.message)
    const msg = createError.message?.toLowerCase() ?? ''
    if (msg.includes('already') || msg.includes('exists')) {
      return NextResponse.json({ error: 'email_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'signup_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
