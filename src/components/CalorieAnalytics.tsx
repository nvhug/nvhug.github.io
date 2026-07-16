'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const DAILY_GOAL = 2400
const BAR_W = 22
const SLOT = 30
const TOP_PAD = 8
const CHART_H = 120
const LABEL_H = 16
const SVG_H = TOP_PAD + CHART_H + LABEL_H
const Y_AXIS_W = 34   // fixed left panel width
const TICK_STEP = 500

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

function fmtKcal(val: number): string {
  if (val === 0) return '0'
  if (val >= 1000) {
    const k = val / 1000
    return k === Math.floor(k) ? `${k}k` : `${k}k`
  }
  return String(val)
}

type DayData = { date: string; calories: number }

export function CalorieAnalytics() {
  const [allDays, setAllDays] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: rows, error } = await supabase
          .from('daily_foods')
          .select('date, total_calories')
          .order('date', { ascending: true })

        if (error) throw error

        const byDate = new Map<string, number>()
        ;(rows || []).forEach((row: { date: string; total_calories: number }) => {
          byDate.set(row.date, (byDate.get(row.date) || 0) + (row.total_calories || 0))
        })

        const days: DayData[] = [...byDate.entries()]
          .filter(([, cal]) => cal > 0)
          .map(([date, calories]) => ({ date, calories }))
          .sort((a, b) => a.date.localeCompare(b.date))

        setAllDays(days)
      } catch (err) {
        console.error('CalorieAnalytics error:', err)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (scrollRef.current && allDays.length > 0) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [allDays])

  if (loading) return <p className="py-4 text-center text-xs text-zinc-400">Đang tải phân tích...</p>

  const avgCalories = allDays.length > 0
    ? Math.round(allDays.reduce((s, d) => s + d.calories, 0) / allDays.length)
    : 0
  const daysOnGoal = allDays.filter((d) => d.calories >= DAILY_GOAL * 0.85).length
  const bestDay = allDays.reduce(
    (best, d) => (d.calories > best.calories ? d : best),
    { date: '', calories: 0 }
  )

  const maxCalories = Math.max(...allDays.map((d) => d.calories), DAILY_GOAL)
  const maxTick = Math.ceil(maxCalories / TICK_STEP) * TICK_STEP
  const ticks = Array.from({ length: Math.floor(maxTick / TICK_STEP) + 1 }, (_, i) => i * TICK_STEP)
  const svgWidth = Math.max(allDays.length * SLOT + (SLOT - BAR_W), 100)

  const toY = (val: number) => TOP_PAD + CHART_H - (val / maxTick) * CHART_H
  const goalY = toY(DAILY_GOAL)

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-emerald-100 bg-white p-3 text-center shadow-[0_1px_4px_0_rgba(16,185,129,0.06)]">
          <p className="text-xs text-zinc-500">TB / ngày</p>
          <p className="mt-1 text-lg font-semibold leading-none text-emerald-600 sm:text-xl">
            {avgCalories > 0 ? avgCalories.toLocaleString() : '–'}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">kcal</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white p-3 text-center shadow-[0_1px_4px_0_rgba(16,185,129,0.06)]">
          <p className="text-xs text-zinc-500">Đạt mục tiêu</p>
          <p className="mt-1 text-lg font-semibold leading-none text-emerald-600 sm:text-xl">{daysOnGoal}</p>
          <p className="mt-0.5 text-xs text-zinc-400">/ {allDays.length} ngày</p>
        </div>
        <div className="rounded-xl border border-orange-100 bg-white p-3 text-center shadow-[0_1px_4px_0_rgba(234,88,12,0.06)]">
          <p className="text-xs text-zinc-500">Cao nhất</p>
          <p className="mt-1 text-lg font-semibold leading-none text-orange-500 sm:text-xl">
            {bestDay.calories > 0 ? bestDay.calories.toLocaleString() : '–'}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {bestDay.date ? shortDate(bestDay.date) : 'kcal'}
          </p>
        </div>
      </div>

      {/* Column chart */}
      <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-[0_1px_4px_0_rgba(16,185,129,0.06)]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Tất cả ngày ghi nhận
        </p>

        {allDays.length === 0 ? (
          <p className="text-xs italic text-zinc-400">Chưa có dữ liệu.</p>
        ) : (
          <div className="flex">
            {/* Fixed Y-axis */}
            <svg width={Y_AXIS_W} height={SVG_H} className="shrink-0">
              {/* Axis line */}
              <line
                x1={Y_AXIS_W - 1} y1={TOP_PAD}
                x2={Y_AXIS_W - 1} y2={TOP_PAD + CHART_H}
                stroke="#e4e4e7" strokeWidth={1}
              />
              {ticks.map((tick) => {
                const y = toY(tick)
                return (
                  <g key={tick}>
                    <text
                      x={Y_AXIS_W - 5}
                      y={y + 3}
                      textAnchor="end"
                      fontSize={8}
                      fill="#a1a1aa"
                    >
                      {fmtKcal(tick)}
                    </text>
                    <line
                      x1={Y_AXIS_W - 4} y1={y}
                      x2={Y_AXIS_W - 1} y2={y}
                      stroke="#d4d4d8" strokeWidth={1}
                    />
                  </g>
                )
              })}
            </svg>

            {/* Scrollable bars */}
            <div ref={scrollRef} className="overflow-x-auto flex-1">
              <svg width={svgWidth} height={SVG_H} style={{ display: 'block' }}>
                {/* Horizontal grid lines */}
                {ticks.map((tick) => {
                  const y = toY(tick)
                  return (
                    <line
                      key={tick}
                      x1={0} y1={y}
                      x2={svgWidth} y2={y}
                      stroke="#f4f4f5" strokeWidth={1}
                    />
                  )
                })}

                {/* Goal dashed line */}
                <line
                  x1={0} y1={goalY}
                  x2={svgWidth} y2={goalY}
                  stroke="#10b981" strokeWidth={1}
                  strokeDasharray="4 3"
                  opacity={0.5}
                />

                {/* Bars */}
                {allDays.map((day, i) => {
                  const barH = Math.max((day.calories / maxTick) * CHART_H, 2)
                  const x = i * SLOT + (SLOT - BAR_W) / 2
                  const y = TOP_PAD + CHART_H - barH
                  const onGoal = day.calories >= DAILY_GOAL * 0.85
                  return (
                    <g key={day.date}>
                      <rect
                        x={x} y={y}
                        width={BAR_W} height={barH}
                        rx={3}
                        fill={onGoal ? '#10b981' : '#34d399'}
                      />
                      <text
                        x={x + BAR_W / 2}
                        y={TOP_PAD + CHART_H + LABEL_H - 2}
                        textAnchor="middle"
                        fontSize={8}
                        fill="#a1a1aa"
                      >
                        {shortDate(day.date)}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        )}

        <p className="mt-2 text-right text-[11px] text-zinc-400">
          — đường kẻ = mục tiêu {DAILY_GOAL.toLocaleString()} kcal
        </p>
      </div>
    </div>
  )
}
