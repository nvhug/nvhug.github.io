'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import {
  compact, downsample, filterByRange, fmt, formatAxisLabel, formatTooltipDate, pctChangeForRange, smoothPath,
} from './stockChartUtils'
import { RANGE_KEYS, type DailyPricePoint, type PriceData, type RangeKey } from './stockTypes'
import { StatCard } from './StockUiPrimitives'
import { RankingTab } from './StockRankingTab'

const CHART_W = 960
const CHART_H = 340
const PAD_L = 8
const PAD_R = 60
const PAD_T = 16
const PAD_B = 26

export function StockDetailModal({ ticker, company, price, onClose, onSelectTicker }: {
  ticker: string
  company: string | null
  price: PriceData | undefined
  onClose: () => void
  onSelectTicker: (ticker: string) => void
}) {
  const [allPoints, setAllPoints] = useState<DailyPricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [range, setRange] = useState<RangeKey>('ALL')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'chart' | 'ranking'>('chart')
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/stock-price?tickers=${ticker}&history=daily`)
      .then(async (res) => {
        if (!res.ok) throw new Error('history unavailable')
        return await res.json() as { points: DailyPricePoint[] }
      })
      .then((data) => {
        if (!cancelled) setAllPoints(data.points ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [ticker])

  const filteredPoints = useMemo(() => filterByRange(allPoints, range), [allPoints, range])
  const displayPoints = useMemo(() => downsample(filteredPoints, 400), [filteredPoints])

  const chart = useMemo(() => {
    if (displayPoints.length === 0) return null
    const values = displayPoints.map((p) => p.close)
    let min = Math.min(...values)
    let max = Math.max(...values)
    if (min === max) { min -= 1; max += 1 }
    const pad = (max - min) * 0.1
    min -= pad
    max += pad
    const innerW = CHART_W - PAD_L - PAD_R
    const innerH = CHART_H - PAD_T - PAD_B
    const getX = (i: number) => PAD_L + (i / Math.max(displayPoints.length - 1, 1)) * innerW
    const getY = (v: number) => PAD_T + innerH - ((v - min) / (max - min)) * innerH
    const coords = displayPoints.map((p, i) => ({ ...p, x: getX(i), y: getY(p.close) }))
    const up = coords.at(-1)!.close >= coords[0].close
    const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3)
    return { coords, min, max, innerW, innerH, up, ticks }
  }, [displayPoints])

  const linePath = useMemo(() => chart ? smoothPath(chart.coords) : '', [chart])
  const areaPath = useMemo(() => {
    if (!chart) return ''
    const baseline = PAD_T + chart.innerH
    const first = chart.coords[0]
    const last = chart.coords.at(-1)!
    return `${linePath} L${last.x},${baseline} L${first.x},${baseline} Z`
  }, [chart, linePath])

  const axisLabelIdx = useMemo(() => {
    if (!chart || chart.coords.length === 0) return []
    const count = Math.min(6, chart.coords.length)
    if (count <= 1) return [0]
    const idxs = new Set<number>()
    for (let i = 0; i < count; i++) idxs.add(Math.round((i / (count - 1)) * (chart.coords.length - 1)))
    return [...idxs]
  }, [chart])

  const trendColor = chart?.up ? '#059669' : '#e11d48'
  const gradientId = `stock-chart-gradient-${ticker}`

  function updateHoverFromClientX(clientX: number) {
    if (!chart || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = CHART_W / rect.width
    const x = (clientX - rect.left) * scaleX
    const ratio = Math.min(Math.max((x - PAD_L) / chart.innerW, 0), 1)
    setHoverIdx(Math.round(ratio * (chart.coords.length - 1)))
  }

  const hoverPoint = hoverIdx !== null ? chart?.coords[hoverIdx] : undefined
  const rangeStart = chart?.coords[0]
  const hoverPct = hoverPoint && rangeStart && rangeStart.close !== 0
    ? ((hoverPoint.close - rangeStart.close) / rangeStart.close) * 100
    : null

  // Watchlist/suggestion clicks don't carry a live price entry — derive one from history instead.
  const historyPrice = useMemo<PriceData | undefined>(() => {
    if (allPoints.length === 0) return undefined
    const last = allPoints.at(-1)!
    const prev = allPoints.length > 1 ? allPoints.at(-2)! : last
    const change = last.close - prev.close
    return {
      close: last.close,
      change,
      pct_change: prev.close !== 0 ? (change / prev.close) * 100 : 0,
      date: last.date,
      volume: last.volume,
      high: last.high,
      low: last.low,
    }
  }, [allPoints])
  const effectivePrice = price ?? historyPrice

  const latest = allPoints.at(-1)
  const first = allPoints[0]
  const historyMin = allPoints.length > 0 ? Math.min(...allPoints.map((p) => p.close)) : null
  const historyMax = allPoints.length > 0 ? Math.max(...allPoints.map((p) => p.close)) : null
  const totalChange = first && latest && first.close !== 0 ? ((latest.close - first.close) / first.close) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-20 flex items-start justify-between border-b border-zinc-100 bg-white px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-poppins text-lg font-semibold text-zinc-900">{ticker}</h3>
              {effectivePrice && <span className={`text-xs font-semibold ${effectivePrice.pct_change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{effectivePrice.pct_change >= 0 ? '+' : ''}{effectivePrice.pct_change.toFixed(2)}%</span>}
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">{company ?? 'Lịch sử giá'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100" aria-label="Đóng chi tiết">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-1 border-b border-zinc-100 pb-2">
            {(['chart', 'ranking'] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === tab ? 'bg-emerald-100 text-emerald-700' : 'text-zinc-500 hover:bg-zinc-50'}`}>
                {tab === 'chart' ? 'Biểu đồ' : 'Xếp hạng'}
              </button>
            ))}
          </div>

          {activeTab === 'chart' && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Giá hiện tại" value={effectivePrice ? fmt(effectivePrice.close) : '—'} sub="VNĐ" accent="text-zinc-900" />
                <StatCard label="Giá cao nhất" value={historyMax !== null ? fmt(historyMax) : '—'} sub={first ? `từ ${first.date.slice(0, 4)}` : 'Đang tải'} accent="text-emerald-600" />
                <StatCard label="Giá thấp nhất" value={historyMin !== null ? fmt(historyMin) : '—'} sub={first ? `từ ${first.date.slice(0, 4)}` : 'Đang tải'} accent="text-red-500" />
                <StatCard label="Tăng từ đầu kỳ" value={first && latest ? `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)}%` : '—'} sub={first && latest ? `${first.date.slice(0, 4)} → ${latest.date.slice(0, 4)}` : 'Đang tải'} accent={totalChange >= 0 ? 'text-emerald-600' : 'text-red-500'} />
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                {loading ? (
                  <div className="flex h-80 items-center justify-center text-xs text-zinc-400"><RefreshCw className="mr-2 size-4 animate-spin" /> Đang tải lịch sử...</div>
                ) : error || !chart ? (
                  <div className="flex h-80 items-center justify-center text-xs text-amber-700">Không tải được lịch sử giá của mã này.</div>
                ) : (
                  <>
                    <div className="relative select-none">
                      <svg ref={svgRef} viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-80 w-full touch-none"
                        role="img" aria-label={`Biểu đồ giá ${ticker}`}
                        onMouseMove={(e) => updateHoverFromClientX(e.clientX)}
                        onMouseLeave={() => setHoverIdx(null)}
                        onTouchMove={(e) => { if (e.touches[0]) updateHoverFromClientX(e.touches[0].clientX) }}
                        onTouchEnd={() => setHoverIdx(null)}>
                        <defs>
                          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={trendColor} stopOpacity="0.35" />
                            <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {chart.ticks.map((tick, i) => {
                          const y = PAD_T + chart.innerH - ((tick - chart.min) / (chart.max - chart.min)) * chart.innerH
                          return (
                            <g key={i}>
                              <line x1={PAD_L} y1={y} x2={CHART_W - PAD_R} y2={y} stroke="#d1fae5" strokeDasharray="3 3" />
                              <text x={CHART_W - PAD_R + 6} y={y + 3} fontSize="9" fill="#a1a1aa">{compact(tick)}</text>
                            </g>
                          )
                        })}

                        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
                        <path d={linePath} fill="none" stroke={trendColor} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />

                        {axisLabelIdx.map((i) => (
                          <text key={i} x={chart.coords[i].x} y={CHART_H - 6} textAnchor="middle" fontSize="9" fill="#a1a1aa">
                            {formatAxisLabel(chart.coords[i].date, range)}
                          </text>
                        ))}

                        {hoverPoint && (
                          <g>
                            <line x1={hoverPoint.x} y1={PAD_T} x2={hoverPoint.x} y2={PAD_T + chart.innerH} stroke="#a1a1aa" strokeDasharray="3 3" />
                            <line x1={PAD_L} y1={hoverPoint.y} x2={CHART_W - PAD_R} y2={hoverPoint.y} stroke="#a1a1aa" strokeDasharray="3 3" />
                            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="4.5" fill="#fff" stroke={trendColor} strokeWidth="2.5" />
                            <text x={CHART_W - PAD_R + 6} y={hoverPoint.y + 3} fontSize="9" fontWeight="700" fill={trendColor}>{compact(hoverPoint.close)}</text>
                          </g>
                        )}
                      </svg>

                      {hoverPoint && (
                        <div className="pointer-events-none absolute top-1 z-10 w-40 rounded-lg border border-zinc-200 bg-white/95 p-2.5 shadow-lg backdrop-blur-sm"
                          style={{ left: `clamp(0px, ${(hoverPoint.x / CHART_W) * 100}%, calc(100% - 10rem))` }}>
                          <p className="text-[11px] font-bold text-zinc-800">{ticker}</p>
                          <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{fmt(hoverPoint.close)}</p>
                          {hoverPct !== null && (
                            <p className={`text-[10px] font-semibold tabular-nums ${hoverPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {hoverPct >= 0 ? '▲' : '▼'} {Math.abs(hoverPct).toFixed(2)}%
                            </p>
                          )}
                          {typeof hoverPoint.volume === 'number' && (
                            <p className="mt-1 text-[10px] text-zinc-400">Khối lượng: {compact(hoverPoint.volume)}</p>
                          )}
                          <p className="text-[10px] text-zinc-400">{formatTooltipDate(hoverPoint.date)}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-4 gap-1 border-t border-emerald-100 pt-2 sm:grid-cols-8">
                      {RANGE_KEYS.map((key) => {
                        const pct = pctChangeForRange(allPoints, key)
                        const active = range === key
                        return (
                          <button key={key} type="button" onClick={() => setRange(key)}
                            className={`rounded-md px-1.5 py-1 text-center transition-colors ${active ? 'bg-emerald-100' : 'hover:bg-zinc-50'}`}>
                            <p className={`text-[11px] font-semibold ${active ? 'text-emerald-700' : 'text-zinc-600'}`}>{key}</p>
                            <p className={`text-[10px] font-medium tabular-nums ${pct === null ? 'text-zinc-300' : pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          <div className={activeTab === 'ranking' ? '' : 'hidden'}>
            <RankingTab ticker={ticker} company={company} allPoints={allPoints} historyMax={historyMax} historyMin={historyMin} active={activeTab === 'ranking'} onSelectTicker={onSelectTicker} />
          </div>
        </div>
      </div>
    </div>
  )
}
