'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Brain,
  Briefcase,
  ChevronDown,
  Clock,
  Clover,
  Heart,
  Home,
  Stethoscope,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import {
  AREA_PALACE,
  explainPalaceScore,
  findWeakestArea,
  luckKeyPalaceIndexes,
  QUY_NHAN_STARS,
  TRANSFORM_LABEL,
} from '@/lib/tuvi/scoring'
import { splitReadingParagraphs } from '@/lib/tuvi/prose'
import { ScoreMeter } from './ScoreMeter'
import type { InterpretationState } from '@/hooks/useInterpretation'
import type { Palace, Reading } from '@/lib/tuvi/types'

type AreaKey = 'career' | 'wealth' | 'love' | 'family' | 'health'
type RowKey = 'tuDuy' | AreaKey | 'hauVan' | 'quyNhan' | 'diemYeu'

const AREAS: Array<[AreaKey, string, LucideIcon]> = [
  ['career', 'tuVi.areaCareer', Briefcase],
  ['wealth', 'tuVi.areaWealth', Wallet],
  ['love', 'tuVi.areaLove', Heart],
  ['family', 'tuVi.areaFamily', Users],
  ['health', 'tuVi.areaHealth', Stethoscope],
]

// The AI section key that belongs under each scored item (spec's
// tongQuan/tuDuy/.../diemYeu shape from buildInterpretationPrompt).
const AREA_INTERPRET_KEY: Record<AreaKey, string> = {
  career: 'suNghiep',
  wealth: 'taiLoc',
  love: 'tinhDuyen',
  family: 'giaDao',
  health: 'sucKhoe',
}

const CYCLE_LABEL: Record<string, string> = {
  daiVan: 'tuVi.cycleDaiVan',
  luuNien: 'tuVi.cycleLuuNien',
  luuNguyet: 'tuVi.cycleLuuNguyet',
}

/** Spans arrive structured so the wording follows the reader's language. */
function useSpanText() {
  const { t } = useLanguage()
  return (span: Reading['cycles'][number]['span']) => {
    switch (span.kind) {
      case 'ageRange':
        return t('tuVi.spanAgeRange', { from: span.from, to: span.to })
      case 'ageFrom':
        return t('tuVi.spanAgeFrom', { from: span.from })
      case 'lunarYear':
        return t('tuVi.spanLunarYear', { year: span.year })
      case 'lunarMonth':
        return span.leap
          ? t('tuVi.spanLunarMonthLeap', { month: span.month })
          : t('tuVi.spanLunarMonth', { month: span.month })
      case 'needHour':
        return t('tuVi.needHour')
    }
  }
}

