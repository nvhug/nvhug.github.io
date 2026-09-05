'use client'

/**
 * The result panel (docs/DESIGN.md § Result panel), in §20's content order:
 * score, best-score status, run breakdown, save status, controls. No confetti,
 * no count-up — the puzzle's restraint, kept; the only celebration is the
 * brass record line.
 *
 * Focus enters on the heading and stays inside the panel: there is nothing
 * behind it to return to, and `Escape` is deliberately inert here (DESIGN §
 * States).
 */

import { useRef } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/games/progress'
import { CarvedText } from '../../_components/CarvedText'
import { OAK_BUTTON, QUIET_BUTTON, type SaveState } from '../../_components/gameChrome'
import { useFocusTrap } from '../_hooks/useFocusTrap'

export function ResultPanel({
  score,
  distance,
  elapsedMs,
  foodCollected,
  bestCombo,
  hitsTaken,
  bestScoreBefore,
  saveState,
  onReplay,
  onBack,
  onRetrySave,
}: {
  score: number
  distance: number
  elapsedMs: number
  foodCollected: number
  bestCombo: 1 | 2 | 3 | 4 | 5
  hitsTaken: number
  /** The account's best as it stood before this run; null while unknown or failed (FR-004). */
  bestScoreBefore: number | null
  saveState: SaveState
  onReplay: () => void
  onBack: () => void
  onRetrySave: () => void
}) {
  const { t } = useLanguage()
  const headingRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // No return-focus target: there is nothing behind the result panel to go back
  // to, so focus simply stays inside it (DESIGN § States).
  useFocusTrap(panelRef, headingRef)

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 md:items-center md:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lost-dog-result-title"
        className="games-panel w-full max-w-sm rounded-t-2xl border border-white/10 bg-(--games-mat-lift) p-6 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9)] md:rounded-2xl"
      >
        <CarvedText as="h2" className="games-oak-grain rounded-lg px-3 py-1.5 text-center text-base outline-none">
          <span id="lost-dog-result-title" ref={headingRef} tabIndex={-1} className="outline-none">
            {t('games.lostDog.ready.title')}
          </span>
        </CarvedText>

        <p className="font-tuvi-mono mt-4 text-center text-4xl tabular-nums text-(--games-mat-text)">{score}</p>

        {/* Best-score status: the brass record line, or the standing best — never both
            (DESIGN § Result panel), and nothing at all while the best is unknown. */}
        {bestScoreBefore !== null && (
          <p
            className={cn(
              'font-tuvi-sans mt-2 text-center text-sm',
              score > bestScoreBefore ? 'text-(--games-brass)' : 'text-(--games-mat-muted)',
            )}
          >
            {score > bestScoreBefore
              ? t('games.lostDog.result.newRecord')
              : t('games.lostDog.result.best', { score: bestScoreBefore })}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-1 text-center text-xs text-(--games-mat-muted)">
          <p className="font-tuvi-mono tabular-nums">{t('games.lostDog.result.distance', { distance: Math.floor(distance) })}</p>
          <p className="font-tuvi-mono tabular-nums">{t('games.lostDog.result.time', { time: formatTime(elapsedMs) })}</p>
          <p className="font-tuvi-mono tabular-nums">{t('games.lostDog.result.food', { count: foodCollected })}</p>
          <p className="font-tuvi-mono tabular-nums">{t('games.lostDog.result.combo', { combo: bestCombo })}</p>
          <p className="font-tuvi-mono tabular-nums">{t('games.lostDog.result.hits', { hits: hitsTaken })}</p>
        </div>

        {/* Save status — one line, and only when there is something to say. */}
        {saveState !== 'idle' && (
          <p
            className={cn(
              'font-tuvi-sans mt-3 text-center text-xs',
              saveState === 'unsaved' ? 'text-(--games-ember)' : 'text-(--games-mat-muted)',
            )}
          >
            {saveState === 'saving'
              ? t('games.lostDog.hud.saving')
              : saveState === 'saved'
                ? t('games.lostDog.hud.saved')
                : t('games.lostDog.hud.unsaved')}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Button type="button" className={OAK_BUTTON} onClick={onReplay}>
            {t('games.lostDog.result.replay')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(buttonVariants({ variant: 'ghost' }), QUIET_BUTTON)}
            onClick={onBack}
          >
            {t('games.lostDog.result.back')}
          </Button>
          {/* A third, quiet control that exists only when the save actually failed. */}
          {saveState === 'unsaved' && (
            <Button
              type="button"
              variant="ghost"
              className={cn(buttonVariants({ variant: 'ghost' }), QUIET_BUTTON)}
              onClick={onRetrySave}
            >
              {t('games.lostDog.result.retrySave')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
