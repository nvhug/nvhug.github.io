'use client'

/**
 * The campaign in one view: five carved tier plaques, twenty tiles each
 * (FR-029..FR-031).
 *
 * A locked tile is a hole where a block will go — the game's own metaphor — and
 * it is a button with a spoken reason, not just a dimmed number
 * (DESIGN § Accessibility). It is `aria-disabled`, not `disabled`: `?focus=<n>`
 * arrives here precisely because level n was locked, and a truly disabled
 * button cannot be focused, so the tile the redirect is about could not be
 * shown. It stays unclickable either way. While progress is unknown the tiles
 * render blank at their final size, so nothing moves when the answer arrives
 * (FR-028, FR-047).
 */

import Link from 'next/link'
import { Star } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { CAMPAIGN_LEVELS, TIERS } from '@/lib/games/block-puzzle/tiers'
import { formatTime, type CampaignSummary } from '@/lib/games/progress'
import { BLOCK_PUZZLE_PATH } from '@/lib/games/registry'
import { useLanguage } from '@/lib/i18n/language-context'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'
import { CarvedText } from '../../_components/CarvedText'

const STARS_PER_LEVEL = 3
const TILE_CLASS =
  'relative flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg text-center'

export function LevelMap({
  summary,
  loading,
  focusLevel,
}: {
  summary: CampaignSummary
  loading: boolean
  focusLevel: number | null
}) {
  const { t } = useLanguage()
  const reduceMotion = useReducedMotion()
  const focusRef = useRef<HTMLElement>(null)

  // The tile is somewhere down a hundred-tile map, so focusing it is only half
  // the job: it has to be brought into view as well.
  useEffect(() => {
    if (loading) return
    const tile = focusRef.current
    if (!tile) return
    tile.focus()
    tile.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [loading, reduceMotion])

  return (
    <div>
      <p className="font-tuvi-mono text-center text-sm tabular-nums text-(--games-brass)">
        {loading
          ? '—'
          : t('games.blockPuzzle.map.total', {
              completed: summary.completed,
              total: CAMPAIGN_LEVELS,
              stars: summary.stars,
              starsTotal: CAMPAIGN_LEVELS * STARS_PER_LEVEL,
            })}
      </p>

      <div className="mt-6 flex flex-col gap-7">
        {TIERS.map((tier) => (
          <section key={tier.index}>
            <div className="games-oak-grain mx-auto w-fit rounded-lg px-3 py-1 shadow-[0_6px_14px_-9px_rgba(0,0,0,0.8)]">
              <CarvedText as="h2" className="text-xs sm:text-sm">
                {t(tier.i18nKey)}
              </CarvedText>
            </div>

            <div className="mt-3 grid grid-cols-5 gap-2 md:grid-cols-10">
              {Array.from({ length: tier.levels[1] - tier.levels[0] + 1 }, (_, i) => tier.levels[0] + i).map(
                (level) => (
                  <Tile
                    key={level}
                    level={level}
                    summary={summary}
                    loading={loading}
                    elementRef={level === focusLevel ? focusRef : undefined}
                  />
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function Tile({
  level,
  summary,
  loading,
  elementRef,
}: {
  level: number
  summary: CampaignSummary
  loading: boolean
  elementRef?: React.Ref<HTMLElement>
}) {
  const { t } = useLanguage()

  if (loading) {
    return (
      <div
        aria-hidden
        className={cn(TILE_CLASS, 'bg-(--games-oak-fixed)/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]')}
      />
    )
  }

  const done = summary.byLevel.get(level)
  const isCurrent = !done && level === summary.nextLevel

  if (!done && !isCurrent) {
    return (
      <button
        ref={elementRef as React.Ref<HTMLButtonElement>}
        type="button"
        aria-disabled="true"
        aria-label={t('games.blockPuzzle.map.locked', { level })}
        onClick={(event) => event.preventDefault()}
        className={cn(
          TILE_CLASS,
          'cursor-not-allowed bg-(--games-cavity) text-(--games-mat-muted) shadow-[inset_0_4px_10px_rgba(0,0,0,0.55)]',
        )}
      >
        <span className="font-tuvi-sans text-sm font-semibold tabular-nums">{level}</span>
      </button>
    )
  }

  return (
    <Link
      ref={elementRef as React.Ref<HTMLAnchorElement>}
      href={`${BLOCK_PUZZLE_PATH}/${level}`}
      aria-label={
        done
          ? `${t('games.blockPuzzle.map.done', { level })} · ${t('games.blockPuzzle.solved.stars', { n: done.stars })}`
          : t('games.blockPuzzle.map.current', { level })
      }
      className={cn(
        TILE_CLASS,
        'games-oak-grain shadow-[0_3px_0_var(--games-oak-edge),0_6px_12px_-6px_rgba(0,0,0,0.7)]',
        isCurrent && 'ring-2 ring-(--games-mint)',
      )}
    >
      <span className="games-carved font-tuvi-sans text-sm font-semibold tabular-nums">{level}</span>
      {done && (
        <>
          <span className="flex items-center gap-px" aria-hidden>
            {[1, 2, 3].map((n) => (
              <Star
                key={n}
                className={cn(
                  'h-2.5 w-2.5',
                  n <= done.stars ? 'fill-(--games-brass) text-(--games-brass)' : 'text-(--games-oak-edge)',
                )}
              />
            ))}
          </span>
          <span className="font-tuvi-mono text-[10px] tabular-nums text-(--games-cavity)/80" aria-hidden>
            {formatTime(done.bestMs)}
          </span>
        </>
      )}
    </Link>
  )
}