function NeedHour() {
  const { t } = useLanguage()
  return (
    <div className="rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-white p-4">
      <p className="flex items-center gap-2 font-tuvi-serif text-sm text-[#b45309]">
        <Clock aria-hidden="true" className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
        {t('tuVi.needHour')}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-[#52525b]">{t('tuVi.needHourBody')}</p>
      <Link
        href="/tu-vi/edit"
        className="mt-2.5 inline-flex items-center rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-sm font-medium text-[#b45309] transition-all hover:bg-amber-50 active:scale-[0.98]"
      >
        {t('tuVi.needHourAction')}
      </Link>
    </div>
  )
}

function majorStarNames(palace: NonNullable<Reading['menh']>): string {
  return palace.stars
    .filter((star) => star.kind === 'chinh')
    .map((star) => star.name)
    .join(', ')
}

/** Every star behind a palace's score, plus the arithmetic that turned them
    into the percent — so the number is never left unexplained. Shared by
    every row in the scored-items list. */
function PalaceScoreDetail({ palace }: { palace: Palace | null | undefined }) {
  const { t } = useLanguage()
  if (!palace) return null

  const breakdown = explainPalaceScore(palace)
  const chinhCount = breakdown.stars.filter((star) => star.kind === 'chinh').length
  const voidLabel = [palace.tuan ? 'Tuần' : '', palace.triet ? 'Triệt' : ''].filter(Boolean).join(', ')

  return (
    <div className="font-tuvi-sans text-xs leading-relaxed text-[#52525b]">
      <p className="flex flex-wrap items-center gap-1.5">
        {breakdown.stars.length === 0 ? (
          <span>{t('tuVi.noStars')}</span>
        ) : (
          <>
            {chinhCount === 0 && (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[#b45309]">
                {t('tuVi.voChinhDieu')}
              </span>
            )}
            {breakdown.stars.map((star, index) => (
              <span
                key={`${star.name}-${index}`}
                className={`rounded-md px-1.5 py-0.5 ${
                  star.kind === 'chinh'
                    ? 'bg-emerald-50 font-medium text-[#065f46]'
                    : 'bg-[#f4f4f5] text-[#52525b]'
                }`}
              >
                {star.name}
                {star.transform && ` (${TRANSFORM_LABEL[star.transform]})`}{' '}
                {star.weight >= 0 ? `+${star.weight}` : star.weight}
              </span>
            ))}
          </>
        )}
        {voidLabel && (
          <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[#dc2626]">{voidLabel}</span>
        )}
      </p>
      <p className="mt-1.5">
        {breakdown.dampened
          ? t('tuVi.scoreBreakdownDampened', {
              raw: breakdown.rawTotal,
              voidLabel,
              total: breakdown.total,
              percent: breakdown.percent,
            })
          : t('tuVi.scoreBreakdownTotal', { total: breakdown.total, percent: breakdown.percent })}
      </p>
    </div>
  )
}

/** Which quý nhân stars actually landed in Mệnh, Thân, the current Đại vận,
    or one of the five life areas — same footprint scoring.ts's luck uses. */
function LuckDetail({ reading }: { reading: Reading }) {
  const { t } = useLanguage()
  const { menhIndex, thanIndex, palaces } = reading.chart
  const daiVanIndex = palaces.find((p) => p.isDaiVan)?.index ?? null
  const keyIndexes = menhIndex === null ? [] : luckKeyPalaceIndexes(palaces, menhIndex, thanIndex, daiVanIndex)
  const found = new Set<string>()
  for (const index of keyIndexes) {
    for (const star of palaces[index].stars) {
      if ((QUY_NHAN_STARS as readonly string[]).includes(star.name)) found.add(star.name)
    }
  }

  if (found.size === 0) {
    return (
      <p className="font-tuvi-sans text-xs leading-relaxed text-[#52525b]">{t('tuVi.luckNoStars')}</p>
    )
  }

  return (
    <p className="flex flex-wrap gap-1.5 font-tuvi-sans text-xs">
      {[...found].map((name) => (
        <span key={name} className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-[#065f46]">
          {name}
        </span>
      ))}
    </p>
  )
}

/**
 * The AI's take on one scored item. `field="short"` is the always-visible,
 * one-line caption under the row label; `field="detail"` is the fuller 3-5
 * sentence reading shown once the row is expanded.
 */
function InterpretationNote({
  interpretation,
  sectionKey,
  field,
}: {
  interpretation: { state: InterpretationState; retry: () => void }
  sectionKey: string
  field: 'short' | 'detail'
}) {
  const { t } = useLanguage()
  const { state, retry } = interpretation

  if (state.status === 'loading') {
    return (
      <span className="mt-1 inline-block h-3 w-full max-w-55 overflow-hidden rounded-full bg-[#f4f4f5]">
        <span className="relative block h-full w-1/3 animate-shimmer-sweep bg-white/60 motion-reduce:hidden" />
      </span>
    )
  }

  if (state.status === 'limited') {
    return <span className="font-tuvi-sans text-xs text-[#52525b]">{t('tuVi.interpretLimit')}</span>
  }

  // Nothing stored for this birth data and lunar month. The per-section slots stay quiet —
  // the offer to generate belongs once at the top of the screen, not repeated eleven times.
  if (state.status === 'needsGeneration') {
    return null
  }

  if (state.status === 'failed') {
    return (
      <span className="font-tuvi-sans text-xs text-[#52525b]">
        {t('tuVi.interpretError')}{' '}
        <button
          type="button"
          onClick={retry}
          className="font-medium text-[#047857] underline-offset-2 hover:underline active:scale-[0.98]"
        >
          {t('tuVi.interpretRetry')}
        </button>
      </span>
    )
  }

  const text = state.sections[sectionKey]?.[field]
  if (!text) return null

  if (field === 'short') {
    return <p className="font-tuvi-sans text-xs leading-snug text-[#52525b]">{text}</p>
  }

  // A detail reading runs 3-5 dense sentences; as one block it is a wall of
  // text on a phone, so it is broken into short paragraphs with air between them.
  return (
    <div className="mt-2 flex max-w-prose flex-col gap-2">
      {splitReadingParagraphs(text).map((paragraph, index) => (
        <p key={index} className="font-tuvi-sans text-sm leading-relaxed text-[#27272a]">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

function PalaceCard({ title, palace }: { title: string; palace: Reading['menh'] }) {
  const { t } = useLanguage()
  return (
    <div className="flex-1 rounded-xl border border-emerald-100 bg-linear-to-br from-white to-emerald-50/60 p-3">
      {/* A field label, not a section eyebrow: it names the value directly below it. */}
      <p className="font-tuvi-serif text-xs text-[#52525b]">{title}</p>
      {palace ? (
        <p className="mt-1 font-tuvi-sans text-sm leading-snug font-medium text-[#18181b]">
          {/* A palace with no major star is vô chính diệu; a supporting star
              standing in for one would misread the chart. */}
          {majorStarNames(palace) || t('tuVi.voChinhDieu')}
        </p>
      ) : (
        <p className="mt-1 font-tuvi-sans text-sm text-[#b45309]">{t('tuVi.needHour')}</p>
      )}
    </div>
  )
}

/** How few generations must be left before the screen says so. */
const REMAINING_WARN_AT = 2

export function ReadingSections({
  reading,
  interpretation,
}: {
  reading: Reading
  interpretation: { state: InterpretationState; retry: () => void }
}) {
  const { t } = useLanguage()
  const spanText = useSpanText()
  const [expanded, setExpanded] = useState<Partial<Record<RowKey, boolean>>>({})
  const toggle = (key: RowKey) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  const scores = reading.scores

  let rows: Array<{
    key: RowKey
    icon: LucideIcon
    label: string
    value: number
    interpretKey: string
    detail: React.ReactNode
  }> = []
  if (scores) {
    const weakest = findWeakestArea(reading.chart.palaces)
    let weakestPalace: Palace | null | undefined
    if (weakest) {
      const areaKey = weakest.key
      weakestPalace =
        areaKey === 'menh' ? reading.menh : reading.chart.palaces.find((p) => p.name === AREA_PALACE[areaKey])
    }

    rows = [
      {
        key: 'tuDuy',
        icon: Brain,
        label: t('tuVi.areaMindWillpower'),
        value: scores.mindWillpower,
        interpretKey: 'tuDuy',
        detail: <PalaceScoreDetail palace={reading.menh} />,
      },
      ...AREAS.map(([key, labelKey, icon]) => ({
        key,
        icon,
        label: t(labelKey),
        value: scores.areas[key],
        interpretKey: AREA_INTERPRET_KEY[key],
        detail: <PalaceScoreDetail palace={reading.chart.palaces.find((p) => p.name === AREA_PALACE[key])} />,
      })),
      {
        key: 'hauVan',
        icon: Home,
        label: t('tuVi.areaLaterLife'),
        value: scores.laterLife,
        interpretKey: 'hauVan',
        detail: <PalaceScoreDetail palace={reading.laterLifePalace} />,
      },
      {
        key: 'quyNhan',
        icon: Clover,
        label: t('tuVi.areaLuck'),
        value: scores.luck,
        interpretKey: 'quyNhan',
        detail: <LuckDetail reading={reading} />,
      },
      ...(weakest
        ? [
            {
              key: 'diemYeu' as const,
              icon: TriangleAlert,
              label: t('tuVi.sectionWeakness'),
              value: weakest.breakdown.percent,
              interpretKey: 'diemYeu',
              detail: <PalaceScoreDetail palace={weakestPalace} />,
            },
          ]
        : []),
    ]
  }

  return (
    <>
      {/* Section names stay in the document for assistive tech but are not
          painted: taste-skill 9.F caps visible eyebrows at one per three
          sections, and every row below already names itself. */}
      <section className="border-t border-emerald-100/80 pt-5">
        <h2 className="sr-only">{t('tuVi.sectionOverall')}</h2>
        {scores ? (
          <>
            <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-linear-to-br from-emerald-50/90 via-white to-white p-4">
              <ScoreMeter value={scores.overall} size="lg" />
              <div className="min-w-0 flex-1">
                {reading.chart.cuc && (
                  <p className="font-tuvi-serif text-base leading-tight text-[#18181b]">
                    {reading.chart.cuc.name}
                  </p>
                )}
              </div>
            </div>
            <InterpretationNote interpretation={interpretation} sectionKey="tongQuan" field="detail" />
          </>
        ) : (
          <NeedHour />
        )}
      </section>

      <section className="mt-5 border-t border-emerald-100/80 pt-5">
        <h2 className="sr-only">
          {t('tuVi.sectionMenh')} / {t('tuVi.sectionThan')}
        </h2>
        <div className="flex gap-2">
          <PalaceCard title={t('tuVi.sectionMenh')} palace={reading.menh} />
          <PalaceCard title={t('tuVi.sectionThan')} palace={reading.than} />
        </div>
      </section>

      {scores && (
        <section className="mt-5 border-t border-emerald-100/80 pt-5">
          <h2 className="sr-only">{t('tuVi.sectionAreas')}</h2>
          {/* A list, not a table: the previous min-width table scrolled
              sideways on a phone, which the reading screen must never do.
              Label and meter share one tappable line; the AI caption sits on
              its own line below, where it has the full card width. */}
          <ul className="divide-y divide-emerald-100/70">
            {rows.map((row, index) => {
              const isExpanded = Boolean(expanded[row.key])
              const Icon = row.icon
              return (
                <li
                  key={row.key}
                  className="animate-fade-in-up py-1 motion-reduce:animate-none"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(row.key)}
                    aria-expanded={isExpanded}
                    className="flex w-full items-center gap-2.5 rounded-lg px-1 py-2 text-left transition-colors hover:bg-emerald-50/60 focus-visible:outline-2 focus-visible:outline-[#047857] active:bg-emerald-50"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#047857] ring-1 ring-emerald-100">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-[#18181b]">{row.label}</span>
                    <ScoreMeter value={row.value} />
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-4 w-4 shrink-0 text-[#a1a1aa] transition-transform sm:h-3.5 sm:w-3.5 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <div className="pr-1 pb-1 pl-11.5">
                    <InterpretationNote interpretation={interpretation} sectionKey={row.interpretKey} field="short" />
                  </div>

                  {isExpanded && (
                    <div className="animate-fade-in-up mt-1 mb-2 ml-11.5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 motion-reduce:animate-none">
                      {row.detail}
                      <InterpretationNote interpretation={interpretation} sectionKey={row.interpretKey} field="detail" />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-5 border-t border-emerald-100/80 pt-5">
        <h2 className="sr-only">{t('tuVi.sectionCycles')}</h2>
        <div className="grid gap-2 lg:grid-cols-3">
          {reading.cycles.map((cycle) => (
            <div
              key={cycle.key}
              className="flex items-baseline justify-between gap-2 rounded-xl border border-emerald-100 bg-linear-to-br from-white to-emerald-50/60 p-3 lg:block"
            >
              {/* A field label naming the value beside/below it, same treatment
                  as the Mệnh and Thân cards. */}
              <p className="font-tuvi-serif text-xs text-[#52525b]">{t(CYCLE_LABEL[cycle.key])}</p>
              <div className="text-right lg:mt-1 lg:text-left">
                {cycle.name && (
                  <p className="font-tuvi-sans text-sm font-medium text-[#18181b]">{cycle.name}</p>
                )}
                <p className="font-tuvi-sans text-xs text-[#52525b]">{spanText(cycle.span)}</p>
              </div>
            </div>
          ))}
        </div>
        <InterpretationNote interpretation={interpretation} sectionKey="vanHan" field="detail" />
      </section>

      <RemainingNote state={interpretation.state} />
    </>
  )
}

/**
 * Warns before the daily allowance runs out rather than at it.
 *
 * Only shown once it is nearly spent: the count arrives solely on a reading that
 * just spent a slot, and printing "5 left" after every generation would be noise
 * for a reader who will spend one a day and never see the cap.
 */
function RemainingNote({ state }: { state: InterpretationState }) {
  const { t } = useLanguage()
  if (state.status !== 'ready' || state.remaining === undefined) return null
  if (state.remaining > REMAINING_WARN_AT) return null

  return (
    <p className="mt-3 font-tuvi-sans text-xs text-[#b45309]">
      {t('tuVi.interpretRemaining', { n: state.remaining })}
    </p>
  )
}
