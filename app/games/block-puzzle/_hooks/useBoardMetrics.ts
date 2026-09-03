'use client'

/**
 * Turns the viewport into the one cell size the whole play page is built from
 * (plan R6). The arithmetic and its rules live in
 * `src/lib/games/block-puzzle/metrics.ts`; this hook only supplies the measured
 * inputs and re-supplies them when the viewport, the orientation or the site
 * header changes.
 *
 * Measuring happens in a layout effect, never in the initial state: reading the
 * real window during the hydration render would disagree with the prerendered
 * HTML, and React keeps the server's attributes — a desktop load would paint a
 * phone-sized board while the drag engine computed with desktop cells. A layout
 * effect runs before paint instead, so the correction is invisible (FR-047).
 *
 * The header height is not measured here. `GamesShell` measures `.site-header`
 * and publishes it as `--site-header-h` on the shell root; this hook reads that
 * variable, so the height has exactly one owner.
 */

import { useLayoutEffect, useMemo, useState } from 'react'
import { computeBoardMetrics, type BoardMetrics } from '@/lib/games/block-puzzle/metrics'

/**
 * The pre-measurement viewport, identical on the server and on the hydration
 * render. `headerPx` is only reached if `--site-header-h` cannot be read at
 * all; globals.css owns the real fallbacks (69px, 65px from `sm`).
 */
const FALLBACK_HEADER_PX = 69
const FALLBACK: Viewport = { viewportWidth: 390, viewportHeight: 844, headerPx: FALLBACK_HEADER_PX }

interface Viewport {
  viewportWidth: number
  viewportHeight: number
  headerPx: number
}

function readViewport(): Viewport {
  const shell = document.querySelector('.games-shell')
  const published = shell
    ? Number.parseFloat(getComputedStyle(shell).getPropertyValue('--site-header-h'))
    : Number.NaN
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    headerPx: Number.isFinite(published) ? published : FALLBACK_HEADER_PX,
  }
}

export interface BoardMetricsSpec {
  grid: number
  looseCount: number
  slotCells: { w: number; h: number }
  /** Badge plus HUD strip reserved above the board. */
  chromePx: number
}

export function useBoardMetrics(spec: BoardMetricsSpec): BoardMetrics {
  const [viewport, setViewport] = useState<Viewport>(FALLBACK)

  useLayoutEffect(() => {
    const update = () => {
      const next = readViewport()
      setViewport((current) =>
        current.viewportWidth === next.viewportWidth &&
        current.viewportHeight === next.viewportHeight &&
        current.headerPx === next.headerPx
          ? current
          : next,
      )
    }

    update()

    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)

    // The header's own height is GamesShell's to measure; this only asks to be
    // told when it changed, so the published variable can be read again.
    const header = document.querySelector('.site-header')
    const observer = header instanceof HTMLElement ? new ResizeObserver(update) : null
    if (header instanceof HTMLElement) observer?.observe(header)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      observer?.disconnect()
    }
  }, [])

  const { grid, looseCount, chromePx } = spec
  const slotW = spec.slotCells.w
  const slotH = spec.slotCells.h

  return useMemo(
    () =>
      computeBoardMetrics({
        ...viewport,
        grid,
        looseCount,
        chromePx,
        slotCells: { w: slotW, h: slotH },
      }),
    [viewport, grid, looseCount, chromePx, slotW, slotH],
  )
}
