'use client'

/**
 * Jump/duck touch controls (docs/DESIGN.md § Mobile / responsive behavior).
 *
 * Two layouts, chosen by media query rather than by measurement so the right
 * one is correct on the very first paint:
 *
 * - **Portrait / narrow**: two 72px-tall pads in a fixed-height row below the
 *   frame, so they never move when a HUD value changes (§20).
 * - **Short landscape**: two 64px-wide columns flanking the aperture — `CÚI`
 *   left, `NHẢY` right, where thumbs already are. Vertical space is the scarce
 *   axis there, so the pads must not eat any of it.
 *
 * The landscape layout also fixes a real gap the portrait-only version had: a
 * landscape phone is usually *wider* than the `sm` breakpoint, so `sm:hidden`
 * alone removed the touch controls entirely on exactly the device that needs
 * them. The two layouts therefore have independent visibility rules.
 *
 * Duck is a hold: pointer capture, released on pointercancel/blur/
 * visibility-loss/pause (§6, FR-035). Jump is a single tap.
 */

import type { PointerEvent as ReactPointerEvent } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'

/** Short landscape: a phone on its side. Tailwind has no built-in variant for it. */
const SHORT_LANDSCAPE = '[@media(orientation:landscape)and(max-height:520px)]'

const PAD_BASE =
  'games-play-area flex items-center justify-center rounded-xl border border-white/10 bg-white/5 font-tuvi-sans text-sm font-semibold tracking-[0.08em] text-(--games-mat-text) active:bg-white/15'

export function TouchPads({
  onJump,
  onDuckStart,
  onDuckEnd,
}: {
  onJump: () => void
  onDuckStart: () => void
  onDuckEnd: () => void
}) {
  const { t } = useLanguage()

  const jumpProps = {
    type: 'button' as const,
    style: { touchAction: 'none' as const },
    'aria-label': t('games.lostDog.hud.jump'),
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      onJump()
    },
  }

  const duckProps = {
    type: 'button' as const,
    style: { touchAction: 'none' as const },
    'aria-label': t('games.lostDog.hud.duck'),
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      onDuckStart()
    },
    onPointerUp: onDuckEnd,
    onPointerCancel: onDuckEnd,
    onPointerLeave: onDuckEnd,
    onBlur: onDuckEnd,
  }

  return (
    <>
      {/* Portrait / narrow: a fixed-height row under the frame. */}
      <div
        className={`flex w-full max-w-[1120px] gap-3 pb-[env(safe-area-inset-bottom)] sm:hidden ${SHORT_LANDSCAPE}:hidden`}
        style={{ height: 72 }}
      >
        <button {...jumpProps} className={`${PAD_BASE} flex-1`}>
          {t('games.lostDog.hud.jump')}
        </button>
        <button {...duckProps} className={`${PAD_BASE} flex-1`}>
          {t('games.lostDog.hud.duck')}
        </button>
      </div>

      {/* Short landscape: two columns flanking the aperture, never over it. */}
      <div
        className={`pointer-events-none fixed inset-y-0 left-0 right-0 z-40 hidden justify-between px-2 py-4 ${SHORT_LANDSCAPE}:flex`}
      >
        <button {...duckProps} className={`${PAD_BASE} pointer-events-auto h-full w-16`}>
          {t('games.lostDog.hud.duck')}
        </button>
        <button {...jumpProps} className={`${PAD_BASE} pointer-events-auto h-full w-16`}>
          {t('games.lostDog.hud.jump')}
        </button>
      </div>
    </>
  )
}
