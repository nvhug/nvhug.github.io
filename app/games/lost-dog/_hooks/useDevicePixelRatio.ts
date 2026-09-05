'use client'

/**
 * The canvas backing-store ratio, capped at §24's maximum of 2.
 *
 * Read through a store rather than an effect for the same reason
 * `useReducedMotion` is: the answer is then correct on the first client render,
 * so the canvas is sized once instead of being allocated at 1x and immediately
 * reallocated. The server snapshot is 1, which is also the safe fallback for a
 * browser that does not report a ratio.
 */

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  // A window moved between displays reports the new ratio via a resize.
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

export function useDevicePixelRatio(max: number): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.min(max, Math.max(1, window.devicePixelRatio || 1)),
    () => 1,
  )
}
