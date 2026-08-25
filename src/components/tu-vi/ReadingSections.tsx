'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import {
  AREA_PALACE,
  explainPalaceScore,
  findWeakestArea,
  luckKeyPalaceIndexes,
  QUY_NHAN_STARS,
  TRANSFORM_LABEL,
} from '@/lib/tuvi/scoring'
import { ScoreMeter } from './ScoreMeter'
import type { InterpretationState } from '@/hooks/useInterpretation'
import type { Palace, Reading } from '@/lib/tuvi/types'

type AreaKey = 'career' | 'wealth' | 'love' | 'family' | 'health'
type RowKey = 'tuDuy' | AreaKey | 'hauVan' | 'quyNhan' | 'diemYeu'

const AREAS: Array<[AreaKey, string, string]> = [
  ['career', 'tuVi.areaCareer', '💼'],
  ['wealth', 'tuVi.areaWealth', '💰'],
  ['love', 'tuVi.areaLove', '❤️'],
  ['family', 'tuVi.areaFamily', '👨‍👩‍👦'],
  ['health', 'tuVi.areaHealth', '🩺'],
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
    <div className="rounded-lg border border-dashed border-[#e4e4e7] bg-[#ffffff] p-3">
      <p className="font-tuvi-serif text-sm text-[#d97706]">{t('tuVi.needHour')}</p>
      <p className="mt-1 text-sm text-[#52525b]">{t('tuVi.needHourBody')}</p>
      <Link
        href="/tu-vi/edit"
        className="mt-2 inline-block text-sm font-medium text-[#d97706] underline-offset-2 transition-transform hover:underline active:scale-[0.98]"
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
    every row in the scored-items table. */
function PalaceScoreDetail({ palace }: { palace: Palace | null | undefined }) {
  const { t } = useLanguage()
  if (!palace) return null

  const breakdown = explainPalaceScore(palace)
  const chinhCount = breakdown.stars.filter((star) => star.kind === 'chinh').length
  const voidLabel = [palace.tuan ? 'Tuần' : '', palace.triet ? 'Triệt' : ''].filter(Boolean).join(', ')

  return (
    <div className="font-tuvi-sans text-xs leading-relaxed text-[#52525b]">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {breakdown.stars.length === 0 ? (
          <span>{t('tuVi.noStars')}</span>
        ) : (
          <>
            {chinhCount === 0 && <span className="text-[#d97706]">{t('tuVi.voChinhDieu')}</span>}
            {breakdown.stars.map((star, index) => (
              <span key={`${star.name}-${index}`} className={star.kind === 'chinh' ? 'text-[#18181b]' : ''}>
                {star.name}
                {star.transform && ` (${TRANSFORM_LABEL[star.transform]})`} {star.weight >= 0 ? `+${star.weight}` : star.weight}
              </span>
            ))}
          </>
        )}
        {voidLabel && <span className="text-[#dc2626]">{voidLabel}</span>}
      </p>
      <p className="mt-0.5">
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

  return (
    <p className="font-tuvi-sans text-xs leading-relaxed text-[#52525b]">
      {found.size > 0 ? [...found].join(', ') : t('tuVi.luckNoStars')}
    </p>
  )
}

/**
 * The AI's take on one scored item. `field="short"` is the always-visible,
 * one-line table caption; `field="detail"` is the fuller 3-5 sentence
 * reading shown once the row is expanded.
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
      <span className="inline-block h-3 max-w-55 w-full overflow-hidden rounded-full bg-[#f4f4f5]">
        <span className="relative block h-full w-1/3 animate-shimmer-sweep bg-white/60 motion-reduce:hidden" />
      </span>
    )
  }

  if (state.status === 'limited') {
    return <span className="font-tuvi-sans text-xs text-[#52525b]">{t('tuVi.interpretLimit')}</span>
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
  return (
    <p
      className={
        field === 'short'
          ? 'font-tuvi-sans text-xs leading-snug text-[#52525b]'
          : 'mt-1.5 font-tuvi-sans text-sm leading-relaxed text-[#27272a]'
      }
    >
      {text}
    </p>
  )
}

function PalaceCard({ title, palace }: { title: string; palace: Reading['menh'] }) {
  const { t } = useLanguage()
  return (
    <div className="flex-1 rounded-lg border border-[#e4e4e7] bg-[#ffffff] p-3">
      {/* A field label, not a section eyebrow: it names the value directly below it. */}
      <p className="font-tuvi-serif text-xs text-[#52525b]">{title}</p>
      {palace ? (
        <p className="mt-1 font-tuvi-sans text-sm leading-snug text-[#18181b]">
          {/* A palace with no major star is vô chính diệu; a supporting star
              standing in for one would misread the chart. */}
          {majorStarNames(palace) || t('tuVi.voChinhDieu')}
        </p>
      ) : (
        <p className="mt-1 font-tuvi-sans text-sm text-[#d97706]">{t('tuVi.needHour')}</p>
      )}
    </div>
  )
}

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

  let rows: Array<{ key: RowKey; icon: string; label: string; value: number; interpretKey: string; detail: React.ReactNode }> = []
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
        icon: '🧠',
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
        icon: '🏠',
        label: t('tuVi.areaLaterLife'),
        value: scores.laterLife,
        interpretKey: 'hauVan',
        detail: <PalaceScoreDetail palace={reading.laterLifePalace} />,
      },
      {
        key: 'quyNhan',
        icon: '🍀',
        label: t('tuVi.areaLuck'),
        value: scores.luck,
        interpretKey: 'quyNhan',
        detail: <LuckDetail reading={reading} />,
      },
      ...(weakest
        ? [
            {
              key: 'diemYeu' as const,
              icon: '⚠️',
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
      <section className="border-t border-[#e4e4e7] pt-5">
        <h2 className="sr-only">{t('tuVi.sectionOverall')}</h2>
        {scores ? (
          <>
            <div className="flex items-center gap-2">
              <ScoreMeter value={scores.overall} size="lg" />
              <span className="font-tuvi-sans text-sm text-[#52525b]">{reading.chart.cuc?.name}</span>
            </div>
            <InterpretationNote interpretation={interpretation} sectionKey="tongQuan" field="detail" />
          </>
        ) : (
          <NeedHour />
        )}
      </section>

      <section className="mt-5 border-t border-[#e4e4e7] pt-5">
        <h2 className="sr-only">
          {t('tuVi.sectionMenh')} / {t('tuVi.sectionThan')}
        </h2>
        <div className="flex gap-2">
          <PalaceCard title={t('tuVi.sectionMenh')} palace={reading.menh} />
          <PalaceCard title={t('tuVi.sectionThan')} palace={reading.than} />
        </div>
      </section>

      {scores && (
        <section className="mt-5 border-t border-[#e4e4e7] pt-5">
          <h2 className="sr-only">{t('tuVi.sectionAreas')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 border-collapse text-left">
              <thead>
                <tr className="border-b border-[#e4e4e7]">
                  <th className="py-1.5 pr-2 font-tuvi-serif text-xs font-normal text-[#52525b]">
                    {t('tuVi.tableAspect')}
                  </th>
                  <th className="py-1.5 pr-2 font-tuvi-serif text-xs font-normal text-[#52525b]">
                    {t('tuVi.tableScore')}
                  </th>
                  <th className="py-1.5 font-tuvi-serif text-xs font-normal text-[#52525b]">
                    {t('tuVi.tableNote')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const isExpanded = Boolean(expanded[row.key])
                  return (
                    <Fragment key={row.key}>
                      <tr
                        className="animate-fade-in-up border-b border-[#e4e4e7] align-top motion-reduce:animate-none"
                        style={{ animationDelay: `${index * 60}ms` }}
                      >
                        <td className="py-2 pr-2">
                          <button
                            type="button"
                            onClick={() => toggle(row.key)}
                            aria-expanded={isExpanded}
                            className="flex items-center gap-1 text-left text-sm text-[#18181b]"
                          >
                            <span aria-hidden="true">{row.icon}</span>
                            {row.label}
                            <ChevronDown
                              aria-hidden="true"
                              className={`h-3.5 w-3.5 shrink-0 text-[#a1a1aa] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          <ScoreMeter value={row.value} />
                        </td>
                        <td className="py-2">
                          <InterpretationNote interpretation={interpretation} sectionKey={row.interpretKey} field="short" />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="animate-fade-in-up border-b border-[#e4e4e7] bg-[#fafafa] motion-reduce:animate-none">
                          <td colSpan={3} className="p-2">
                            {row.detail}
                            <InterpretationNote interpretation={interpretation} sectionKey={row.interpretKey} field="detail" />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-5 border-t border-[#e4e4e7] pt-5">
        <h2 className="sr-only">{t('tuVi.sectionCycles')}</h2>
        <ul className="divide-y divide-[#e4e4e7]">
          {reading.cycles.map((cycle) => (
            <li key={cycle.key} className="flex items-baseline justify-between gap-2 py-2.5">
              <span className="text-sm text-[#18181b]">{t(CYCLE_LABEL[cycle.key])}</span>
              <span className="text-right">
                {cycle.name && (
                  <span className="block font-tuvi-sans text-sm text-[#18181b]">{cycle.name}</span>
                )}
                <span className="block font-tuvi-sans text-xs text-[#52525b]">
                  {spanText(cycle.span)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <InterpretationNote interpretation={interpretation} sectionKey="vanHan" field="detail" />
      </section>
    </>
  )
}
