import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Whether the admin has switched every AI feature's trial-quota and daily-cap
 * gating off. Fails closed (returns false) on any read error or thrown
 * exception, so a flag-read failure never accidentally grants free access.
 */
export async function isAIFreeModeEnabled(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ai_free_mode')
      .select('enabled')
      .eq('id', true)
      .maybeSingle()

    if (error) {
      console.error('[ai-free-mode] read failed:', error.message)
      return false
    }
    if (!data) return false
    return (data as { enabled: boolean }).enabled === true
  } catch (err) {
    console.error('[ai-free-mode] read threw:', err)
    return false
  }
}
