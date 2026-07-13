import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME, isValidAuthCookie } from '@/lib/auth'

export function proxy(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value

  if (isValidAuthCookie(cookie)) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!login|api/login|api/habits-notify|_next/static|_next/image|favicon.ico).*)'],
}
