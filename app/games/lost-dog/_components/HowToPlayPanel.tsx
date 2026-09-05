'use client'

/**
 * The "how to play" legend (spec 015 follow-up: players couldn't tell
 * obstacles from food by sprite alone). Same dialog shell as `PausePanel`
 * (docs/DESIGN.md § Conventions reused): focus on the heading, Escape
 * closes, focus returns to the button that opened it. Content is a static
 * list — every obstacle family and food kind, each rendered through
 * `EntityIcon` so the legend can never show something the game doesn't.
 */

import { useEffect, useRef, type RefObject } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'
import { Button } from '@/components/ui/button'
import { OBSTACLE_ACTIONS, TUNING, type FoodKind, type ObstacleFamily } from '@/lib/games/lost-dog/config'
import { CarvedText } from '../../_components/CarvedText'
import { OAK_BUTTON } from '../../_components/gameChrome'
import { useFocusTrap } from '../_hooks/useFocusTrap'
import { EntityIcon } from './EntityIcon'

const OBSTACLE_FAMILIES = Object.keys(OBSTACLE_ACTIONS) as readonly ObstacleFamily[]
const FOOD_KINDS = TUNING.food.map((f) => f.kind)
const FOOD_POINTS: Readonly<Record<FoodKind, number>> = Object.fromEntries(
  TUNING.food.map((f) => [f.kind, f.basePoints]),
) as Record<FoodKind, number>

export function HowToPlayPanel({
  onClose,
  returnFocusRef,
}: {
  onClose: () => void
  /** The "?" button — focus goes back to it when the panel closes. */
  returnFocusRef?: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useLanguage()
  const headingRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef, headingRef, returnFocusRef)

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lost-dog-howto-title"
        className="games-panel max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-(--games-mat-lift) p-6 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9)] md:rounded-2xl"
      >
        <CarvedText as="h2" className="games-oak-grain rounded-lg px-3 py-1.5 text-center text-base outline-none">
          <span id="lost-dog-howto-title" ref={headingRef} tabIndex={-1} className="outline-none">
            {t('games.lostDog.howTo.title')}
          </span>
        </CarvedText>

        <h3 className="mt-5 text-xs font-semibold tracking-wide text-(--games-mat-text) uppercase">
          {t('games.lostDog.howTo.obstaclesHeading')}
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {OBSTACLE_FAMILIES.map((family) => (
            <li key={family} className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
              <EntityIcon kind={{ type: 'obstacle', family }} />
              <div className="min-w-0 text-sm text-(--games-mat-text)">
                <p className="font-medium">{t(`games.lostDog.howTo.obstacles.${family}.name`)}</p>
                <p className="text-(--games-mat-text)/70">
                  {t(`games.lostDog.howTo.obstacles.${family}.action`)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <h3 className="mt-5 text-xs font-semibold tracking-wide text-(--games-mat-text) uppercase">
          {t('games.lostDog.howTo.foodHeading')}
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {FOOD_KINDS.map((kind) => (
            <li key={kind} className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
              <EntityIcon kind={{ type: 'food', foodKind: kind }} />
              <div className="min-w-0 text-sm text-(--games-mat-text)">
                <p className="font-medium">{t(`games.lostDog.howTo.food.${kind}.name`)}</p>
                <p className="text-(--games-mat-text)/70">
                  {t('games.lostDog.howTo.food.points', { points: FOOD_POINTS[kind] })}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <Button type="button" className={`mt-6 w-full ${OAK_BUTTON}`} onClick={onClose}>
          {t('games.lostDog.howTo.close')}
        </Button>
      </div>
    </div>
  )
}
