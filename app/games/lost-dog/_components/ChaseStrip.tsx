'use client'

/**
 * The signature element (docs/DESIGN.md § Signature element — the chase
 * strip): a health bar tracking the pursuit gap — full and `--games-mint`
 * green at gap 100 (safe), draining and shading to `--games-ember` red as
 * the cat closes in. Reading is never colour alone (§22 still holds): the
 * *fill width* is the actual reading, colour and the band label are
 * reinforcement — the exact number is now also printed next to the bar
 * (explicit user request), on top of always living in this element's
 * `aria-label` regardless of what the bar looks like.
 */

import { PawPrint, Dog as DogIcon } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { pursuitBandFor } from '@/lib/games/lost-dog/config'
import { healthBarColor } from '@/lib/games/lost-dog/hud'

export function ChaseStrip({ gap }: { gap: number }) {
  const { t } = useLanguage()
  const clamped = Math.max(0, Math.min(100, gap))
  const band = pursuitBandFor(clamped)

  const label = band === 'danger' ? t('games.lostDog.pursuit.danger') : band === 'critical' ? t('games.lostDog.pursuit.critical') : ''

  return (
    <div
      className="flex items-center gap-2"
      role="img"
      aria-label={t('games.lostDog.pursuit.ariaLabel', { gap: Math.round(clamped) })}
    >
      <PawPrint className="h-4 w-4 text-(--games-mat-muted)" aria-hidden />
      <div
        aria-hidden
        className="h-3 w-30 overflow-hidden rounded-full bg-(--games-mat-muted)/35 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
      >
        <div
          className="h-full rounded-full transition-[width,background-color] duration-250 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: healthBarColor(clamped) }}
        />
      </div>
      <span aria-hidden className="font-tuvi-mono min-w-[3ch] text-xs tabular-nums text-(--games-mat-text)">
        {Math.round(clamped)}
      </span>
      <DogIcon className="h-4 w-4 text-(--games-oak-light)" aria-hidden />
      {/* Reserved to the longest band-label string across vi/en so score never shifts when it appears. */}
      <span className="min-w-[9ch] text-xs text-(--games-oak-light)">{label}</span>
    </div>
  )
}
