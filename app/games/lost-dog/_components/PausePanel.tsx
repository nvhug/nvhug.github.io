'use client'

/**
 * The pause panel — the block puzzle's `SolvedPanel` dialog shell and button
 * recipes, reused verbatim (docs/DESIGN.md § Conventions reused): focus on
 * the heading, Escape resumes, focus returns to the Pause button (the play
 * page owns that ref).
 */

import { useEffect, useRef, type RefObject } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CarvedText } from '../../_components/CarvedText'
import { OAK_BUTTON, QUIET_BUTTON } from '../../_components/gameChrome'
import { useFocusTrap } from '../_hooks/useFocusTrap'

export function PausePanel({
  onResume,
  onQuit,
  returnFocusRef,
}: {
  onResume: () => void
  onQuit: () => void
  /** The Pause button — focus goes back to it when the panel closes (FR-033). */
  returnFocusRef?: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useLanguage()
  const headingRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef, headingRef, returnFocusRef)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onResume()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onResume])

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 md:items-center md:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lost-dog-paused-title"
        className="games-panel w-full max-w-sm rounded-t-2xl border border-white/10 bg-(--games-mat-lift) p-6 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9)] md:rounded-2xl"
      >
        <CarvedText as="h2" className="games-oak-grain rounded-lg px-3 py-1.5 text-center text-base outline-none">
          <span id="lost-dog-paused-title" ref={headingRef} tabIndex={-1} className="outline-none">
            {t('games.lostDog.paused.title')}
          </span>
        </CarvedText>

        <div className="mt-6 flex flex-col gap-2">
          <Button type="button" className={OAK_BUTTON} onClick={onResume}>
            {t('games.lostDog.paused.resume')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(buttonVariants({ variant: 'ghost' }), QUIET_BUTTON)}
            onClick={onQuit}
          >
            {t('games.lostDog.paused.back')}
          </Button>
        </div>
      </div>
    </div>
  )
}
