'use client'

import { useEffect, useState } from 'react'
import { parsePalaceReadings, type PalaceReading } from '@/lib/horoscope-interpretation'

export type PalaceReadings = Record<string, PalaceReading>

export type PalaceReadingsState =
  | { status: 'loading' }
  | { status: 'ready'; palaces: PalaceReadings }
  | { status: 'needHour' }
  | { status: 'failed' }
  | { status: 'limited' }
  /** Nothing stored. Reached only when generation failed at save time; saving birth
      data again is the way back. */
  | { status: 'needsGeneration' }

/**
 * Shared per (language, attempt), for the same reason the sections hook dedupes:
 * Strict Mode mounts every effect twice, and the route behind this claims a
 * generation slot and bills a completion before it can know the caller left.
 * Entries drop as soon as they settle, so a later mount refetches rather than
 * replaying a stale result.
 */
const inFlight = new Map<string, Promise<Response>>()

function fetchPalaces(lang: string, attempt: number): Promise<Response> {
  const key = `${lang}:${attempt}`
  const existing = inFlight.get(key)
  if (existing) return existing

  const request = fetch('/api/tu-vi/palaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Always cache-only, same rule as the sections hook.
    body: JSON.stringify({ lang, cacheOnly: true }),
  }).finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}

/**
 * The per-palace readings, loaded separately from the scored sections.
 *
 * Separate on purpose: twelve palaces is a far bigger generation than the eleven
 * sections, and folding both into one response meant a slow palace block took
 * the sections down with it. Now either can fail alone.
 */
export function usePalaceReadings(lang: string) {
  const [state, setState] = useState<PalaceReadingsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // Reset during render rather than in the effect, the React-documented way to
  // react to a changed prop without a set-state-in-effect cascade.
  const [loadedLang, setLoadedLang] = useState(lang)
  if (lang !== loadedLang) {
    setLoadedLang(lang)
    setState({ status: 'loading' })
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = (await fetchPalaces(lang, attempt)).clone()
        if (res.status === 429) {
          if (!cancelled) setState({ status: 'limited' })
          return
        }
        if (!res.ok) throw new Error('palace readings unavailable')
        const data = await res.json()
        if (cancelled) return
        if (data.needHour) {
          setState({ status: 'needHour' })
          return
        }
        if (data.needsGeneration) {
          setState({ status: 'needsGeneration' })
          return
        }
        // Validated on this side too: a response is only as trustworthy as the
        // record behind it.
        setState({ status: 'ready', palaces: parsePalaceReadings({ cung: data.palaces }) })
      } catch {
        if (!cancelled) setState({ status: 'failed' })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [attempt, lang])

  /** Re-read the database. Never generates — see fetchPalaces. */
  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  return { state, retry }
}
