'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from './supabase-browser'
import type { UserRole } from '@/types'

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await getSupabaseBrowserClient()
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setRole((data?.role as UserRole) ?? 'user')
      setLoading(false)
    }
    void load()
  }, [])

  return { role, loading }
}
