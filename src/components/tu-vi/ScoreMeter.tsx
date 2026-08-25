'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'

/**
 * A 0-100 score in son (vermilion), as a fill bar plus the number itself — the
 * number is never conveyed by bar length alone.
 */
export function ScoreMeter({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const { t } = useLanguage()
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const isLg = size === 'lg'

  // Starts empty and grows into place on mount instead of snapping straight to
  // its final width, so the row reads as alive rather than a static table.
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(clamped))
    return () => cancelAnimationFrame(frame)
  }, [clamped])

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${isLg ? 'h-2.5 w-24' : 'h-1.5 w-14'} overflow-hidden rounded-full bg-[#e4e4e7]`}
      >
        <span
          aria-hidden="true"
          className="block h-full rounded-full bg-[#059669] transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${width}%` }}
        />
      </span>
      <span className={`font-tuvi-sans ${isLg ? 'text-base' : 'text-sm'} font-medium text-[#18181b]`}>
        {clamped}
        <span className="text-[#52525b]">/100</span>
      </span>
      <span className="sr-only">
        {clamped} {t('tuVi.scoreOutOf100')}
      </span>
    </span>
  )
}
