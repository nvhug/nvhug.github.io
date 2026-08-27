'use client'

import { useEffect, useState } from 'react'
import { parseInterpretationSections } from '@/lib/horoscope-interpretation'

/** One scored section's AI text: a one-line "nhận xét" always shown next to
    the score, and the fuller 3-5 sentence reading shown on expand. */
export type InterpretationSection = { short: string; detail: string }
export type InterpretationSections = Record<string, InterpretationSection>

export type InterpretationState =
  | { status: 'loading' }
  /** `remaining` is present only right after a generation actually spent a
      slot — a cache hit spends nothing and an exempt role counts nothing, and
      neither has a number worth showing. */
  | { status: 'ready'; sections: InterpretationSections; remaining?: number }
  | { status: 'failed' }
  | { status: 'limited' }
  /** Nothing stored for this birth data and lunar month. The screen offers to
      generate rather than doing it unasked: opening a page should not spend money. */
  | { status: 'needsGeneration' }

/**
 * Loads on its own, after and independently of the computed reading, so a
 * slow or failed AI call degrades only the sections it feeds (spec FR-011).
 */
/**
 * In-flight requests, shared per (language, attempt).
 *
 * Two things make an un-deduplicated fetch here expensive rather than merely
 * wasteful: React Strict Mode mounts every effect twice in development, and the
 * route behind this claims a generation slot and bills a completion BEFORE it
 * can know the caller went away. Sharing the promise means the second mount
 * subscribes to the first request instead of paying for a second one.
 *
 * Entries are dropped as soon as they settle, so a later remount refetches
 * rather than replaying an old result — including an old failure.
 */
const inFlight = new Map<string, Promise<Response>>()

function fetchInterpretation(lang: string, attempt: number, cacheOnly: boolean): Promise<Response> {
  const key = `${lang}:${attempt}:${cacheOnly ? 'cache' : 'gen'}`
  const existing = inFlight.get(key)
  if (existing) return existing

  const request = fetch('/api/tu-vi/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lang, cacheOnly }),
  }).finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}

export function useInterpretation(lang: string) {
  const [state, setState] = useState<InterpretationState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // The mount reads the cache and stops. Only an explicit `generate()` — the button on the
  // reading screen, or saving birth data — is allowed to buy a completion.
  const [wantsGeneration, setWantsGeneration] = useState(false)
  // Resets to 'loading' the moment `lang` changes, during render rather than
  // in the effect below — the React-documented way to react to a changed
  // prop without a set-state-in-effect cascade.
  const [loadedLang, setLoadedLang] = useState(lang)
  if (lang !== loadedLang) {
    setLoadedLang(lang)
    setState({ status: 'loading' })
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // Not aborted on cleanup: the response is a paid, server-cached
        // generation, so letting it finish and land in the cache is strictly
        // better than throwing it away and asking for another one.
        const res = (await fetchInterpretation(lang, attempt, !wantsGeneration)).clone()
        if (res.status === 429) {
          if (!cancelled) setState({ status: 'limited' })
          return
        }
        if (!res.ok) throw new Error('interpretation unavailable')
        const data = await res.json()
        if (data.needsGeneration) {
          if (!cancelled) setState({ status: 'needsGeneration' })
          return
        }
        // Validate on this side too: a response is only as trustworthy as the
        // record behind it, and rendering a malformed one would blank the page.
        const sections = parseInterpretationSections(data.sections)
        if (cancelled) return
        setState(
          sections
            ? {
                status: 'ready',
                sections,
                remaining: typeof data.remaining === 'number' ? data.remaining : undefined,
              }
            : { status: 'failed' },
        )
      } catch {
        if (!cancelled) setState({ status: 'failed' })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [attempt, lang, wantsGeneration])

  /** Buy a reading. The only path that can, apart from saving birth data. */
  const generate = () => {
    setState({ status: 'loading' })
    setWantsGeneration(true)
    setAttempt((value) => value + 1)
  }

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  return { state, retry, generate }
}
