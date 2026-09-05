'use client'

/**
 * aria-live mirror for discrete state changes (docs/DESIGN.md §
 * Accessibility): run started, pause/resume, pursuit band change, game over
 * + final score. Per-frame score/distance are never announced here.
 */

export function LiveRegion({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  )
}
