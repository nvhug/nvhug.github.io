'use client'

/**
 * The HUD row (docs/DESIGN.md § HUD row): chase strip, score, combo chip,
 * pause and mute — all on the mat, outside the aperture frame, so nothing
 * here ever needs to avoid covering the playfield (structural by layout).
 */

import type { RefObject } from 'react'
import { Pause, Volume2, VolumeX } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CONTROL_CLASS } from '../../_components/gameChrome'
import { ChaseStrip } from './ChaseStrip'

export function Hud({
  pursuitGap,
  score,
  comboMultiplier,
  muted,
  pauseRef,
  onPause,
  onToggleMute,
}: {
  pursuitGap: number
  score: number
  comboMultiplier: 1 | 2 | 3 | 4 | 5
  muted: boolean
  /** The pause panel returns focus here when it closes (FR-033). */
  pauseRef?: RefObject<HTMLButtonElement | null>
  onPause: () => void
  onToggleMute: () => void
}) {
  const { t } = useLanguage()

  // `flex-wrap` is the 200%-text-scale rule from DESIGN § Accessibility: the row
  // wraps to two lines rather than overflowing, and every slot keeps its `ch`
  // reservation, so nothing ever reaches over the frame below it.
  return (
    <div className="flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <ChaseStrip gap={pursuitGap} />

      <div className="flex items-center gap-3">
        <span className="font-tuvi-mono min-w-[6ch] text-right text-lg tabular-nums text-(--games-mat-text)">
          {score}
        </span>
        <span
          className={cn(
            'font-tuvi-sans min-w-[3ch] text-center text-sm font-semibold',
            comboMultiplier >= 2 ? 'text-(--games-brass)' : 'text-(--games-mat-muted)',
          )}
        >
          ×{comboMultiplier}
        </span>

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className={CONTROL_CLASS}
          ref={pauseRef}
          aria-label={t('games.lostDog.hud.pause')}
          onClick={onPause}
        >
          <Pause className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </Button>

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className={CONTROL_CLASS}
          aria-label={muted ? t('games.lostDog.hud.unmute') : t('games.lostDog.hud.mute')}
          onClick={onToggleMute}
        >
          {muted ? <VolumeX className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <Volume2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
        </Button>
      </div>
    </div>
  )
}
