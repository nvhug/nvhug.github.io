'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'

const RING_RADIUS = 30
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

/**
 * A 0-100 score in emerald. `sm` is the inline row meter (bar plus number);
 * `lg` is the hero ring, used once for the overall score. Either size prints
 * the number itself — it is never conveyed by fill length alone.
 */
export function ScoreMeter({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const { t } = useLanguage()
  const clamped = Math.max(0, Math.min(100, Math.round(value)))

  // Starts empty and grows into place on mount instead of snapping straight to
  // its final value, so the row reads as alive rather than a static table.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(clamped))
    return () => cancelAnimationFrame(frame)
  }, [clamped])

  if (size === 'lg') {
    return (
      <span className="relative inline-flex size-20 shrink-0 items-center justify-center">
        <svg viewBox="0 0 72 72" aria-hidden="true" className="size-full -rotate-90">
          <defs>
            <linearGradient id="tuvi-score-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>
          <circle cx="36" cy="36" r={RING_RADIUS} fill="none" stroke="#d1fae5" strokeWidth="6" />
          <circle
            cx="36"
            cy="36"
            r={RING_RADIUS}
            fill="none"
            stroke="url(#tuvi-score-ring)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - shown / 100)}
            className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
          />
        </svg>
        <span className="absolute font-tuvi-sans text-xl leading-none font-semibold tabular-nums text-[#18181b]">
          {clamped}
        </span>
        <span className="sr-only">
          {clamped} {t('tuVi.scoreOutOf100')}
        </span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-[#d1fae5] sm:w-16">
        <span
          aria-hidden="true"
          className="block h-full rounded-full bg-linear-to-r from-emerald-400 to-emerald-600 transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${shown}%` }}
        />
      </span>
      <span className="font-tuvi-sans text-sm font-medium tabular-nums text-[#18181b]">
        {clamped}
        <span className="text-xs font-normal text-[#52525b]">/100</span>
      </span>
      <span className="sr-only">
        {clamped} {t('tuVi.scoreOutOf100')}
      </span>
    </span>
  )
}
