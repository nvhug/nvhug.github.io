'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'
import { BRANCHES, STEMS } from '@/lib/tuvi/can-chi'
import type { Chart, Palace } from '@/lib/tuvi/types'

// The traditional lá số places the twelve branches around a 4x4 frame, with
// the thiên bàn filling the middle. Row/column of each branch index:
const CELL_POSITION: Record<number, string> = {
  5: 'col-start-1 row-start-1',
  6: 'col-start-2 row-start-1',
  7: 'col-start-3 row-start-1',
  8: 'col-start-4 row-start-1',
  4: 'col-start-1 row-start-2',
  9: 'col-start-4 row-start-2',
  3: 'col-start-1 row-start-3',
  10: 'col-start-4 row-start-3',
  2: 'col-start-1 row-start-4',
  1: 'col-start-2 row-start-4',
  0: 'col-start-3 row-start-4',
  11: 'col-start-4 row-start-4',
}

// Two rows fit from ~6.5rem of cell width, a third from 8.5rem, a fourth from
// 9.5rem. Measured against the cell's own fixed overhead: the palace name, the
// Can Chi line and the star-count row.
const ROW_AT_WIDTH = ['', '', 'hidden @min-[8.5rem]:block', 'hidden @min-[9.5rem]:block']

function StarNames({ stars, gated }: { stars: Palace['stars']; gated?: boolean }) {
  return stars.map((star, index) => (
    <span
      key={star.name}
      className={`max-w-full truncate font-tuvi-sans text-[11px] leading-snug xl:text-xs ${
        star.kind === 'chinh' ? 'font-medium text-[#18181b]' : 'text-[#71717a]'
      } ${gated ? ROW_AT_WIDTH[index] ?? '' : ''}`}
    >
      {star.name}
    </span>
  ))
}

/**
 * One palace in the square frame.
 *
 * The height is fixed by the frame, so something has to give when a palace
 * carries more than fits. The order is deliberate: the palace name, its Can Chi
 * and its Tuần/Triệt marks never shrink, and the star list is the only part
 * allowed to clip — with `+n` reporting what went unshown. Letting the flex box
 * choose instead is what compressed the palace name itself out of the cell.
 */
function FullCell({
  palace,
  inked,
  selected,
  onSelect,
}: {
  palace: Palace
  inked: boolean
  selected: boolean
  onSelect: (palace: Palace) => void
}) {
  const { t } = useLanguage()
  const marks = [palace.tuan ? 'Tuần' : '', palace.triet ? 'Triệt' : ''].filter(Boolean).join(', ')
  const badge = palace.isMenh ? t('tuVi.sectionMenh') : palace.isThan ? t('tuVi.sectionThan') : null

  return (
    <button
      type="button"
      onClick={() => onSelect(palace)}
      aria-pressed={selected}
      className={`@container relative flex flex-col items-stretch overflow-hidden p-2 text-left transition-colors duration-500 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#047857] active:bg-emerald-100 motion-reduce:transition-none ${
        inked ? 'bg-emerald-50' : 'bg-white'
      } ${selected ? 'z-10 ring-2 ring-emerald-500 ring-inset' : ''} ${CELL_POSITION[palace.index]}`}
    >
      {/* Mệnh and Thân are the two palaces a reader looks for first, and the
          chart marked neither before. Out of the text flow entirely, so it can
          squeeze neither the palace name nor the Can Chi under it. */}
      {badge && (
        <span className="absolute top-1.5 right-1.5 rounded bg-emerald-600 px-1.5 font-tuvi-sans text-[10px] leading-[1.6] font-medium text-white">
          {badge}
        </span>
      )}

      <span
        className={`shrink-0 truncate font-tuvi-serif text-sm leading-tight text-[#18181b] xl:text-base ${
          badge ? 'pr-11' : ''
        }`}
      >
        {palace.name}
      </span>
      <span className="shrink-0 truncate font-tuvi-mono text-[10px] tracking-wide text-[#a1a1aa] xl:text-[11px]">
        {STEMS[palace.pillar.stem]} {BRANCHES[palace.pillar.branch]}
      </span>

      {/* Hidden outright in a cell too small for even one legible row — the name,
          the Can Chi and the star count still say what is in the palace. Rows
          then appear one at a time as the cell widens, and a second column joins
          once two star names genuinely fit side by side. */}
      <span className="mt-1.5 hidden min-h-0 grid-cols-1 gap-x-2 overflow-hidden @min-[6.5rem]:grid @min-[10.5rem]:grid-cols-2">
        <span className="flex min-w-0 flex-col gap-y-0.5">
          <StarNames stars={palace.stars.slice(0, 4)} gated />
        </span>
        <span className="hidden min-w-0 flex-col gap-y-0.5 @min-[10.5rem]:flex">
          <StarNames stars={palace.stars.slice(4, 8)} />
        </span>
      </span>

      <span className="mt-auto flex shrink-0 items-center gap-1.5 pt-1">
        {palace.stars.length > 0 ? (
          <span className="rounded bg-emerald-50 px-1.5 font-tuvi-sans text-[10px] leading-[1.6] text-[#047857]">
            {t('tuVi.starCount', { count: palace.stars.length })}
          </span>
        ) : (
          <span className="font-tuvi-sans text-[10px] text-[#a1a1aa]">{t('tuVi.noStars')}</span>
        )}
        {marks && (
          <span className="rounded bg-red-50 px-1.5 font-tuvi-mono text-[10px] leading-[1.6] tracking-wider text-[#dc2626]">
            {marks}
          </span>
        )}
      </span>
    </button>
  )
}

export function LaSoFull({
  chart,
  identity,
  onSelectPalace,
  selectedIndex = null,
}: {
  chart: Chart
  identity: React.ReactNode
  onSelectPalace: (palace: Palace) => void
  /** Branch index of the palace whose detail is open below the chart. */
  selectedIndex?: number | null
}) {
  // Inks the current Đại vận palace once the grid itself has drawn.
  const [inked, setInked] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setInked(true), 120)
    return () => window.clearTimeout(id)
  }, [])

  return (
    // A square frame, as a lá số is drawn. A square cell holds less than a busy
    // palace can carry, so how much shows is decided by container queries on the
    // cell itself, and the star-count chip reports the rest at every width.
    <div className="grid aspect-square w-full grid-cols-4 grid-rows-4 gap-px overflow-hidden rounded-xl bg-emerald-100">
      {chart.palaces.map((palace) => (
        <FullCell
          key={palace.index}
          palace={palace}
          inked={inked && palace.isDaiVan}
          selected={palace.index === selectedIndex}
          onSelect={onSelectPalace}
        />
      ))}
      <div className="relative col-span-2 col-start-2 row-span-2 row-start-2 flex flex-col items-center justify-center overflow-hidden bg-emerald-50/40 p-3 text-center">
        {/* The chart's one signature mark: Tử Vi's own name in Hán tự, inked
            faint behind the identity panel — the way a manuscript lá số
            annotates the chart it sits on, not a decorative flourish. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center font-tuvi-serif text-[76px] leading-none text-[#18181b]/4 sm:text-[104px]"
        >
          紫微
        </span>
        {/* A column, not a bare wrapper: the caller passes several sibling spans
            and inline flow ran them together into one unreadable line. */}
        <div className="relative flex flex-col items-center gap-1">{identity}</div>
      </div>
    </div>
  )
}
