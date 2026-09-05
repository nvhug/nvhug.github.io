'use client'

/**
 * The carved level badge and the one quiet HUD strip below it (FR-021, FR-036).
 *
 * Every slot reserves its width before it has a value — the timer in `ch` on
 * tabular mono digits, the personal best and the save word behind a min-width —
 * so nothing on the page moves as they fill in (FR-047).
 */

import Link from 'next/link'
import { Map as MapIcon, RotateCcw } from 'lucide-react'
import { formatTime } from '@/lib/games/progress'
import { useLanguage } from '@/lib/i18n/language-context'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CarvedText } from '../../_components/CarvedText'
import { CONTROL_CLASS, type SaveState } from '../../_components/gameChrome'

export type { SaveState }

export function Hud({
  level,
  tierName,
  elapsedMs,
  bestMs,
  saveState,
  mapHref,
  resetRef,
  onReset,
}: {
  level: number
  tierName: string
  elapsedMs: number
  bestMs: number | null
  saveState: SaveState
  mapHref: string
  resetRef: React.Ref<HTMLButtonElement>
  onReset: () => void
}) {
  const { t } = useLanguage()

  const saveWord =
    saveState === 'saving' ? t('games.blockPuzzle.hud.saving')
    : saveState === 'saved' ? t('games.blockPuzzle.hud.saved')
    : saveState === 'unsaved' ? t('games.blockPuzzle.hud.unsaved')
    : ''

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="games-oak-grain rounded-xl px-4 py-1.5 shadow-[0_6px_14px_-8px_rgba(0,0,0,0.8)]"
        aria-label={t('games.blockPuzzle.hud.level', { level })}
      >
        <CarvedText className="text-sm sm:text-base">
          {tierName} · {String(level).padStart(2, '0')}
        </CarvedText>
      </div>

      <div className="flex w-full items-center justify-center gap-2 sm:gap-4">
        <span
          className="font-tuvi-mono w-[5ch] text-center text-lg tabular-nums text-(--games-mat-text)"
          aria-live="off"
        >
          {formatTime(elapsedMs)}
        </span>

        <span className="hidden min-w-[12ch] text-xs text-(--games-mat-muted) sm:inline">
          {bestMs === null ? '—' : `${t('games.blockPuzzle.hud.best')} ${formatTime(bestMs)}`}
        </span>

        <span
          className={cn(
            'min-w-[8ch] text-xs',
            saveState === 'unsaved' ? 'text-(--games-ember)' : 'text-(--games-mat-muted)',
          )}
        >
          {saveWord}
        </span>

        <Button
          ref={resetRef}
          type="button"
          size="icon-sm"
          variant="ghost"
          className={CONTROL_CLASS}
          aria-label={t('games.blockPuzzle.hud.reset')}
          onClick={onReset}
        >
          <RotateCcw />
        </Button>

        <Link
          href={mapHref}
          aria-label={t('games.blockPuzzle.hud.map')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), CONTROL_CLASS)}
        >
          <MapIcon className="size-4" />
        </Link>
      </div>
    </div>
  )
}
