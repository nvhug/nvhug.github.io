'use client'

/**
 * The solved moment's last step: a sheet rising from the bottom on a phone, a
 * centred card from `md:` (DESIGN § The solved moment).
 *
 * It is a real dialog — focus moves to the heading on open, Escape closes it
 * leaving the board solved, and focus returns to the reset control, which the
 * play page owns (FR-041, SC-016).
 *
 * Hand-rolled rather than the app's `Sheet`/base-ui dialog on purpose: those
 * render through a portal at the document root, outside `.games-shell`, where
 * none of the `--games-*` tokens this panel is painted in exist. Wiring the
 * panel to a portal would mean re-declaring the palette somewhere else.
 */

import Link from 'next/link'
import { Star } from 'lucide-react'
import { formatTime } from '@/lib/games/progress'
import { useLanguage } from '@/lib/i18n/language-context'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'
import { CarvedText } from '../../_components/CarvedText'

const OAK_BUTTON =
  'bg-(--games-oak) text-(--games-cavity) hover:bg-(--games-oak-light) shadow-[0_3px_0_var(--games-oak-edge)]'
const QUIET_BUTTON =
  'border border-white/15 bg-white/5 text-(--games-mat-text) hover:bg-white/10 hover:text-(--games-mat-text)'

export function SolvedPanel({
  stars,
  elapsedMs,
  bestMs,
  newRecord,
  isCampaignComplete,
  mapHref,
  onClose,
  onNext,
  onReplay,
}: {
  stars: 1 | 2 | 3
  elapsedMs: number
  bestMs: number | null
  newRecord: boolean
  isCampaignComplete: boolean
  mapHref: string
  onClose: () => void
  onNext: () => void
  onReplay: () => void
}) {
  const { t } = useLanguage()
  const headingRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="games-solved-title"
        className="games-panel w-full max-w-sm rounded-t-2xl border border-white/10 bg-(--games-mat-lift) p-6 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9)] md:rounded-2xl"
      >
        <CarvedText
          as="h2"
          className="games-oak-grain rounded-lg px-3 py-1.5 text-center text-base outline-none"
        >
          <span id="games-solved-title" ref={headingRef} tabIndex={-1} className="outline-none">
            {t('games.blockPuzzle.solved.title')}
          </span>
        </CarvedText>

        <div className="mt-5 flex items-center justify-center gap-1.5" aria-label={t('games.blockPuzzle.solved.stars', { n: stars })}>
          {[1, 2, 3].map((n) => (
            <Star
              key={n}
              aria-hidden
              className={cn(
                'h-6 w-6',
                n <= stars ? 'fill-(--games-brass) text-(--games-brass)' : 'text-(--games-oak-edge)',
              )}
            />
          ))}
        </div>

        <p className="mt-4 text-center text-xs uppercase tracking-[0.08em] text-(--games-mat-muted)">
          {t('games.blockPuzzle.solved.time')}
        </p>
        <p className="font-tuvi-mono text-center text-3xl tabular-nums text-(--games-mat-text)">
          {formatTime(elapsedMs)}
        </p>

        <p
          className={cn(
            'mt-2 text-center text-sm',
            newRecord ? 'text-(--games-brass)' : 'text-(--games-mat-muted)',
          )}
        >
          {newRecord || bestMs === null
            ? t('games.blockPuzzle.solved.newRecord')
            : t('games.blockPuzzle.solved.best', { time: formatTime(bestMs) })}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {isCampaignComplete ? (
            <p className="text-center text-sm text-(--games-brass)">
              {t('games.blockPuzzle.solved.campaignComplete')}
            </p>
          ) : (
            <Button type="button" className={OAK_BUTTON} onClick={onNext}>
              {t('games.blockPuzzle.solved.next')}
            </Button>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" className={cn('flex-1', QUIET_BUTTON)} onClick={onReplay}>
              {t('games.blockPuzzle.solved.replay')}
            </Button>
            <Link
              href={mapHref}
              className={cn(buttonVariants({ variant: 'ghost' }), 'flex-1', QUIET_BUTTON)}
            >
              {t('games.blockPuzzle.solved.map')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
