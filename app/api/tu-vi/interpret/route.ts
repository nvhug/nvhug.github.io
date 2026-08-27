import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logAiUsage, normalizeUsage, servedModel } from '@/lib/ai-usage'
import { getServiceSupabaseClient } from '@/lib/supabase-admin'
import {
  buildInterpretationPrompt,
  INTERPRETATION_VERSION,
  isUnlimitedTuviRole,
  lunarDayKey,
  type InterpretationLang,
  type ParsedSection,
  missingRequiredSections,
  parseInterpretationSections,
  profileFingerprint,
  readCachedInterpretation,
  SECTIONS_MAX_TOKENS,
  SECTIONS_TIMEOUT_MS,
  TUVI_DAILY_LIMIT,
  vietnamTodaySolar,
} from '@/lib/horoscope-interpretation'
import { buildReading } from '@/lib/tuvi/reading'
import { parseHoroscopeProfile } from '@/lib/horoscope-profile'

export const dynamic = 'force-dynamic'
// The completion itself runs ~20-33s, so the platform default would cut the
// request off before the reading is written. Longer than SECTIONS_TIMEOUT_MS,
// which is what should end a slow generation.
export const maxDuration = 60

type StoredInterpretation = {
  sections: Record<string, ParsedSection>
  /** Which prompt wrote this. A record from an older one is regenerated rather
      than served, so a prompt fix is not silently held back by the cache. */
  version: number
  lunarDay: string
  profileFingerprint: string
  generatedAt: string
}

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
    // `role` rides along on the row already being read — the cap exemption below
    // costs no extra query.
    .select('profile_data, role')
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
  if (cached?.current) {
    return NextResponse.json({ ...cached, cached: true })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'interpretation_unavailable' }, { status: 503 })
  }

  // Claim a generation slot BEFORE calling DeepSeek, atomically and in a table
  // the browser cannot write. The reading cache is keyed on the birth-data
  // fingerprint, so without this an edit-then-regenerate loop bills without
  // limit; claiming first also means a failed generation still consumes its
  // slot, so the retry button cannot become a spend loop. The reading itself
  // stays free for every role (spec FR-018) — this is an abuse cap, not a gate,
  // and admins and paying readers are not the account it is aimed at, so they
  // never claim a slot and never spend one.
  const unlimited = isUnlimitedTuviRole(row?.role as string | null | undefined)

  let claimError: { message: string } | null = null
  let claimed: unknown = null
  if (!unlimited) {
    const result = await supabase.rpc('claim_tuvi_generation', { p_lunar_day: lunarDay })
    claimError = result.error
    claimed = result.data
    if (claimError) {
      // The counter is unavailable (sql/tuvi_daily_usage.sql not applied yet).
      // Fail open rather than taking the feature down, but say so loudly.
      console.error('[tu-vi] generation counter unavailable:', claimError.message)
    } else if (claimed === false) {
      if (cached) {
        return NextResponse.json({ ...cached, cached: true, stale: true })
      }
      return NextResponse.json({ error: 'daily_limit_reached' }, { status: 429 })
    }
  }
  const slotClaimed = !unlimited && !claimError && claimed === true

  // How many are left after this one, for the line that warns before the cap is
  // reached rather than at it. Read only when a slot was actually spent: on a
  // cache hit nothing changed, and an unlimited role has nothing to count.
  let remaining: number | null = null
  if (slotClaimed) {
    const { data: usage } = await supabase
      .from('tuvi_daily_usage')
      .select('used_count')
      .eq('user_id', userId)
      .eq('lunar_day', lunarDay)
      .maybeSingle()
    if (typeof usage?.used_count === 'number') {
      remaining = Math.max(0, TUVI_DAILY_LIMIT - usage.used_count)
    }
  }

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
  if (justCached?.current) {
    await refundSlot()
    return NextResponse.json({ ...justCached, cached: true })
  }

  const prompt = buildInterpretationPrompt(buildReading(profile, today), profile, lang)

  // Before the call. Peak windows begin and end on the hour and the model gets 50 seconds,
  // so pricing off the response time under-reports a call that straddles a boundary.
  const startedAt = new Date()

  let res: Response
  try {
    res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        // See the note in tu-vi/palaces: reasoning tokens come out of max_tokens before
        // any content, and SECTIONS_MAX_TOKENS was measured against a model that does not
        // reason. Leaving this on truncates every reading to nothing.
        thinking: { type: 'disabled' },
        temperature: 0.6,
        // Sized from measured completions — see SECTIONS_MAX_TOKENS. Covers the
        // 11-section reading only; the twelve-palace block has its own route.
        max_tokens: SECTIONS_MAX_TOKENS,
      }),
      // Without this the route can hang for as long as the upstream keeps the
      // socket open, holding the request and the user's loading state with it.
      signal: AbortSignal.timeout(SECTIONS_TIMEOUT_MS),
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
  // Enough to name the cause of a rejected completion without logging the whole
  // reading: which required keys were absent, how long the body was, and why the
  // model stopped.
  let diagnosis = 'no body read'
  let aborted = false
  // Held until the outcome is known. This route already distinguishes a completion that
  // never arrived from one that arrived and failed validation, which is exactly the
  // distinction FR-005a needs — recording 'success' before that decision would file every
  // billed-but-rejected reading as a success and hide the spend it wasted.
  let usageBody: unknown = null

  try {
    const data = await res.json()
    usageBody = data
    truncated = data.choices?.[0]?.finish_reason === 'length'
    const content: string = data.choices?.[0]?.message?.content ?? ''
    diagnosis = `finish_reason=${data.choices?.[0]?.finish_reason} chars=${content.length}`
    const body = JSON.parse(content)
    sections = parseInterpretationSections(body)
    if (!sections) {
      diagnosis += ` missing=[${missingRequiredSections(body).join(',')}] topLevel=[${Object.keys(
        body as Record<string, unknown>,
      ).join(',')}]`
    }
  } catch (error) {
    sections = null
    aborted = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    diagnosis += ` threw=${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`
  }
  const recordUsage = (outcome: 'success' | 'error') =>
    logAiUsage({
      surface: 'tuvi_interpret',
      provider: 'deepseek',
      model: servedModel(usageBody, 'deepseek-v4-flash'),
      usage: normalizeUsage((usageBody as { usage?: unknown } | null)?.usage, 'deepseek'),
      outcome,
      userId,
      actor: 'user',
      at: startedAt,
    })

  if (!sections) {
    // Whatever the reason, the reading failed. Cost is whatever the provider reported —
    // zero when nothing arrived, real when a complete body was rejected. The refund below
    // is a separate question about the user's daily allowance, not about the money.
    await recordUsage('error')

    // A completion cut short by max_tokens is a limit we set, not abuse, so the
    // slot goes back — otherwise a few retries would lock the user out of a
    // reading they never received. A malformed body for any other reason was
    // delivered and billed, so it keeps its slot.
    // A completion cut short by max_tokens is a limit we set, and one cut short
    // by the timeout produced nothing at all — neither is abuse, so the slot goes
    // back. A complete body that simply failed validation WAS delivered and
    // billed, so it keeps its slot: otherwise the retry button is a spend loop.
    if (truncated || aborted) {
      console.error('[tu-vi] completion incomplete:', diagnosis)
      await refundSlot()
      return NextResponse.json(
        { error: 'interpretation_unavailable' },
        { status: aborted ? 504 : 502 },
      )
    }
    console.error('[tu-vi] completion rejected by validation:', diagnosis)
    return NextResponse.json({ error: 'interpretation_unavailable' }, { status: 502 })
  }

  await recordUsage('success')

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
    return NextResponse.json({ sections, cached: false, remaining })
  }

  const freshData = (fresh.profile_data ?? {}) as Record<string, unknown>
  const freshProfile = parseHoroscopeProfile(freshData.horoscope)

  // Birth data changed while this reading was being written about the old data.
  if (!freshProfile || profileFingerprint(freshProfile) !== fingerprint) {
    return NextResponse.json({ sections, cached: false, remaining })
  }

  // A concurrent request already cached a reading for the same day and birth
  // data. Serve that one so two simultaneous first views agree, instead of
  // overwriting it with a second, differently-worded reading.
  const existingReadings = readingsByLang(freshData.horoscopeReading)
  const raced = readCachedInterpretation(existingReadings[lang], fingerprint, lunarDay)
  if (raced?.current) {
    return NextResponse.json({ ...raced, cached: true })
  }

  const stored: StoredInterpretation = {
    sections,
    version: INTERPRETATION_VERSION,
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
  return NextResponse.json({ sections, cached: false, stored: !writeError, remaining })
}
