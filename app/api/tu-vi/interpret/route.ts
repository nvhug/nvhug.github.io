import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logAiUsage, normalizeUsage } from '@/lib/ai-usage'
import { getServiceSupabaseClient } from '@/lib/supabase-admin'
import { isAIFreeModeEnabled } from '@/lib/ai-free-mode'
import { callGeminiWithDeepSeekFallback, isProviderConfigured } from '@/lib/ai-provider'
import {
  buildInterpretationPrompt,
  INTERPRETATION_VERSION,
  isUnlimitedTuviRole,
  lunarDayKey,
  lunarMonthKey,
  type InterpretationLang,
  type ParsedSection,
  missingRequiredSections,
  parseInterpretationSections,
  profileFingerprint,
  readCachedInterpretation,
  SECTIONS_MAX_TOKENS,
  TUVI_DAILY_LIMIT,
  vietnamTodaySolar,
} from '@/lib/horoscope-interpretation'
import { buildReading } from '@/lib/tuvi/reading'
import { parseHoroscopeProfile } from '@/lib/horoscope-profile'

export const dynamic = 'force-dynamic'
// The completion itself runs ~20-33s, so the platform default would cut the
// request off before the reading is written. Longer than the two attempt
// timeouts below combined, which is what should end a slow generation.
export const maxDuration = 60

// The provider call is now up to two sequential attempts inside that one maxDuration, so
// neither can be given the whole window. The fallback runs on DeepSeek, and this route's
// own measured worst case (see `sections generation budget` in
// horoscope-interpretation.test.ts: ~120 tokens/sec sustained, SECTIONS_MAX_TOKENS=4000)
// needs at least ~33.3s to finish a genuinely long reading — sizing it any lower turns a
// slow-but-healthy fallback completion into a timeout that refunds the user's daily slot
// for nothing. 35s covers that with margin; the primary gets what's left, with 5s held
// back for the DB work (cache read/write, usage logging) that follows either attempt.
export const SECTIONS_PRIMARY_TIMEOUT_MS = 20_000
export const SECTIONS_FALLBACK_TIMEOUT_MS = 35_000

