'use client'

/**
 * The aperture's scale factor (docs/DESIGN.md § The aperture / Mobile —
 * svh, not vh, with the block puzzle's prerender-fallback technique so the
 * first paint is already correct). Fixed 16:9, uniform scale, never
 * cropped — layout only picks a scale, world units never change (§12).
 */

import { useLayoutEffect, useState } from 'react'
import { APERTURE_HEIGHT, APERTURE_WIDTH } from '../_render/drawFrame'

const MAX_APERTURE_WIDTH_PX = 1120
const FRAME_PX = 20
/** Same 390x844/69px prerender fallback the block puzzle's useBoardMetrics uses. */
const FALLBACK_VIEWPORT = { width: 390, height: 844 }
const FALLBACK_HEADER_PX = 69
const CHROME_PX = 160

function computeScale(viewportWidth: number, viewportHeight: number, headerPx: number): number {
  const availableWidth = viewportWidth - FRAME_PX * 2
  const availableHeight = viewportHeight - headerPx - CHROME_PX
  const scale = Math.min(availableWidth / APERTURE_WIDTH, availableHeight / APERTURE_HEIGHT)
  const cappedScale = Math.min(scale, MAX_APERTURE_WIDTH_PX / APERTURE_WIDTH)
  return Math.max(0.2, cappedScale)
}

/**
 * The measured header height, falling back to the prerender value before it
 * is set. `GamesShell` publishes `--site-header-h` on its own root element
 * (`.games-shell`), not on `<html>` — a custom property never propagates
 * upward to an ancestor, so reading `document.documentElement` here would
 * only ever see globals.css's static fallback, never the live-measured
 * value `GamesShell` corrects it to (the same reason block-puzzle's
 * `useBoardMetrics.readViewport` reads `.games-shell` directly).
 */
function headerPx(): number {
  const shell = document.querySelector('.games-shell')
  const raw = shell ? getComputedStyle(shell).getPropertyValue('--site-header-h') : ''
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_HEADER_PX
}

/**
 * Resize and orientation change re-derive **only** this number. World units,
 * entity positions, the RNG streams and the run's own state are untouched —
 * which is the whole reason the aperture is a fixed aspect ratio, and what
 * makes §12's rule against spawning into the dog's range after a resize hold
 * without any special case: a resize is not an event the simulation can see.
 */
export function useAperture(): number {
  const [scale, setScale] = useState(() =>
    computeScale(FALLBACK_VIEWPORT.width, FALLBACK_VIEWPORT.height, FALLBACK_HEADER_PX),
  )

  useLayoutEffect(() => {
    function recompute() {
      setScale(computeScale(window.innerWidth, window.innerHeight, headerPx()))
    }
    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('orientationchange', recompute)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('orientationchange', recompute)
    }
  }, [])

  return scale
}
