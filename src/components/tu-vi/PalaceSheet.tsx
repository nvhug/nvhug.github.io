'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { BRANCHES, STEMS } from '@/lib/tuvi/can-chi'
import { TRANSFORM_LABEL } from '@/lib/tuvi/scoring'
import type { Palace, Star } from '@/lib/tuvi/types'

function StarTile({ star }: { star: Star }) {
  return (
    <li className="rounded-lg border border-[#e4e4e7] bg-[#ffffff] px-2.5 py-2">
      <span className="block font-tuvi-sans text-sm leading-snug text-[#18181b]">{star.name}</span>
      {star.transform && (
        <span className="block font-tuvi-sans text-[11px] text-[#047857]">
          Hóa {TRANSFORM_LABEL[star.transform]}
        </span>
      )}
    </li>
  )
}

/**
 * Every star in one palace. This is where the chart's real content range lives:
 * a palace cell can only show three labels, this shows all of them.
 *
 * Tiles rather than one hairline-per-row list, because a palace can hold well
 * over five stars and a border under every row is the laziest layout for that
 * (taste-skill 4.9 and 9.F). Grouping also keeps chính tinh visually distinct
 * from phụ tinh, which is the distinction the reading actually turns on.
 */
export function PalaceSheet({ palace, onClose }: { palace: Palace; onClose: () => void }) {
  const { t } = useLanguage()
  const closeRef = useRef<HTMLButtonElement>(null)

  // `onClose` is a fresh inline arrow on every parent render; via a ref the
  // effect below runs once, instead of re-running and pulling focus back to the
  // close button whenever the chart behind re-renders.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    closeRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const chinh = palace.stars.filter((s) => s.kind === 'chinh')
  const phu = palace.stars.filter((s) => s.kind === 'phu')
  const voided = [palace.tuan ? 'Tuần' : '', palace.triet ? 'Triệt' : ''].filter(Boolean)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={palace.name ?? BRANCHES[palace.pillar.branch]}
      className="fixed inset-x-0 bottom-0 z-60 max-h-[70svh] overflow-y-auto rounded-t-2xl border-t border-[#e4e4e7] bg-[#f7fef9] p-4 shadow-[0_-16px_40px_-32px_rgba(24,24,27,0.5)]"
    >
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-tuvi-serif text-base text-[#18181b]">
              {palace.name ?? t('tuVi.needHour')}
            </h3>
            {/* Separate cells rather than a chain of middle dots: taste-skill 9.F
                rations the dot to one per metadata line. */}
            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-tuvi-sans text-[11px] text-[#71717a]">
              <div>
                <dt className="sr-only">Can Chi</dt>
                <dd className="font-tuvi-mono">
                  {STEMS[palace.pillar.stem]} {BRANCHES[palace.pillar.branch]}
                </dd>
              </div>
              {palace.trangSinh && (
                <div>
                  <dt className="sr-only">Tràng Sinh</dt>
                  <dd>{palace.trangSinh}</dd>
                </div>
              )}
              {voided.length > 0 && (
                <div>
                  <dt className="sr-only">Không vong</dt>
                  <dd className="text-[#dc2626]">{voided.join(', ')}</dd>
                </div>
              )}
            </dl>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('tuVi.closeChart')}
            className="rounded-lg p-1.5 text-[#71717a] transition-transform hover:bg-[#ecfdf5] focus-visible:outline-2 focus-visible:outline-[#047857] active:scale-[0.98] sm:p-1"
          >
            <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
        </div>

        {palace.stars.length === 0 ? (
          <p className="mt-4 font-tuvi-sans text-sm text-[#71717a]">{t('tuVi.noStars')}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <section>
              <h4 className="font-tuvi-serif text-xs text-[#71717a]">{t('tuVi.groupChinhTinh')}</h4>
              {chinh.length > 0 ? (
                <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {chinh.map((star) => (
                    <StarTile key={star.name} star={star} />
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 font-tuvi-sans text-sm text-[#d97706]">{t('tuVi.voChinhDieu')}</p>
              )}
            </section>

            {phu.length > 0 && (
              <section>
                <h4 className="font-tuvi-serif text-xs text-[#71717a]">{t('tuVi.groupPhuTinh')}</h4>
                <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {phu.map((star) => (
                    <StarTile key={star.name} star={star} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
