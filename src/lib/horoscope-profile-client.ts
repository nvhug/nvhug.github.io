import { getSupabaseBrowserClient } from './supabase-browser'
import { parseHoroscopeProfile, type HoroscopeProfile } from './horoscope-profile'

export async function fetchHoroscopeProfile(
  userId: string
): Promise<{ profile: HoroscopeProfile | null; error: unknown }> {
  const { data, error } = await getSupabaseBrowserClient()
    .from('user_profiles')
    .select('profile_data')
    .eq('id', userId)
    // maybeSingle, not single: a user without a user_profiles row simply has no
    // horoscope profile yet, which must read as "not onboarded", not as an error.
    .maybeSingle()

  // Validated here, once, so every caller agrees on what counts as a profile. A
  // malformed stored record reads as "not onboarded" — the onboarding form can
  // then overwrite it — instead of one page accepting it and another rejecting
  // it, which would bounce the user between the two forever.
  const raw = (data?.profile_data as { horoscope?: unknown } | null)?.horoscope
  return { profile: parseHoroscopeProfile(raw), error }
}
