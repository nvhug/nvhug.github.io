'use client'

import { X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { BRANCHES, STEMS } from '@/lib/tuvi/can-chi'
import { TRANSFORM_LABEL } from '@/lib/tuvi/scoring'
import { matchableStarName, normalizeName, type PalaceReading } from '@/lib/horoscope-interpretation'
import type { PalaceReadingsState } from '@/hooks/usePalaceReadings'
import type { Palace, Star } from '@/lib/tuvi/types'

/** Same chip language the score breakdown uses, so a star looks like a star
    wherever it appears on this page. */
function StarChip({ star }: { star: Star }) {
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 font-tuvi-sans text-sm ${
        star.kind === 'chinh'
          ? 'bg-emerald-50 font-medium text-[#065f46]'
          : 'bg-[#f4f4f5] text-[#52525b]'
      }`}
    >
      {star.name}
      {star.transform && (
        <span className="text-[#047857]"> ({TRANSFORM_LABEL[star.transform]})</span>
      )}
    </span>
  )
}

/**
 * What the chart holds in this palace, and what the model makes of each piece
 * of it. The star list is computed and always present; the meaning beside each
 * name arrives with the interpretation and is simply absent until it does.
 */
export function PalaceDetail({
  palace,
  readings,
  onClose,
}: {
  palace: Palace
  readings: { state: PalaceReadingsState; retry: () => void }
  onClose: () => void
}) {
  const { t } = useLanguage()
  const { state, retry } = readings

  const reading: PalaceReading | undefined =
    state.status === 'ready' && palace.name
      ? state.palaces[normalizeName(palace.name)]
      : undefined

  // Model text is matched to the chart's own star list, never listed on its own:
  // a name it invented or misspelled must not appear as if it were in the chart.
  // matchableStarName, not normalizeName — the model writes "Tả Phù (hóa Khoa)"
  // and "Tràng Sinh: Mộ" where the chart holds "Tả Phù" and "Mộ".
  const noteFor = (name: string) =>
    reading?.stars.find((star) => matchableStarName(star.name) === matchableStarName(name))?.text

  // The Tràng Sinh position is not a star, but it is read like one, so the model
  // is asked to cover it and it is shown in the same list.
  const rows: Array<{ key: string; label: React.ReactNode; note?: string }> = [
    ...palace.stars.map((star) => ({
      key: star.name,
      label: <StarChip star={star} />,
      note: noteFor(star.name),
    })),
    ...(palace.trangSinh
      ? [
          {
            key: `trangSinh-${palace.trangSinh}`,
            label: (
              <span className="shrink-0 rounded-md bg-[#f4f4f5] px-1.5 py-0.5 font-tuvi-sans text-sm text-[#52525b]">
                {palace.trangSinh}
              </span>
            ),
            note: noteFor(palace.trangSinh),
          },
        ]
      : []),
    ...[palace.tuan ? 'Tuần' : '', palace.triet ? 'Triệt' : '']
      .filter(Boolean)
      .map((mark) => ({
        key: `mark-${mark}`,
        label: (
          <span className="shrink-0 rounded-md bg-red-50 px-1.5 py-0.5 font-tuvi-sans text-sm text-[#dc2626]">
            {mark}
          </span>
        ),
        note: noteFor(mark),
      })),
  ]

  return (
    <div
      aria-live="polite"
      className="animate-fade-in-up mt-3 rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_18px_36px_-30px_rgba(16,185,129,0.4)] motion-reduce:animate-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-tuvi-serif text-base text-[#18181b]">
            {palace.name ?? t('tuVi.needHour')}
          </h3>
          {/* Separate cells rather than a chain of middle dots: taste-skill 9.F
              rations the dot to one per metadata line. */}
          <p className="mt-0.5 font-tuvi-mono text-xs text-[#71717a]">
            {STEMS[palace.pillar.stem]} {BRANCHES[palace.pillar.branch]}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="-mt-1 -mr-1 shrink-0 rounded-lg p-1.5 text-[#a1a1aa] transition-colors hover:bg-emerald-50 hover:text-[#047857] focus-visible:outline-2 focus-visible:outline-[#047857] active:scale-[0.98] sm:p-1"
        >
          <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-2.5 font-tuvi-sans text-sm text-[#a1a1aa]">{t('tuVi.noStars')}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {palace.stars.every((star) => star.kind !== 'chinh') && (
            <li className="font-tuvi-sans text-sm text-[#b45309]">{t('tuVi.voChinhDieu')}</li>
          )}
          {rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {row.label}
              {row.note ? (
                <span className="min-w-0 flex-1 font-tuvi-sans text-sm leading-relaxed text-[#3f3f46]">
                  {row.note}
                </span>
              ) : (
                state.status === 'loading' && (
                  <span className="inline-block h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f4f4f5]">
                    <span className="relative block h-full w-1/3 animate-shimmer-sweep bg-white/60 motion-reduce:hidden" />
                  </span>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {reading?.summary && (
        <p className="mt-3 border-t border-emerald-100 pt-2.5 font-tuvi-sans text-sm leading-relaxed text-[#27272a]">
          <span className="font-medium text-[#047857]">{t('tuVi.sectionOverall')}: </span>
          {reading.summary}
        </p>
      )}

      {(state.status === 'failed' || (state.status === 'ready' && !reading)) && (
        <p className="mt-3 border-t border-emerald-100 pt-2.5 font-tuvi-sans text-sm text-[#52525b]">
          {t('tuVi.interpretError')}{' '}
          <button
            type="button"
            onClick={retry}
            className="font-medium text-[#047857] underline-offset-2 hover:underline active:scale-[0.98]"
          >
            {t('tuVi.interpretRetry')}
          </button>
        </p>
      )}

      {state.status === 'needHour' && (
        <p className="mt-3 border-t border-emerald-100 pt-2.5 font-tuvi-sans text-sm text-[#b45309]">
          {t('tuVi.needHourBody')}
        </p>
      )}

      {/* Its own bucket, so its own copy: the palace allowance runs out
          independently of the sections one, and borrowing that message would
          claim a limit the reader has not actually reached. */}
      {state.status === 'limited' && (
        <p className="mt-3 border-t border-emerald-100 pt-2.5 font-tuvi-sans text-sm text-[#52525b]">
          {t('tuVi.palaceLimit')}
        </p>
      )}
    </div>
  )
}
