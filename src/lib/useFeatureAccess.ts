'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from './supabase-browser'
import { useUserRole } from './useUserRole'

// Checks the same page_permissions matrix admins edit at /admin/settings/pages,
// for a non-route feature key (e.g. 'notes.ai_analysis') rather than a page.
export function useFeatureAccess(featureKey: string) {
  const { role, loading: roleLoading } = useUserRole()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (roleLoading) return
    if (!role) { setLoading(false); return }

    async function load() {
      const { data } = await getSupabaseBrowserClient()
        .from('page_permissions')
        .select('allowed')
        .eq('page_key', featureKey)
        .eq('role', role)
        .maybeSingle()
      setAllowed(!!data?.allowed)
      setLoading(false)
    }
    void load()
  }, [role, roleLoading, featureKey])

  return { allowed, loading: roleLoading || loading }
}
