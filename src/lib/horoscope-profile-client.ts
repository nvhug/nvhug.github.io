import { getSupabaseBrowserClient } from './supabase-browser'
import type { HoroscopeProfile } from './horoscope-profile'

export async function fetchHoroscopeProfile(
  userId: string
): Promise<{ profile: HoroscopeProfile | null; error: unknown }> {
  const { data, error } = await getSupabaseBrowserClient()
    .from('user_profiles')
    .select('profile_data')
    .eq('id', userId)
    .single()

  const profile = (data?.profile_data as { horoscope?: HoroscopeProfile } | null)?.horoscope ?? null
  return { profile, error }
}
