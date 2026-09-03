'use client'

/**
 * The attempt clock. Wall-clock from `performance.now()`, ticking four times a
 * second — enough for a `mm:ss` display and cheap enough to ignore.
 *
 * One start stamp, one interval, one piece of state, and every path that
 * restarts the clock goes through `reset`: the interval is cleared and started
 * again there, so it can never keep reading a stamp the reset replaced.
 *
 * The tick only re-renders when the displayed second changes. Milliseconds are
 * still what the state holds — the solve is timed to the millisecond — but four
 * identical `mm:ss` renders a second are four re-renders of the whole play page
 * for nothing.
 *
 * It never pauses, not even while the tab is hidden: a par-based star rating
 * must not be gameable by hiding the tab, and there is no pause feature in this
 * version (spec Assumptions).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const TICK_MS = 250

export function useLevelTimer() {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef(0)
  const intervalRef = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (intervalRef.current === null) return
    window.clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  /** New stamp, new interval; whatever was running is cleared first. */
  const startTicking = useCallback(() => {
    clear()
    startRef.current = performance.now()
    intervalRef.current = window.setInterval(() => {
      const ms = performance.now() - startRef.current
      setElapsedMs((current) =>
        Math.floor(current / 1000) === Math.floor(ms / 1000) ? current : ms,
      )
    }, TICK_MS)
  }, [clear])

  /** Starts a fresh attempt: new stamp, zero on the display, new interval. */
  const reset = useCallback(() => {
    startTicking()
    setElapsedMs(0)
  }, [startTicking])

  // The display starts at 0 already, so the clock only needs starting here.
  useEffect(() => {
    startTicking()
    return clear
  }, [clear, startTicking])

  /**
   * Freezes the clock on the exact elapsed time, not on the last tick, and
   * returns it — the solve needs the value now, and a state update is too late.
   */
  const stop = useCallback((): number => {
    clear()
    const final = performance.now() - startRef.current
    setElapsedMs(final)
    return final
  }, [clear])

  return { elapsedMs, reset, stop }
}
