import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { AUTH_COOKIE_NAME, isValidAuthCookie } from '@/lib/auth'

const PROTECTED_PREFIXES = ['/notes', '/admin', '/quotes']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Refresh Supabase session on every request (required by @supabase/ssr)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (!needsAuth) return response

  const pinCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const hasPinCookie = isValidAuthCookie(pinCookie)

  // Layer 1: no PIN → go enter PIN first
  if (!hasPinCookie) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Layer 2: PIN ok, no OAuth session → go login with Google/Facebook
  if (!user) {
    const url = new URL('/login', request.url)
    url.searchParams.set('step', 'oauth')
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth/callback).*)',
  ],
}
