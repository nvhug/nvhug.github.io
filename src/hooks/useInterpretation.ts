'use client'

import { useEffect, useState } from 'react'
import { parseInterpretationSections } from '@/lib/horoscope-interpretation'

/** One scored section's AI text: a one-line "nhận xét" always shown next to
    the score, and the fuller 3-5 sentence reading shown on expand. */
export type InterpretationSection = { short: string; detail: string }
export type InterpretationSections = Record<string, InterpretationSection>

export type InterpretationState =
  | { status: 'loading' }
  | { status: 'ready'; sections: InterpretationSections }
  | { status: 'failed' }
  | { status: 'limited' }

/**
 * Loads on its own, after and independently of the computed reading, so a
 * slow or failed AI call degrades only the sections it feeds (spec FR-011).
 */
export function useInterpretation(lang: string) {
  const [state, setState] = useState<InterpretationState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
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
    const controller = new AbortController()

    async function load() {
      try {
        const res = await fetch('/api/tu-vi/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang }),
          signal: controller.signal,
        })
        if (res.status === 429) {
          if (!cancelled) setState({ status: 'limited' })
          return
        }
        if (!res.ok) throw new Error('interpretation unavailable')
        const data = await res.json()
        // Validate on this side too: a response is only as trustworthy as the
        // record behind it, and rendering a malformed one would blank the page.
        const sections = parseInterpretationSections(data.sections)
        if (cancelled) return
        setState(sections ? { status: 'ready', sections } : { status: 'failed' })
      } catch {
        if (!cancelled) setState({ status: 'failed' })
      }
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [attempt, lang])

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  return { state, retry }
}