type StoredInterpretation = {
  sections: Record<string, ParsedSection>
  /** Which prompt wrote this. A record from an older one is regenerated rather
      than served, so a prompt fix is not silently held back by the cache. */
  version: number
  lunarMonth: string
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
  // Read the cache, and stop there rather than buying a completion.
  //
  // Opening a page should not spend money. Generation is triggered explicitly — by saving
  // birth data, or by asking for it — so the reading screen asks in this mode and shows a
  // button when there is nothing stored, instead of quietly billing on every mount.
  let cacheOnly = false
  try {
    const body = (await request.json()) as { lang?: unknown; cacheOnly?: unknown }
    if (body?.lang === 'en') lang = 'en'
    cacheOnly = body?.cacheOnly === true
  } catch {
    // No body, or not JSON — Vietnamese stays the default.
  }

  const fingerprint = profileFingerprint(profile)
  const today = vietnamTodaySolar(new Date())
  // Two keys, two jobs. The fuse below resets every day, because its job is to stop a
  // birth-hour edit loop billing without limit. What the reading is still VALID for is a
  // different question: nothing in it is derived from the day, so it holds for the whole
  // lunar month. Sharing one key between them threw away a good reading every midnight.
  const lunarDay = lunarDayKey(today)
  const lunarMonth = lunarMonthKey(today)

  const cached = readCachedInterpretation(
    readingsByLang(profileData.horoscopeReading)[lang],
    fingerprint,
    lunarMonth,
  )
  if (cached?.current) {
    return NextResponse.json({ ...cached, cached: true })
  }

  if (cacheOnly) {
    // A reading from an older prompt is still worth showing — better than a button that
    // asks the reader to pay for prose they already have a version of.
    if (cached) return NextResponse.json({ ...cached, cached: true, stale: true })
    return NextResponse.json({ needsGeneration: true })
  }

  // Either key is enough: the router skips straight to whichever provider is
  // configured. Only having neither leaves nothing to call.
  if (!isProviderConfigured()) {
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
    || await isAIFreeModeEnabled(supabase)

  let claimError: { message: string } | null = null
  let claimed: unknown = null
  if (!unlimited) {
    const result = await supabase.rpc('claim_tuvi_generation', { p_lunar_day: lunarDay })
    claimError = result.error
    claimed = result.data
    if (claimError) {
      // The counter is unavailable (sql/53.tuvi_daily_usage.sql not applied yet).
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
    lunarMonth,
  )
  if (justCached?.current) {
    await refundSlot()
    return NextResponse.json({ ...justCached, cached: true })
  }

  const prompt = buildInterpretationPrompt(buildReading(profile, today), profile, lang)

  // Before the call. Peak windows begin and end on the hour and the two sequential
  // attempts can together run up to SECTIONS_PRIMARY_TIMEOUT_MS + SECTIONS_FALLBACK_TIMEOUT_MS,
  // so pricing off the response time under-reports a call that straddles a boundary.
  const startedAt = new Date()

  const result = await callGeminiWithDeepSeekFallback({
    geminiModel: 'gemini-3.1-flash-lite',
    deepseekModel: 'deepseek-v4-flash',
    prompt,
    temperature: 0.6,
    // Sized from measured completions — see SECTIONS_MAX_TOKENS. Covers the
    // 11-section reading only; the twelve-palace block has its own route.
    maxTokens: SECTIONS_MAX_TOKENS,
    primaryTimeoutMs: SECTIONS_PRIMARY_TIMEOUT_MS,
    fallbackTimeoutMs: SECTIONS_FALLBACK_TIMEOUT_MS,
  })

  // Neither provider produced a completion, so nothing was billed and there is no
  // usage to record. 504 when nothing came back at all, 502 when both refused.
  if (!result.ok) {
    await refundSlot()
    return NextResponse.json(
      { error: 'interpretation_unavailable' },
      { status: result.network ? 504 : 502 },
    )
  }

  // A 200 whose text is not the JSON object the prompt asked for must read as an
  // upstream failure, not throw out of the handler as an opaque 500.
  let sections: Record<string, ParsedSection> | null
  // Enough to name the cause of a rejected completion without logging the whole
  // reading: which required keys were absent, how long the body was, and why the
  // model stopped.
  let diagnosis = `provider=${result.provider} truncated=${result.truncated} chars=${result.text.length}`

  try {
    const body = JSON.parse(result.text)
    sections = parseInterpretationSections(body)
    if (!sections) {
      diagnosis += ` missing=[${missingRequiredSections(body).join(',')}] topLevel=[${Object.keys(
        body as Record<string, unknown>,
      ).join(',')}]`
    }
  } catch (error) {
    sections = null
    diagnosis += ` threw=${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`
  }
  const recordUsage = (outcome: 'success' | 'error') =>
    logAiUsage({
      surface: 'tuvi_interpret',
      provider: result.provider,
      model: result.model,
      usage: normalizeUsage(result.usage, result.provider),
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
    // reading they never received. A complete body that simply failed validation
    // WAS delivered and billed, so it keeps its slot: otherwise the retry button
    // is a spend loop.
    // `diagnosis` already names the cause precisely; it went only to the server log,
    // where it is out of reach of anyone looking at the failing request itself.
    const detail = {
      truncated: result.truncated,
      provider: result.provider,
      raw: result.text.slice(0, 200),
    }
    if (result.truncated) {
      console.error('[tu-vi] completion incomplete:', diagnosis)
      await refundSlot()
      return NextResponse.json({ error: 'interpretation_unavailable', ...detail }, { status: 502 })
    }
    console.error('[tu-vi] completion rejected by validation:', diagnosis)
    return NextResponse.json({ error: 'interpretation_unavailable', ...detail }, { status: 502 })
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
  const raced = readCachedInterpretation(existingReadings[lang], fingerprint, lunarMonth)
  if (raced?.current) {
    return NextResponse.json({ ...raced, cached: true })
  }

  const stored: StoredInterpretation = {
    sections,
    version: INTERPRETATION_VERSION,
    lunarMonth,
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
