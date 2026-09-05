'use client'

/**
 * Whether the visitor's primary pointer is touch (a coarse pointer), so the
 * READY prompt can show "Chạm để nhảy" instead of keyboard instructions to
 * someone who has no keyboard (§6, §20 — the ready prompt is per-input-method).
 * Same `useSyncExternalStore` shape as `useReducedMotion`, for the same
 * reason: correct on the first client render, no effect-driven flash.
 */

import { useSyncExternalStore } from 'react'

const QUERY = '(pointer: coarse)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
