'use client'

import { useMemo, useState } from 'react'
import { Note } from '@/types'
import { useLanguage } from '@/lib/i18n/language-context'
import { toLocalISODate } from '@/lib/date'

const DAYS = 30
const BAR_W = 18
const BAR_GAP = 8
const CHART_H = 160
const Y_W = 28
const X_H = 22

const C_GOOD = '#10b981'
const C_BAD  = '#f59e0b'

interface Props {
  notes: Note[]
}

function toISO(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return toLocalISODate(d)
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

export function NotesAnalytics({ notes }: Props) {
  const { t } = useLanguage()
  const [hov, setHov] = useState<number | null>(null)

  const days = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => toISO(DAYS - 1 - i)),
    []
  )

  const map = useMemo(() => {
    const m = new Map<string, { good: number; bad: number }>()
    notes.forEach((n) => {
      const e = m.get(n.note_date) ?? { good: 0, bad: 0 }
      if (n.type === 'good') e.good++; else e.bad++
      m.set(n.note_date, e)
    })
    return m
  }, [notes])

  const data = useMemo(
    () => days.map((date) => ({ date, ...(map.get(date) ?? { good: 0, bad: 0 }) })),
    [days, map]
  )

  const yMax = Math.max(
    Math.ceil(Math.max(...data.map((d) => d.good + d.bad)) / 4) * 4,
    4
  )

  const total30 = data.reduce((a, d) => a + d.good + d.bad, 0)
  const good30  = data.reduce((a, d) => a + d.good, 0)
  const bad30   = data.reduce((a, d) => a + d.bad, 0)
  const goodPct = total30 > 0 ? Math.round((good30 / total30) * 100) : 0

  const streak = useMemo(() => {
    let s = 0
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].good + data[i].bad > 0) s++
      else break
    }
    return s
  }, [data])

  const W = Y_W + DAYS * (BAR_W + BAR_GAP)
  const H = CHART_H + X_H
  const bx = (i: number) => Y_W + i * (BAR_W + BAR_GAP)
  const bh = (v: number) => (v / yMax) * CHART_H

  const hovItem = hov !== null ? data[hov] : null

  return (
    <div className="space-y-4 p-4">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile color="zinc"    label={t('notesAnalytics.total30d')}  value={total30} sub={t('notesAnalytics.notesLogged')} />
        <Tile color="emerald" label={t('notesAnalytics.goodLabel')} value={good30}  sub={t('notesAnalytics.ofTotal', { pct: goodPct })} />
        <Tile color="amber"   label={t('notesAnalytics.badLabel')}  value={bad30}   sub={t('notesAnalytics.ofTotal', { pct: 100 - goodPct })} />
        <Tile color="zinc"    label={t('notesAnalytics.streak')}    value={streak}  sub={t('notesAnalytics.streakDays')} />
      </div>

      {/* Bar chart */}
      <div className="rounded-xl border border-emerald-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-emerald-50 px-4 py-2.5">
          <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t('notesAnalytics.chartHeading')}
          </span>
          <div className="flex gap-3">
            <Dot color={C_GOOD} label={t('notesAnalytics.goodLabel')} />
            <Dot color={C_BAD}  label={t('notesAnalytics.badLabel')} />
          </div>
        </div>

        <div className="overflow-x-auto px-3 py-4">
          <div className="relative" style={{ width: W }}>
            <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
              {/* Y gridlines + labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const v = Math.round(yMax * t)
                const y = CHART_H - bh(v)
                return (
                  <g key={t}>
                    <line
                      x1={Y_W} x2={W} y1={y} y2={y}
                      stroke={t === 0 ? '#d4d4d8' : '#f4f4f5'}
                      strokeWidth={1}
                    />
                    <text x={Y_W - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill="#a1a1aa">
                      {v}
                    </text>
                  </g>
                )
              })}

              {data.map((d, i) => {
                const x = bx(i)
                const gh = bh(d.good)
                const bH = bh(d.bad)
                const isHov = hov === i
                const total = d.good + d.bad
                const showLabel = i === 0 || (i + 1) % 7 === 0 || i === DAYS - 1

                return (
                  <g key={d.date} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
                    <rect x={x - 2} y={0} width={BAR_W + 4} height={CHART_H} fill="transparent" style={{ cursor: 'pointer' }} />

                    {total === 0 ? (
                      <rect x={x} y={CHART_H - 2} width={BAR_W} height={2} fill={isHov ? '#d4d4d8' : '#e4e4e7'} rx={1} />
                    ) : (
                      <>
                        {/* good bar (bottom of stack) */}
                        {gh > 0 && (
                          <rect
                            x={x}
                            y={CHART_H - gh}
                            width={BAR_W}
                            height={gh}
                            fill={isHov ? C_GOOD : '#6ee7b7'}
                            rx={bH > 0 ? 2 : 3}
                          />
                        )}
                        {/* bad bar (top of stack) */}
                        {bH > 0 && (
                          <rect
                            x={x}
                            y={CHART_H - gh - bH}
                            width={BAR_W}
                            height={bH + (gh > 0 ? 2 : 0)}
                            fill={isHov ? C_BAD : '#fcd34d'}
                            rx={3}
                          />
                        )}
                      </>
                    )}

                    {showLabel && (
                      <text x={x + BAR_W / 2} y={CHART_H + 15} textAnchor="middle" fontSize={9} fill="#a1a1aa">
                        {fmtDate(d.date)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Hover tooltip */}
            {hovItem && hov !== null && (
              <div
                className="pointer-events-none absolute z-20 min-w-[110px] rounded-lg border border-zinc-100 bg-white px-3 py-2 text-xs shadow-lg"
                style={{
                  left: Math.min(bx(hov) - 20, W - 135),
                  top: Math.max(CHART_H - bh(hovItem.good + hovItem.bad) - 90, 4),
                }}
              >
                <p className="mb-1.5 font-medium text-zinc-700">{hovItem.date}</p>
                <div className="space-y-0.5">
                  <TipRow color={C_GOOD} label={t('notesAnalytics.goodLabel')} val={hovItem.good} />
                  <TipRow color={C_BAD}  label={t('notesAnalytics.badLabel')} val={hovItem.bad} />
                </div>
                <p className="mt-1.5 border-t border-zinc-100 pt-1 text-zinc-500">
                  {t('notesAnalytics.total')}<strong>{hovItem.good + hovItem.bad}</strong>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, sub, color }: {
  label: string; value: number; sub: string; color: 'zinc' | 'emerald' | 'amber'
}) {
  const border  = color === 'emerald' ? 'border-emerald-100' : color === 'amber' ? 'border-amber-100' : 'border-zinc-100'
  const valCls  = color === 'emerald' ? 'text-emerald-600'   : color === 'amber' ? 'text-amber-500'   : 'text-zinc-800'
  const subCls  = color === 'emerald' ? 'text-emerald-400'   : color === 'amber' ? 'text-amber-400'   : 'text-zinc-400'
  return (
    <div className={`rounded-xl border ${border} bg-white p-3 shadow-sm`}>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valCls}`}>{value}</p>
      <p className={`text-sm ${subCls}`}>{sub}</p>
    </div>
  )
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-sm text-zinc-500">{label}</span>
    </div>
  )
}

function TipRow({ color, label, val }: { color: string; label: string; val: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-zinc-600">{label}: <strong>{val}</strong></span>
    </div>
  )
}
