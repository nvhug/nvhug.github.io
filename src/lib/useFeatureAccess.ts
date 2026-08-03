'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from './supabase-browser'
import { useUserRole } from './useUserRole'

// Checks the same page_permissions matrix admins edit at /admin/settings/pages,
// for a non-route feature key (e.g. 'notes.ai_analysis') rather than a page.
export function useFeatureAccess(featureKey: string) {
  const { role, loading: roleLoading } = useUserRole()
  const [snapshot, setSnapshot] = useState<{ role: string; key: string; allowed: boolean } | null>(null)

  useEffect(() => {
    if (roleLoading) return
    if (!role) return
    const currentRole = role

    async function load() {
      const { data } = await getSupabaseBrowserClient()
        .from('page_permissions')
        .select('allowed')
        .eq('page_key', featureKey)
        .eq('role', currentRole)
        .maybeSingle()
      setSnapshot({ role: currentRole, key: featureKey, allowed: !!data?.allowed })
    }
    void load()
  }, [role, roleLoading, featureKey])

  if (!role) {
    return { allowed: false, loading: roleLoading }
  }

  const isFresh = snapshot?.role === role && snapshot?.key === featureKey
  return { allowed: isFresh ? snapshot.allowed : false, loading: roleLoading || !isFresh }
}
