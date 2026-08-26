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

export type PalaceTone = 'menh' | 'than' | 'daiVan' | 'plain'

/**
 * Which of the three marks decides a palace's fill — at most one.
 *
 * Priority is deliberate. Mệnh and Thân are what a palace *is* and never move;
 * Đại vận is only where the reader stands right now. On an overlap the identity
 * fill stays and the decade reports itself with its own chip instead, because
 * letting Đại vận win would visually erase the Mệnh palace for the ten years it
 * happens to be current — the one palace a reader looks for first.
 */
export function palaceTone(palace: Palace): PalaceTone {
  if (palace.isMenh) return 'menh'
  if (palace.isThan) return 'than'
  if (palace.isDaiVan) return 'daiVan'
  return 'plain'
}

/**
 * Fill per tone, and the hover that goes with it.
 *
 * Split from the hover on purpose: the legend below the chart paints the same
 * swatches, and a legend that drifts from the grid it explains is worse than no
 * legend. Each tone also carries its OWN hover — a single shared
 * `hover:bg-emerald-50` used to collide exactly with the Đại vận fill, so the
 * current decade looked identical to whatever cell the pointer happened to be
 * over, and the mark said nothing.
 */
const TONE_FILL: Record<PalaceTone, string> = {
  menh: 'bg-emerald-100',
  than: 'bg-emerald-50',
  daiVan: 'bg-amber-50',
  plain: 'bg-white',
}

const TONE_HOVER: Record<PalaceTone, string> = {
  menh: 'hover:bg-emerald-200/60',
  than: 'hover:bg-emerald-100',
  daiVan: 'hover:bg-amber-100/70',
  plain: 'hover:bg-emerald-50',
}

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

  // Mệnh and Thân are there from the first paint; only the decade fades in, so
  // the eye is drawn to where the reader currently stands after the chart has
  // settled rather than during it.
  const tone = palaceTone(palace)
  const shown: PalaceTone = tone === 'daiVan' && !inked ? 'plain' : tone

  return (
    <button
      type="button"
      onClick={() => onSelect(palace)}
      aria-pressed={selected}
      className={`@container relative flex flex-col items-stretch overflow-hidden p-2 text-left transition-colors duration-500 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#047857] motion-reduce:transition-none ${
        TONE_FILL[shown]
      } ${TONE_HOVER[shown]} ${
        selected ? 'z-10 ring-2 ring-emerald-500 ring-inset' : ''
      } ${CELL_POSITION[palace.index]}`}
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
        {/* Down here rather than beside the Mệnh/Thân badge: this row already
            carries several chips, and it is what lets a palace that is both an
            identity and the current decade show both without either winning. */}
        {palace.isDaiVan && (
          <span className="rounded bg-amber-100 px-1.5 font-tuvi-sans text-[10px] leading-[1.6] text-[#b45309]">
            {t('tuVi.cycleDaiVan')}
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
          inked={inked}
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

const LEGEND: ReadonlyArray<{ tone: PalaceTone; label: string }> = [
  { tone: 'menh', label: 'tuVi.sectionMenh' },
  { tone: 'than', label: 'tuVi.sectionThan' },
  { tone: 'daiVan', label: 'tuVi.cycleDaiVan' },
]

/**
 * What the three fills mean.
 *
 * Colour without a key is a puzzle: the grid can tint the Mệnh, Thân and Đại vận
 * palaces perfectly and still tell the reader nothing until something on screen
 * says which is which. Swatches carry a ring because the two lighter fills are
 * nearly invisible against the white card on their own.
 */
export function LaSoLegend() {
  const { t } = useLanguage()
  return (
    <ul className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 font-tuvi-sans text-xs text-[#52525b]">
      {LEGEND.map(({ tone, label }) => (
        <li key={tone} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`size-3 shrink-0 rounded-sm ring-1 ring-emerald-200 ${TONE_FILL[tone]}`}
          />
          {t(label)}
        </li>
      ))}
    </ul>
  )
}
