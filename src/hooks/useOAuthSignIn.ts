'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

/**
 * Shared Google/Facebook OAuth sign-in mechanics for `app/login/LoginForm.tsx`'s
 * `OAuthStep` and the landing page's `SignInButtons` — same handler shape, same
 * redirect construction, so a change to either only has to happen once.
 */
export function useOAuthSignIn(redirectPath: string) {
  const [loading, setLoading] = useState<'google' | 'facebook' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function signInWith(provider: 'google' | 'facebook') {
    setLoading(provider)
    setError(null)
    const { error: oauthError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectPath)}`,
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setLoading(null)
    }
  }

  // A provider hand-off leaves the caller mounted. Coming back with the browser's
  // Back button restores it from the back/forward cache with `loading` still set,
  // which leaves every button permanently disabled and the last-clicked one stuck
  // reading "redirecting" — killing the only call to action until a manual reload.
  // `pageshow` fires on that restore (and on normal load, where clearing is a
  // no-op).
  useEffect(() => {
    const clear = () => setLoading(null)
    window.addEventListener('pageshow', clear)
    return () => window.removeEventListener('pageshow', clear)
  }, [])

  return { loading, error, signInWith }
}
