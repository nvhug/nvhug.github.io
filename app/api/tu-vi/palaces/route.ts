import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logAiUsage, normalizeUsage } from '@/lib/ai-usage'
import { callGeminiWithDeepSeekFallback, isProviderConfigured } from '@/lib/ai-provider'
import { getServiceSupabaseClient } from '@/lib/supabase-admin'
import { isAIFreeModeEnabled } from '@/lib/ai-free-mode'
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

// Per ATTEMPT, not a shared budget: the router may spend both back to back, so the two
// together (plus the cache re-read) still have to sit comfortably under maxDuration —
// which is why the old single 50s ceiling could not simply be reused for each. The
// fallback runs on DeepSeek at maxTokens=3500, which at this codebase's own measured
// ~120 tokens/sec sustained rate (see horoscope-interpretation.ts's
// MEASURED_TOKENS_PER_SECOND) needs at least ~29.2s to finish a genuinely long batch —
// sizing it lower turns a slow-but-healthy fallback into a timeout that discards a real,
// billed completion. 31s covers that with margin; the primary gets what's left, with 5s
// held back for the surrounding DB work (cache read/write, usage logging).
export const PALACE_PRIMARY_TIMEOUT_MS = 24_000
export const PALACE_FALLBACK_TIMEOUT_MS = 31_000
/** Matches this route's own `max_tokens: 3500` in generateBatch's DeepSeek call below. */
export const PALACE_MAX_TOKENS = 3500

/**
 * Why one batch produced nothing. The route returns 502 only when EVERY batch did, and
 * the batches are independent provider calls that can fail for different reasons — a flat
 * "interpretation_unavailable" says which of five causes fired: never arrived, arrived
 * cut off, arrived whole but empty, arrived unreadable, or the other batch's reason.
 */
interface BatchDiagnosis {
  cause: string
  truncated?: boolean
  provider?: string
  /** Bounded prefix of the completion, never the prompt — same rule ai-usage.ts follows. */
  raw?: string
}

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
  // See the note in tu-vi/interpret: opening a page must not spend money, so the reading
  // screen asks in cache-only mode and offers a button when nothing is stored.
  let cacheOnly = false
  try {
    const body = (await request.json()) as { lang?: unknown; cacheOnly?: unknown }
    if (body?.lang === 'en') lang = 'en'
    cacheOnly = body?.cacheOnly === true
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
  // Only the fuse needs a date. The palace readings themselves carry none: they describe
  // the natal chart, which does not move, so they are keyed on the birth data alone.
  const lunarDay = lunarDayKey(today)

  const cached = readCachedPalaces(byLang(profileData.horoscopePalaces)[lang], fingerprint)
  if (cached) {
    return NextResponse.json({ palaces: palaceReadingsToList(cached), cached: true })
  }

  if (cacheOnly) {
    return NextResponse.json({ palaces: [], needsGeneration: true })
  }

  // Either key alone is enough: the router treats a missing Gemini key as an unavailable
  // primary and goes straight to the fallback, so only having neither is unserviceable.
  if (!isProviderConfigured()) {
    return NextResponse.json({ error: 'interpretation_unavailable' }, { status: 503 })
  }

  // Same exemption the sections route makes: the cap is an abuse brake, and an
  // admin or a paying reader is not the account it is aimed at.
  const unlimited = isUnlimitedTuviRole(row?.role as string | null | undefined)
    || await isAIFreeModeEnabled(supabase)

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
  ): Promise<{ palaces: Record<string, PalaceReading>; refundable: boolean; diagnosis?: BatchDiagnosis }> {
    // Captured before the call, not after it. DeepSeek's peak windows begin and end on the
    // hour and a batch may spend both attempts back to back, so one starting at 09:59:40
    // and returning at 10:00:30 was billed at the peak rate while being priced off-peak — a
    // clean 50% under-report. It also keeps the row in the calendar day it belongs to.
    const startedAt = new Date()

    const result = await callGeminiWithDeepSeekFallback({
      geminiModel: 'gemini-3.1-flash-lite',
      deepseekModel: 'deepseek-v4-flash',
      prompt: buildPalacePrompt(reading, lang, indexes),
      temperature: 0.6,
      // Six palaces measured ~2350 output tokens; this leaves real headroom
      // without approaching what the request has time to receive.
      maxTokens: PALACE_MAX_TOKENS,
      primaryTimeoutMs: PALACE_PRIMARY_TIMEOUT_MS,
      fallbackTimeoutMs: PALACE_FALLBACK_TIMEOUT_MS,
    })

    // One branch, not two: a transport failure — from either provider — means nothing was
    // billed for this batch, which is the same answer the separate timeout and non-2xx
    // branches used to give.
    if (!result.ok) {
      console.error(
        '[tu-vi] palace batch failed:',
        result.network ? 'network/timeout' : 'upstream error',
      )
      return {
        palaces: {},
        refundable: true,
        diagnosis: { cause: result.network ? 'network/timeout' : 'upstream error' },
      }
    }

    try {
      // Inside generateBatch on purpose: the two batches are two provider calls and are
      // billed as two, so they are recorded as two (FR-001a). The insert is bounded at
      // 1s, which is negligible against the provider ceilings this route already sets.
      //
      // The outcome is decided after parsing, not assumed here. A batch that comes back
      // whole and yields no usable palaces was still billed in full, and filing it as a
      // success is what would make that wasted spend invisible (FR-005a). Note this is a
      // different question from `refundable`, which is about the user's daily allowance.
      //
      // Which provider served it is read off the result, not assumed: the fallback bills a
      // different account at a different rate, so recording the primary either way would
      // attribute DeepSeek's spend to Gemini.
      const recordUsage = (outcome: 'success' | 'error') =>
        logAiUsage({
          surface: 'tuvi_palaces',
          provider: result.provider,
          model: result.model,
          usage: normalizeUsage(result.usage, result.provider),
          outcome,
          userId,
          actor: 'user',
          at: startedAt,
        })

      const content = result.text
      const palaces = parsePalaceReadings(JSON.parse(content))
      if (Object.keys(palaces).length === 0) {
        await recordUsage('error')
        console.error(
          `[tu-vi] palace batch empty: truncated=${result.truncated} chars=${content.length}`,
        )
        // Truncation is a ceiling we set, not abuse, so it stays refundable.
        return {
          palaces: {},
          refundable: result.truncated,
          diagnosis: {
            cause: 'no palaces in a completed body',
            truncated: result.truncated,
            provider: result.provider,
            raw: content.slice(0, 200),
          },
        }
      }
      await recordUsage('success')
      return { palaces, refundable: false }
    } catch (error) {
      // Only JSON.parse and parsePalaceReadings run in here now — the router owns the
      // transport, so a timeout can no longer surface at this point the way it did while
      // the response body was still being streamed here. What is left is a completion that
      // arrived whole and was billed, which is not refundable.
      console.error(
        `[tu-vi] palace batch unreadable: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      )
      return {
        palaces: {},
        refundable: false,
        diagnosis: {
          cause: 'unreadable body',
          truncated: result.truncated,
          provider: result.provider,
          raw: result.text.slice(0, 200),
        },
      }
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
    // One entry per batch: the two are independent provider calls and can fail for
    // different reasons, which is exactly what a single flat message used to hide.
    return NextResponse.json({
      error: 'interpretation_unavailable',
      batches: batches.map((batch) => batch.diagnosis ?? null),
    }, { status: 502 })
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
