'use client'

/**
 * The ground all three games pages sit on: the cool workshop mat under warm
 * wooden objects (DESIGN § Direction). It also owns `--site-header-h`.
 *
 * The board maths needs the height of the fixed site header, and hard-coding it
 * drifts the moment the header's padding changes (plan R-3). So the shell
 * measures the rendered `.site-header` with a ResizeObserver and writes the
 * value onto its own root as a CSS variable — no state, no re-render, and the
 * `globals.css` value stays as the pre-measurement fallback.
 */

import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export function GamesShell({
  children,
  contentClassName,
}: {
  children?: React.ReactNode
  contentClassName?: string
}) {
  const rootRef = useRef<HTMLElement>(null)

  // A layout effect, and a child's: `useBoardMetrics` reads the published value
  // from a layout effect in the page that renders this shell, and a child's
  // layout effect runs before its parent's — so the value is never read stale.
  useLayoutEffect(() => {
    const root = rootRef.current
    const header = document.querySelector('.site-header')
    if (!root || !(header instanceof HTMLElement)) return

    const apply = () => root.style.setProperty('--site-header-h', `${Math.round(header.offsetHeight)}px`)
    apply()

    const observer = new ResizeObserver(apply)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return (
    <main ref={rootRef} className="games-shell min-h-svh px-4 pb-16 sm:px-6">
      <div className={cn('mx-auto w-full max-w-5xl pt-[calc(var(--site-header-h)+12px)]', contentClassName)}>
        {children}
      </div>
    </main>
  )
}
