'use client'

/**
 * The rAF-driven fixed-step loop (plan R5/R21). Reuses physics.ts's tested
 * `advanceClamped` for the clamp + bounded-step accounting so this hook adds
 * no untested arithmetic of its own — it only decides *when* to call
 * `onTick` and carries the accumulator across frames via a ref.
 *
 * Not unit-tested (hook, project convention); the pure clamp/step logic it
 * delegates to is already covered by physics.test.ts.
 */

import { useEffect, useRef } from 'react'
import { advanceClamped } from '@/lib/games/lost-dog/physics'

export function useGameLoop(onTick: () => void, isActive: boolean): void {
  const accumulatorRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)
  const onTickRef = useRef(onTick)

  useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  useEffect(() => {
    if (!isActive) {
      // Resuming later starts a fresh real-time delta rather than replaying
      // however long the game was inactive (visibility/pause handling, §25).
      // The sub-step remainder goes with it: carrying it across a pause would
      // hand the first resumed frame a fraction of a step it never earned,
      // which is time SC-010 says must be exactly zero.
      lastTimeRef.current = null
      accumulatorRef.current = 0
      return
    }

    let rafId: number

    function frame(time: number) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time
      } else {
        const realDeltaMs = time - (lastTimeRef.current ?? time)
        lastTimeRef.current = time
        const result = advanceClamped(0, realDeltaMs, () => {
          onTickRef.current()
          return 0
        }, accumulatorRef.current)
        accumulatorRef.current = result.accumulator
      }
      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [isActive])
}
