import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import {
  DASHBOARD_PATH,
  matchProtectedPage,
  shouldRedirectRootToDashboard,
} from '@/lib/permissions'
import { shouldRedirectRootForCountry } from './app/_landing/geo'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let supabaseResponse = NextResponse.next({ request })

  /**
   * Redirect while keeping whatever `setAll` just wrote.
   *
   * `getUser()` below may rotate the session, and the refreshed cookies land on
   * `supabaseResponse`. A bare `NextResponse.redirect()` is a different response and
   * drops them, so the browser keeps the old refresh token — which the rotation has
   * already consumed — and the very next request signs the user out. Every redirect
   * out of this proxy has to carry them.
   */
  function redirectKeepingSession(url: URL) {
    const response = NextResponse.redirect(url)
    for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie)
    return response
  }

  // Refresh Supabase session on every request (required by @supabase/ssr)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          // Update request cookies first, then recreate response so server
          // components receive the refreshed session token in their cookies.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // `/` is the public landing page. A visitor who already has a session wants
  // their dashboard, not the product pitch — send them on before anything
  // renders. Runs here rather than in a server component so it costs no second
  // session read and produces no flash of marketing content.
  if (shouldRedirectRootToDashboard(pathname, Boolean(user))) {
    return redirectKeepingSession(new URL(DASHBOARD_PATH, request.url))
  }

  // Must run AFTER the dashboard check above: a signed-in visitor abroad (e.g. a
  // Vietnamese user travelling) has already been sent to their dashboard by then,
  // so this only ever geo-blocks an anonymous visitor.
  if (shouldRedirectRootForCountry(pathname, request.headers.get('x-vercel-ip-country'))) {
    return redirectKeepingSession(new URL('/login', request.url))
  }

  const matchedPage = matchProtectedPage(pathname)
  if (!matchedPage) return supabaseResponse

  // No OAuth session → go login with Google/Facebook
  if (!user) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', pathname)
    return redirectKeepingSession(url)
  }

  // Layer 3: role-based page access — checked against the page_permissions
  // matrix editable in /admin/settings/pages
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'user'

  const { data: permission } = await supabase
    .from('page_permissions')
    .select('allowed')
    .eq('page_key', matchedPage.key)
    .eq('role', role)
    .maybeSingle()

  if (!permission?.allowed) {
    return redirectKeepingSession(new URL('/403', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth/callback).*)',
  ],
}
