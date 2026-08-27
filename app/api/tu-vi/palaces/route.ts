import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logAiUsage, normalizeUsage, servedModel } from '@/lib/ai-usage'
import { getServiceSupabaseClient } from '@/lib/supabase-admin'
import {
  buildPalacePrompt,
  canReadPalaces,
  isUnlimitedTuviRole,
  lunarDayKey,
  PALACE_BATCHES,
  palaceReadingsToList,
  PALACE_VERSION,
  type InterpretationLang,
  type PalaceReading,
  parsePalaceReadings,
  profileFingerprint,
  readCachedPalaces,
  vietnamTodaySolar,
} from '@/lib/horoscope-interpretation'
import { buildReading } from '@/lib/tuvi/reading'
import { parseHoroscopeProfile } from '@/lib/horoscope-profile'

export const dynamic = 'force-dynamic'
// Declared rather than inherited, so the platform's ceiling is not what decides
// whether this can succeed. The batches run concurrently, so the wall time is one
// batch, not both.
export const maxDuration = 60

// Comfortably under maxDuration, so the route answers with a diagnosable error
// instead of being killed mid-flight by the platform.
const DEEPSEEK_TIMEOUT_MS = 50_000

/**
 * Counted in its own bucket, not the sections one. The counter is keyed on an
 * opaque day string, so suffixing it gives the palace readings their own daily
 * allowance — otherwise one page view would spend two of the six and a reader
 * doing ordinary things would hit the cap in three loads.
 */
function palaceUsageKey(lunarDay: string): string {
  return `${lunarDay}:palaces`
}

/** One record per language, same reason the sections cache is per-language: a
    shared slot would make every language toggle bill a fresh completion. */
