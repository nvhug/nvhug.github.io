'use client'

/**
 * The signature element (docs/DESIGN.md § Signature element — the chase
 * strip): a ten-pawprint track with a cat mark walking toward a dog mark.
 * Reading is position + count, never colour alone (§22) — colour and the
 * band label are reinforcement only.
 */

import { PawPrint, Dog as DogIcon } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils'
import { pursuitBandFor } from '@/lib/games/lost-dog/config'

const PRINT_COUNT = 10

export function ChaseStrip({ gap }: { gap: number }) {
  const { t } = useLanguage()
  const clamped = Math.max(0, Math.min(100, gap))
  const litPrints = Math.round((clamped / 100) * PRINT_COUNT)
  const band = pursuitBandFor(clamped)
  const alarmed = band === 'danger' || band === 'critical'

  const label = band === 'danger' ? t('games.lostDog.pursuit.danger') : band === 'critical' ? t('games.lostDog.pursuit.critical') : ''

  return (
    <div
      className="flex items-center gap-2"
      role="img"
      aria-label={t('games.lostDog.pursuit.ariaLabel', { gap: Math.round(clamped) })}
    >
      <PawPrint className="h-4 w-4 text-(--games-mat-muted)" aria-hidden />
      <div className="flex items-center gap-1" style={{ transition: 'color 250ms' }}>
        {Array.from({ length: PRINT_COUNT }, (_, i) => {
          const lit = i < litPrints
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                'h-3 w-3 rounded-full transition-colors duration-250',
                lit && alarmed && 'bg-(--games-ember)',
                lit && !alarmed && 'bg-(--games-oak-light)',
                !lit && 'bg-(--games-mat-muted)/35',
              )}
            />
          )
        })}
      </div>
      <DogIcon className="h-4 w-4 text-(--games-oak-light)" aria-hidden />
      {/* Reserved to the longest band-label string across vi/en so score never shifts when it appears. */}
      <span className="min-w-[9ch] text-xs text-(--games-oak-light)">{label}</span>
    </div>
  )
}
