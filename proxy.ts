import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { matchProtectedPage } from '@/lib/permissions'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let supabaseResponse = NextResponse.next({ request })

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

  const matchedPage = matchProtectedPage(pathname)
  if (!matchedPage) return supabaseResponse

  // No OAuth session → go login with Google/Facebook
  if (!user) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
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
    return NextResponse.redirect(new URL('/403', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth/callback).*)',
  ],
}
