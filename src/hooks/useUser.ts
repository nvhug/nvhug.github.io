'use client'

import { useEffect, useState } from 'react'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return { user }
}
