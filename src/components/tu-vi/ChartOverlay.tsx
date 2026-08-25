'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { pillarName } from '@/lib/tuvi/can-chi'
import { LaSoFull } from './LaSoGrid'
import { PalaceSheet } from './PalaceSheet'
import type { Palace, Reading } from '@/lib/tuvi/types'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Full-screen lá số. Traps focus, closes on Escape, and returns focus to
 * whatever opened it.
 */
export function ChartOverlay({ reading, onClose }: { reading: Reading; onClose: () => void }) {
  const { t } = useLanguage()
  const panelRef = useRef<HTMLDivElement>(null)
  // Captured while the click is still being handled — once React commits `inert`
  // onto the cell's subtree the browser has already blurred it, so the sheet
  // itself can no longer see which cell opened it.
  const cellRef = useRef<HTMLElement | null>(null)
  const [selected, setSelected] = useState<Palace | null>(null)

  // `onClose` arrives as a fresh inline arrow on every parent render; holding it
  // in a ref keeps the trap effect from tearing down and re-capturing the opener
  // (and yanking focus out of the dialog) on unrelated re-renders.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      // Descendants of an inert subtree cannot take focus, so they must not act
      // as the wrap-around targets either — focus would fall through to <body>
      // and the next Tab would leave the dialog entirely.
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => !element.closest('[inert]'))
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      // On open, focus sits on the panel itself, which is tabIndex={-1} and so
      // not in this list. Without this branch the first Shift+Tab would leave the
      // dialog for the page behind it.
      if (!active || !focusable.includes(active)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
        return
      }
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus()
    }
  }, [])

  // Runs after the commit that removes `inert`, so the cell can actually take
  // focus again — calling focus() straight from the close handler would land on
  // a still-inert element and drop focus to <body>.
  useEffect(() => {
    if (selected) return
    const cell = cellRef.current
    cellRef.current = null
    cell?.focus()
  }, [selected])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tuVi.openChart')}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#f7fef9]"
    >
      <div ref={panelRef} tabIndex={-1} className="mx-auto w-full max-w-2xl px-3 py-4 outline-none">
        {/* While a palace sheet is open the chart behind it leaves the tab order
            entirely, so focus cannot fall through to it. */}
        <div inert={selected ? true : undefined}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-tuvi-serif text-base text-[#18181b]">{t('tuVi.openChart')}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('tuVi.closeChart')}
              className="rounded-lg p-1.5 text-[#71717a] transition-transform hover:bg-[#ecfdf5] focus-visible:outline-2 focus-visible:outline-[#047857] active:scale-[0.98] sm:p-1"
            >
              <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </button>
          </div>

          {!reading.chart.hourKnown && (
            <p className="mb-3 rounded-lg border border-dashed border-[#e4e4e7] bg-[#ffffff] p-2.5 text-xs text-[#dc2626]">
              {t('tuVi.chartPartial')}
            </p>
          )}

          <LaSoFull
            chart={reading.chart}
            onSelectPalace={(palace) => {
              cellRef.current = document.activeElement as HTMLElement | null
              setSelected(palace)
            }}
            identity={
              <>
                <span className="font-tuvi-serif text-sm text-[#18181b]">{reading.yearName}</span>
                <span className="font-tuvi-sans text-[10px] text-[#71717a]">
                  {reading.napAm.name}
                </span>
                {/* The thiên bàn traditionally carries the day and hour pillars.
                    One per line rather than dot-joined: the middle dot is
                    rationed to one per metadata line (taste-skill 9.F). */}
                <span className="font-tuvi-sans text-[10px] text-[#71717a]">
                  {pillarName(reading.pillars.day)}
                </span>
                {reading.pillars.hour && (
                  <span className="font-tuvi-sans text-[10px] text-[#71717a]">
                    {pillarName(reading.pillars.hour)}
                  </span>
                )}
                {reading.chart.cuc && (
                  <span className="font-tuvi-sans text-[10px] text-[#047857]">
                    {reading.chart.cuc.name}
                  </span>
                )}
              </>
            }
          />
        </div>

        {selected && <PalaceSheet palace={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}
