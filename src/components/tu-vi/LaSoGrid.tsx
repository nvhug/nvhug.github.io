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

// A palace cell holds three or four labels before it has to summarise; the rest
// are reachable through the palace sheet. See docs/DESIGN.md § Content range check.
const STAR_LIMIT = 3

function CompactCell({ palace, inked }: { palace: Palace; inked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`border border-[#e4e4e7] transition-colors duration-500 motion-reduce:transition-none ${
        inked ? 'bg-[#ecfdf5]' : 'bg-[#ffffff]'
      } ${CELL_POSITION[palace.index]}`}
    />
  )
}

function FullCell({
  palace,
  inked,
  onSelect,
}: {
  palace: Palace
  inked: boolean
  onSelect: (palace: Palace) => void
}) {
  const { t } = useLanguage()
  const shown = palace.stars.slice(0, STAR_LIMIT)
  const hidden = palace.stars.length - shown.length

  return (
    <button
      type="button"
      onClick={() => onSelect(palace)}
      className={`flex min-h-11 flex-col items-stretch border border-[#e4e4e7] p-1 text-left transition-colors duration-500 hover:bg-[#ecfdf5]/60 focus-visible:outline-2 focus-visible:outline-[#047857] active:bg-[#ecfdf5] motion-reduce:transition-none ${
        inked ? 'bg-[#ecfdf5]' : 'bg-[#ffffff]'
      } ${CELL_POSITION[palace.index]}`}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="font-tuvi-serif text-[10px] leading-tight text-[#18181b] sm:text-xs">
          {palace.name}
        </span>
        <span className="font-tuvi-mono text-[8px] tracking-wide text-[#71717a] sm:text-[10px]">
          {STEMS[palace.pillar.stem]} {BRANCHES[palace.pillar.branch]}
        </span>
      </span>

      <span className="mt-0.5 flex flex-col items-start gap-px">
        {palace.stars.length === 0 && (
          <span className="font-tuvi-sans text-[9px] text-[#71717a] sm:text-[11px]">
            {t('tuVi.noStars')}
          </span>
        )}
        {shown.map((star) => (
          <span
            key={star.name}
            className="font-tuvi-sans text-[9px] leading-tight text-[#18181b] sm:text-[11px]"
          >
            {star.name}
          </span>
        ))}
        {hidden > 0 && (
          <span className="font-tuvi-sans text-[9px] text-[#71717a] sm:text-[11px]">+{hidden}</span>
        )}
      </span>

      {(palace.tuan || palace.triet) && (
        <span className="mt-auto pt-0.5 font-tuvi-mono text-[8px] tracking-wider text-[#dc2626] sm:text-[10px]">
          {[palace.tuan ? 'Tuần' : '', palace.triet ? 'Triệt' : ''].filter(Boolean).join(', ')}
        </span>
      )}
    </button>
  )
}

/** Inks the current Đại vận palace once the grid itself has drawn. */
function useInkedIn() {
  const [inked, setInked] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setInked(true), 120)
    return () => window.clearTimeout(id)
  }, [])
  return inked
}

/** The miniature chart in the header, which is itself the control that opens the full one. */
export function LaSoMini({ chart, onOpen }: { chart: Chart; onOpen: () => void }) {
  const { t } = useLanguage()
  const inked = useInkedIn()

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('tuVi.openChart')}
      className="size-16 shrink-0 rounded-lg border border-[#e4e4e7] bg-[#e4e4e7] p-px transition-transform focus-visible:outline-2 focus-visible:outline-[#047857] active:scale-[0.98] sm:size-20"
    >
      <span className="grid size-full grid-cols-4 grid-rows-4 gap-px">
        {chart.palaces.map((palace) => (
          <CompactCell key={palace.index} palace={palace} inked={inked && palace.isDaiVan} />
        ))}
        <span
          aria-hidden="true"
          className="col-span-2 col-start-2 row-span-2 row-start-2 bg-[#f7fef9]"
        />
      </span>
    </button>
  )
}

export function LaSoFull({
  chart,
  identity,
  onSelectPalace,
}: {
  chart: Chart
  identity: React.ReactNode
  onSelectPalace: (palace: Palace) => void
}) {
  const inked = useInkedIn()

  return (
    <div className="grid aspect-square w-full grid-cols-4 grid-rows-4 gap-px bg-[#e4e4e7]">
      {chart.palaces.map((palace) => (
        <FullCell
          key={palace.index}
          palace={palace}
          inked={inked && palace.isDaiVan}
          onSelect={onSelectPalace}
        />
      ))}
      <div className="relative col-span-2 col-start-2 row-span-2 row-start-2 flex flex-col items-center justify-center gap-1 overflow-hidden bg-[#f7fef9] p-2 text-center">
        {/* The chart's one signature mark: Tử Vi's own name in Hán tự, inked
            faint behind the identity panel — the way a manuscript lá số
            annotates the chart it sits on, not a decorative flourish. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center font-tuvi-serif text-[64px] leading-none text-[#18181b]/6 sm:text-[80px]"
        >
          紫微
        </span>
        <div className="relative">{identity}</div>
      </div>
    </div>
  )
}
