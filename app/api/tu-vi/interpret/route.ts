import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getServiceSupabaseClient } from '@/lib/supabase-admin'
import {
  buildInterpretationPrompt,
  lunarDayKey,
  type InterpretationLang,
  type ParsedSection,
  parseInterpretationSections,
  profileFingerprint,
  readCachedInterpretation,
  vietnamTodaySolar,
} from '@/lib/horoscope-interpretation'
import { buildReading } from '@/lib/tuvi/reading'
import { parseHoroscopeProfile } from '@/lib/horoscope-profile'

export const dynamic = 'force-dynamic'

type StoredInterpretation = {
  sections: Record<string, ParsedSection>
  lunarDay: string
  profileFingerprint: string
  generatedAt: string
}

const DEEPSEEK_TIMEOUT_MS = 30_000

/**
 * Readings are stored one per language under `profile_data.horoscopeReading`.
 * A single shared slot would make every language toggle a cache miss that bills
 * a fresh completion and overwrites the other language.
 */
function readingsByLang(stored: unknown): Record<string, unknown> {
  if (typeof stored !== 'object' || stored === null) return {}
  // A record written before this was a per-language map holds `sections` at the
  // top level; treat that shape as empty rather than nesting it under a language.
  if ('sections' in (stored as Record<string, unknown>)) return {}
  return stored as Record<string, unknown>
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const userId = user.id

  // maybeSingle: a user with no user_profiles row yet has no profile, which is a
  // 404 for this route, not a backend failure.
  const { data: row, error: profileError } = await supabase
    .from('user_profiles')
    .select('profile_data')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) {
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 502 })
  }

  // The reading is recomputed here from the caller's own stored profile — the
  // client never supplies the numbers, so it cannot steer the interpretation.
  const profileData = (row?.profile_data ?? {}) as Record<string, unknown>
  const profile = parseHoroscopeProfile(profileData.horoscope)
  if (!profile) {
    return NextResponse.json({ error: 'no_profile' }, { status: 404 })
  }

  // The reader's language decides the prose, and is part of the cache identity.
  let lang: InterpretationLang = 'vi'
  try {
    const body = (await request.json()) as { lang?: unknown }
    if (body?.lang === 'en') lang = 'en'
  } catch {
    // No body, or not JSON — Vietnamese stays the default.
  }

  const fingerprint = profileFingerprint(profile)
  const today = vietnamTodaySolar(new Date())
  const lunarDay = lunarDayKey(today)

  const cached = readCachedInterpretation(
    readingsByLang(profileData.horoscopeReading)[lang],
    fingerprint,
    lunarDay,
  )
  if (cached) {
    return NextResponse.json({ sections: cached, cached: true })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'interpretation_unavailable' }, { status: 503 })
  }

  // Claim a generation slot BEFORE calling DeepSeek, atomically and in a table
  // the browser cannot write. The reading cache is keyed on the birth-data
  // fingerprint, so without this an edit-then-regenerate loop bills without
  // limit; claiming first also means a failed generation still consumes its
  // slot, so the retry button cannot become a spend loop. Free for every role
  // either way (spec FR-018) — an abuse cap, not a gate.
  const { data: claimed, error: claimError } = await supabase.rpc('claim_tuvi_generation', {
    p_lunar_day: lunarDay,
  })
  if (claimError) {
    // The counter is unavailable (sql/tuvi_daily_usage.sql not applied yet).
    // Fail open rather than taking the feature down, but say so loudly.
    console.error('[tu-vi] generation counter unavailable:', claimError.message)
  } else if (claimed === false) {
    return NextResponse.json({ error: 'daily_limit_reached' }, { status: 429 })
  }
  const slotClaimed = !claimError && claimed === true

  // Refund only when no completion was produced at all — a network timeout or a
  // non-2xx response. A 200 whose body fails validation WAS billed, so refunding
  // it would turn the retry button back into an unbounded spend loop.
  async function refundSlot() {
    if (!slotClaimed) return
    try {
      // Through the service role, not the user's session: a refund the client
      // could call itself would let anyone reset their own cap.
      await getServiceSupabaseClient().rpc('refund_tuvi_generation', {
        p_user_id: userId,
        p_lunar_day: lunarDay,
      })
    } catch (error) {
      // A missing service-role key must not turn a valid response into a 500.
      // Same fail-open stance as a missing counter: log it and keep serving.
      console.error('[tu-vi] slot refund failed:', error)
    }
  }

  // Two simultaneous first views both miss the cache above and both claim a
  // slot. Re-reading here catches the case where the other one has already
  // finished, so only one of them pays for a completion.
  const { data: recheck } = await supabase
    .from('user_profiles')
    .select('profile_data')
    .eq('id', userId)
    .maybeSingle()
  const justCached = readCachedInterpretation(
    readingsByLang(((recheck?.profile_data ?? {}) as Record<string, unknown>).horoscopeReading)[
      lang
    ],
    fingerprint,
    lunarDay,
  )
  if (justCached) {
    await refundSlot()
    return NextResponse.json({ sections: justCached, cached: true })
  }

  const prompt = buildInterpretationPrompt(buildReading(profile, today), profile, lang)

  let res: Response
  try {
    res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.6,
        // Bounded so a runaway generation cannot be truncated mid-JSON, which
        // would fail validation after already being billed. Raised from 1600
        // for the 11-section reading (was 7) with longer, deeper prose per
        // section.
        max_tokens: 2800,
      }),
      // Without this the route can hang for as long as the upstream keeps the
      // socket open, holding the request and the user's loading state with it.
      signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
    })
  } catch {
    await refundSlot()
    return NextResponse.json({ error: 'interpretation_unavailable' }, { status: 504 })
  }

  if (!res.ok) {
    await refundSlot()
    return NextResponse.json({ error: 'interpretation_unavailable' }, { status: 502 })
  }

  // A 200 with a non-JSON body (a proxy or captive portal) must read as an
  // upstream failure, not throw out of the handler as an opaque 500.
  let sections: Record<string, ParsedSection> | null
  let truncated = false
  try {
    const data = await res.json()
    truncated = data.choices?.[0]?.finish_reason === 'length'
    sections = parseInterpretationSections(JSON.parse(data.choices?.[0]?.message?.content))
  } catch {
    sections = null
  }
  if (!sections) {
    // A completion cut short by max_tokens is a limit we set, not abuse, so the
    // slot goes back — otherwise a few retries would lock the user out of a
    // reading they never received. A malformed body for any other reason was
    // delivered and billed, so it keeps its slot.
    if (truncated) {
      console.error('[tu-vi] completion truncated by max_tokens')
      await refundSlot()
    }
    return NextResponse.json({ error: 'interpretation_unavailable' }, { status: 502 })
  }

  // Re-read profile_data before writing: the DeepSeek call takes seconds, so the
  // user may have saved a birth-data edit, or a concurrent first view may have
  // cached its own reading, in the meantime.
  const { data: fresh, error: freshError } = await supabase
    .from('user_profiles')
    .select('profile_data')
    .eq('id', userId)
    .maybeSingle()

  // A failed re-read gives no basis for a safe merge: writing the pre-call
  // snapshot back would revert whatever was saved during the call. Return the
  // interpretation without caching it instead.
  if (freshError || !fresh) {
    return NextResponse.json({ sections, cached: false })
  }

  const freshData = (fresh.profile_data ?? {}) as Record<string, unknown>
  const freshProfile = parseHoroscopeProfile(freshData.horoscope)

  // Birth data changed while this reading was being written about the old data.
  if (!freshProfile || profileFingerprint(freshProfile) !== fingerprint) {
    return NextResponse.json({ sections, cached: false })
  }

  // A concurrent request already cached a reading for the same day and birth
  // data. Serve that one so two simultaneous first views agree, instead of
  // overwriting it with a second, differently-worded reading.
  const existingReadings = readingsByLang(freshData.horoscopeReading)
  const raced = readCachedInterpretation(existingReadings[lang], fingerprint, lunarDay)
  if (raced) {
    return NextResponse.json({ sections: raced, cached: true })
  }

  const stored: StoredInterpretation = {
    sections,
    lunarDay,
    profileFingerprint: fingerprint,
    generatedAt: new Date().toISOString(),
  }
  // Merge into profile_data rather than replacing it — the column also holds the
  // horoscope profile itself and other per-user fields.
  const { error: writeError } = await supabase
    .from('user_profiles')
    .update({
      profile_data: {
        ...freshData,
        horoscopeReading: { ...existingReadings, [lang]: stored },
      },
    })
    .eq('id', userId)

  // The reading is valid either way, but a failed write means every later view
  // this lunar day pays for another completion — report it rather than hide it.
  return NextResponse.json({ sections, cached: false, stored: !writeError })
}