function byLang(stored: unknown): Record<string, unknown> {
  if (typeof stored !== 'object' || stored === null) return {}
  return stored as Record<string, unknown>
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const userId = user.id

  const { data: row, error: profileError } = await supabase
    .from('user_profiles')
    // `role` rides along on the row already being read, so the cap exemption
    // below costs no extra query.
    .select('profile_data, role')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) {
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 502 })
  }

  // Recomputed here from the caller's own stored profile — the client never
  // supplies the chart, so it cannot steer what the model is asked about.
  const profileData = (row?.profile_data ?? {}) as Record<string, unknown>
  const profile = parseHoroscopeProfile(profileData.horoscope)
  if (!profile) {
    return NextResponse.json({ error: 'no_profile' }, { status: 404 })
  }

  let lang: InterpretationLang = 'vi'
  try {
    const body = (await request.json()) as { lang?: unknown }
    if (body?.lang === 'en') lang = 'en'
  } catch {
    // No body, or not JSON — Vietnamese stays the default.
  }

  const today = vietnamTodaySolar(new Date())
  const reading = buildReading(profile, today)

  // Without a birth hour the palaces have no names, so there is nothing to ask
  // and no completion worth billing. An empty answer, not an error.
  if (!canReadPalaces(reading)) {
    return NextResponse.json({ palaces: [], needHour: true })
  }

  const fingerprint = profileFingerprint(profile)
  const lunarDay = lunarDayKey(today)

  const cached = readCachedPalaces(byLang(profileData.horoscopePalaces)[lang], fingerprint, lunarDay)
  if (cached) {
    return NextResponse.json({ palaces: palaceReadingsToList(cached), cached: true })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'interpretation_unavailable' }, { status: 503 })
  }

  // Same exemption the sections route makes: the cap is an abuse brake, and an
  // admin or a paying reader is not the account it is aimed at.
  const unlimited = isUnlimitedTuviRole(row?.role as string | null | undefined)

  let claimError: { message: string } | null = null
  let claimed: unknown = null
  if (!unlimited) {
    const result = await supabase.rpc('claim_tuvi_generation', {
      p_lunar_day: palaceUsageKey(lunarDay),
    })
    claimError = result.error
    claimed = result.data
    if (claimError) {
      console.error('[tu-vi] palace counter unavailable:', claimError.message)
    } else if (claimed === false) {
      return NextResponse.json({ error: 'daily_limit_reached' }, { status: 429 })
    }
  }
  const slotClaimed = !unlimited && !claimError && claimed === true

  async function refundSlot() {
    if (!slotClaimed) return
    try {
      // Through the service role: a refund the browser could call itself would
      // let anyone reset their own cap.
      await getServiceSupabaseClient().rpc('refund_tuvi_generation', {
        p_user_id: userId,
        p_lunar_day: palaceUsageKey(lunarDay),
      })
    } catch (error) {
      console.error('[tu-vi] palace slot refund failed:', error)
    }
  }

  /**
   * One batch of palaces. An empty result says the batch produced nothing usable,
   * and `refundable` distinguishes the two reasons that matters for: a completion
   * that never arrived (timeout, upstream error, cut off by our own ceiling) is
   * refundable; one that arrived whole and was rejected was billed and is not.
   */
  async function generateBatch(
    indexes: readonly number[],
  ): Promise<{ palaces: Record<string, PalaceReading>; refundable: boolean }> {
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
          messages: [{ role: 'user', content: buildPalacePrompt(reading, lang, indexes) }],
          response_format: { type: 'json_object' },
          // v4-flash is a reasoning model and its reasoning tokens are spent out of
          // max_tokens BEFORE any content is produced. The budget below was measured
          // against deepseek-chat, which reasons not at all, so leaving thinking on burns
          // the whole allowance on reasoning and returns finish_reason 'length' with an
          // empty body — every reading fails. Nothing here asks for chain-of-thought: the
          // prompt wants JSON.
          thinking: { type: 'disabled' },
          temperature: 0.6,
          // Six palaces measured ~2350 output tokens; this leaves real headroom
          // without approaching what the request has time to receive.
          max_tokens: 3500,
        }),
        signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
      })
    } catch (error) {
      console.error('[tu-vi] palace batch never returned:', error)
      return { palaces: {}, refundable: true }
    }

    if (!res.ok) {
      console.error('[tu-vi] palace batch upstream returned', res.status)
      return { palaces: {}, refundable: true }
    }

    try {
      const data = await res.json()

      // Inside generateBatch on purpose: the two batches are two provider calls and are
      // billed as two, so they are recorded as two (FR-001a). The insert is bounded at
      // 1s, which is negligible against the 50s provider ceiling this route already sets.
      //
      // The outcome is decided after parsing, not assumed here. A batch that comes back
      // whole and yields no usable palaces was still billed in full, and filing it as a
      // success is what would make that wasted spend invisible (FR-005a). Note this is a
      // different question from `refundable`, which is about the user's daily allowance.
      const recordUsage = (outcome: 'success' | 'error') =>
        logAiUsage({
          surface: 'tuvi_palaces',
          provider: 'deepseek',
          model: servedModel(data, 'deepseek-v4-flash'),
          usage: normalizeUsage(data.usage, 'deepseek'),
          outcome,
          userId,
          actor: 'user',
        })

      const content: string = data.choices?.[0]?.message?.content ?? ''
      const truncated = data.choices?.[0]?.finish_reason === 'length'
      const palaces = parsePalaceReadings(JSON.parse(content))
      if (Object.keys(palaces).length === 0) {
        await recordUsage('error')
        console.error(
          `[tu-vi] palace batch empty: finish_reason=${data.choices?.[0]?.finish_reason} chars=${content.length}`,
        )
        // Truncation is a ceiling we set, not abuse, so it stays refundable.
        return { palaces: {}, refundable: truncated }
      }
      await recordUsage('success')
      return { palaces, refundable: false }
    } catch (error) {
      // A timeout fires just as readily while the body is still streaming as it
      // does on the request itself, and that is no answer at all rather than a
      // malformed one.
      const aborted =
        error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
      console.error(
        `[tu-vi] palace batch unreadable: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      )
      return { palaces: {}, refundable: aborted }
    }
  }

  // Concurrent, and independent: a batch that fails costs only its own six
  // palaces, and the reader still gets the other half.
  const batches = await Promise.all(PALACE_BATCHES.map((indexes) => generateBatch(indexes)))
  const palaces = Object.assign({}, ...batches.map((batch) => batch.palaces)) as Record<
    string,
    PalaceReading
  >

  if (Object.keys(palaces).length === 0) {
    // Refund only when no batch produced a billed completion at all.
    if (batches.every((batch) => batch.refundable)) await refundSlot()
    return NextResponse.json({ error: 'interpretation_unavailable' }, { status: 502 })
  }

  if (batches.some((batch) => Object.keys(batch.palaces).length === 0)) {
    // Cached as-is rather than discarded: the palaces that did arrive are worth
    // keeping, and the panel offers a retry for the ones that did not.
    console.error('[tu-vi] palace generation partial:', Object.keys(palaces).length, 'of 12')
  }

  // Re-read before writing: the call takes tens of seconds, so the reader may
  // have saved a birth-data edit in the meantime.
  const { data: fresh, error: freshError } = await supabase
    .from('user_profiles')
    .select('profile_data')
    .eq('id', userId)
    .maybeSingle()
  if (freshError || !fresh) {
    return NextResponse.json({ palaces: palaceReadingsToList(palaces), cached: false })
  }

  const freshData = (fresh.profile_data ?? {}) as Record<string, unknown>
  const freshProfile = parseHoroscopeProfile(freshData.horoscope)
  if (!freshProfile || profileFingerprint(freshProfile) !== fingerprint) {
    return NextResponse.json({ palaces: palaceReadingsToList(palaces), cached: false })
  }

  const existing = byLang(freshData.horoscopePalaces)
  const { error: writeError } = await supabase
    .from('user_profiles')
    .update({
      profile_data: {
        ...freshData,
        horoscopePalaces: {
          ...existing,
          [lang]: {
            palaces: palaceReadingsToList(palaces),
            version: PALACE_VERSION,
            lunarDay,
            profileFingerprint: fingerprint,
            generatedAt: new Date().toISOString(),
          },
        },
      },
    })
    .eq('id', userId)

  if (writeError) {
    // Still a valid answer, but every later view this lunar day pays for another
    // completion — report it rather than hide it.
    console.error('[tu-vi] palace cache write failed:', writeError.message)
  }
  return NextResponse.json({ palaces: palaceReadingsToList(palaces), cached: false, stored: !writeError })
}
