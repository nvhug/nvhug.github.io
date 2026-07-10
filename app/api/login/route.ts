import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE, getAuthCookieValue, isValidPin } from '@/lib/auth'

export async function POST(request: Request) {
  const { pin } = await request.json()

  if (typeof pin !== 'string' || !isValidPin(pin)) {
    return NextResponse.json({ error: 'Sai mã PIN' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(AUTH_COOKIE_NAME, getAuthCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE,
  })
  return response
}
