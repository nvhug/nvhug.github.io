'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/**
 * The gate in front of the hero's 3D field.
 *
 * Everything FR-024 demands is enforced here rather than inside the scene, so the
 * three.js chunk is not merely idle when it is unwanted — it is never fetched:
 *
 * - `next/dynamic({ ssr: false })` keeps it out of the server render and out of the
 *   first-paint bundle. The headline, price line and sign-in buttons are usable before
 *   this component decides anything.
 * - Mounting waits for a frame after hydration, so the decision costs nothing at paint.
 * - Reduced motion means the scene never mounts at all, and unmounts if the preference
 *   changes while the page is open.
 * - No WebGL means the same. Checked by probing a throwaway context rather than by
 *   catching a render error, because a thrown error inside `<Canvas>` would take the
 *   hero down with it.
 * - Off-screen or a hidden tab parks the frame loop (`active`), keeping the built scene
 *   so scrolling back is instant.
 *
 * The static glow underneath is rendered unconditionally, which makes it the single
 * fallback for all four of those cases plus the pre-mount frame.
 */

const RecordField = dynamic(() => import('./RecordField'), { ssr: false })

function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas')
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl')
    if (!context) return false
    // Browsers cap live WebGL contexts and drop the oldest when the cap is hit. This
    // probe runs again whenever the motion preference changes, so a context left behind
    // each time could evict the hero's real one. Hand it back immediately.
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

export function HeroField() {
  const reduceMotion = useReducedMotion()
  const [webgl, setWebgl] = useState(false)
  const [active, setActive] = useState(true)
  const band = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduceMotion) return
    const frame = requestAnimationFrame(() => setWebgl(hasWebGL()))
    return () => cancelAnimationFrame(frame)
  }, [reduceMotion])

  // Derived at render rather than stored, so turning reduced motion ON while the page
  // is open unmounts the scene on the next render instead of after an extra effect pass.
  const mounted = webgl && !reduceMotion

  useEffect(() => {
    const element = band.current
    if (!mounted || !element) return

    let onScreen = true
    const sync = () => setActive(onScreen && !document.hidden)
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting
        sync()
      },
      // A little margin so the loop is already running by the time the field is read.
      { rootMargin: '96px' },
    )
    observer.observe(element)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [mounted])

  return (
    <div ref={band} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-[130%] w-[150%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.18),rgba(8,13,10,0)_62%)]" />
      {mounted && <RecordField active={active} />}
      {/* Scrim. Additive points are bright, and the hero's body and price lines were
          landing on the densest part of the field — DESIGN.md's own rule is that the
          field never competes with text for contrast, and unscrimmed it did. Weighted
          to the left, where the text column is, so the field still reads on the right. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(8,13,10,0.94)_0%,rgba(8,13,10,0.82)_38%,rgba(8,13,10,0.35)_62%,rgba(8,13,10,0)_84%)]" />
      {/* And it dissolves into the ground before the copy below it. */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[#080D0A]" />
    </div>
  )
}
