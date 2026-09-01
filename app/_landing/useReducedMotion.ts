'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * Whether the visitor has asked for reduced motion.
 *
 * Read through a store rather than an effect so the answer is correct on the FIRST
 * client render. An effect would paint the moving version for a frame before
 * correcting itself, which is exactly the flash the preference exists to prevent —
 * and on this page it would also mean fetching the three.js chunk before finding out
 * it was not wanted.
 *
 * The server snapshot is `false`: the preference is unknowable during SSR, and the
 * page's static fallback is what renders until hydration either way.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
