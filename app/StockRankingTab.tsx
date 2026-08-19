'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import { filterByRange, formatDateTime, pctChangeForRange } from './stockChartUtils'
import { type DailyPricePoint } from './stockTypes'

type StockAnalysisStats = {
  currentPrice: number
  change1M: number | null
  change3M: number | null
  change6M: number | null
  changeYTD: number | null
  change1Y: number | null
  change5Y: number | null
  allTimeHigh: number | null
  allTimeLow: number | null
  distanceFromHighPct: number | null
  avgVolume30d: number | null
  volumeTrendPct: number | null
  volatility30dPct: number | null
  maxDrawdown1YPct: number | null
  positiveDays30Pct: number | null
  positionInAllTimeRangePct: number | null
  high52Week: number | null
  low52Week: number | null
  dataFrom: string
  dataTo: string
}

type CategoryScores = {
  governance: number
  liquidity: number
  valuation: number
  profitability: number
  capitalSafety: number
  assetQuality: number
}

type PeerRanking = {
  ticker: string
  grade: 'A' | 'B' | 'C' | 'D'
  overallScore: number
  scores: CategoryScores
}

type StockAnalysis = {
  grade: 'A' | 'B' | 'C' | 'D'
  overallScore: number
  scores: CategoryScores
  industryScores: CategoryScores
  industryOverallScore: number
  summary: string
  confidence: { score: number; level: 'Cao' | 'Trung bình' | 'Thấp'; rationale: string }
  scoreRationales: Record<keyof CategoryScores, string>
  marketView: {
    trend: 'Tăng' | 'Đi ngang' | 'Giảm'
    momentum: 'Mạnh' | 'Trung tính' | 'Yếu'
    cycle: 'Tích lũy' | 'Tăng giá' | 'Phân phối' | 'Giảm giá'
    relativePosition: string
    volumeSignal: string
    volatilitySignal: string
  }
  investmentThesis: { bullCase: string[]; bearCase: string[]; invalidation: string }
  catalysts: { positive: string[]; negative: string[] }
  scenarios: { name: string; probability: number; priceZone: string; conditions: string[] }[]
  actionPlan: { shortTerm: string; mediumTerm: string; longTerm: string; riskManagement: string[] }
  strengths: string[]
  risks: string[]
  dataQuality: { coverage: string; missing: string[]; reliabilityNote: string }
  recommendation: string
  sectorName: string
  peers: PeerRanking[]
}

const GRADE_STYLES: Record<StockAnalysis['grade'], { bg: string; text: string; ring: string }> = {
  A: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  B: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200' },
  C: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  D: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
}

const GRADE_DESCRIPTIONS: Record<StockAnalysis['grade'], string> = {
  A: 'Tốt — điểm cơ bản cao, các tiêu chí đồng đều, ít rủi ro rõ rệt trong dữ liệu hiện có.',
  B: 'Khá — nhìn chung ổn nhưng có 1-2 tiêu chí yếu hơn mặt bằng ngành, cần theo dõi thêm.',
  C: 'Trung bình — nhiều tiêu chí chỉ ở mức trung tính hoặc thấp hơn ngành, nên cân nhắc kỹ trước khi giải ngân thêm.',
  D: 'Yếu — phần lớn tiêu chí dưới mức trung bình ngành hoặc rủi ro/biến động cao, cần thận trọng.',
}

// Hexagon radar chart: 6 axes clockwise from top. Two series — stock (solid blue) vs industry ref (lighter blue).
function RadarChart({ scores, size = 260 }: { scores: { label: string; value: number; industry: number }[]; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const maxR = size / 2 - 46
  const angleFor = (i: number) => -Math.PI / 2 + i * ((2 * Math.PI) / scores.length)
  const pointFor = (i: number, value: number) => {
    const r = (Math.max(0, Math.min(10, value)) / 10) * maxR
    const angle = angleFor(i)
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }
  const rings = [2.5, 5, 7.5, 10]
  const dataPoints = scores.map((s, i) => pointFor(i, s.value))
  const industryPoints = scores.map((s, i) => pointFor(i, s.industry))

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px]" role="img" aria-label="Biểu đồ radar xếp hạng">
      {rings.map((ring) => (
        <polygon key={ring} points={scores.map((_, i) => { const p = pointFor(i, ring); return `${p.x},${p.y}` }).join(' ')}
          fill="none" stroke="#e4e4e7" strokeWidth="1" />
      ))}
      {scores.map((s, i) => {
        const outer = pointFor(i, 10)
        return <line key={s.label} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="#e4e4e7" strokeWidth="1" />
      })}
      <polygon points={industryPoints.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#93c5fd" strokeWidth="1.5" />
      <polygon points={dataPoints.map((p) => `${p.x},${p.y}`).join(' ')} fill="#3b82f6" fillOpacity="0.18" stroke="#3b82f6" strokeWidth="2" />
      {dataPoints.map((p, i) => <circle key={scores[i].label} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#3b82f6" strokeWidth="2" />)}
      {scores.map((s, i) => {
        const labelPoint = pointFor(i, 12.6)
        const anchor = labelPoint.x < cx - 4 ? 'end' : labelPoint.x > cx + 4 ? 'start' : 'middle'
        const dy = labelPoint.y < cy - 4 ? -2 : labelPoint.y > cy + 4 ? 10 : 4
        return (
          <g key={s.label}>
            <text x={labelPoint.x} y={labelPoint.y + dy - 10} textAnchor={anchor} fontSize="10" fontWeight="700" fill="#3b82f6">
              {s.value.toFixed(1)}
            </text>
            <text x={labelPoint.x} y={labelPoint.y + dy} textAnchor={anchor} fontSize="9" fill="#71717a">
              {s.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function RankingTab({ ticker, company, allPoints, historyMax, historyMin, active, onSelectTicker }: {
  ticker: string
  company: string | null
  allPoints: DailyPricePoint[]
  historyMax: number | null
  historyMin: number | null
  active: boolean
  onSelectTicker: (ticker: string) => void
}) {
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null)
  const [nextAnalyzeAt, setNextAnalyzeAt] = useState<string | null>(null)
  const [canAnalyze, setCanAnalyze] = useState(true)
  const loadedSavedRef = useRef(false)

  const stats = useMemo<StockAnalysisStats | null>(() => {
    if (allPoints.length === 0) return null
    const currentPrice = allPoints.at(-1)!.close
    const recentVolumes = allPoints.slice(-30).map((p) => p.volume).filter((v): v is number => typeof v === 'number')
    const last30 = allPoints.slice(-30)
    const dailyReturns = last30.slice(1).map((point, index) => ((point.close - last30[index].close) / last30[index].close) * 100)
    const averageReturn = dailyReturns.length > 0 ? dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length : 0
    const volatility30dPct = dailyReturns.length > 1
      ? Math.sqrt(dailyReturns.reduce((sum, value) => sum + (value - averageReturn) ** 2, 0) / (dailyReturns.length - 1)) * Math.sqrt(252)
      : null
    const oneYear = filterByRange(allPoints, '1Y')
    let runningHigh = oneYear[0]?.close ?? currentPrice
    let maxDrawdown1YPct = 0
    oneYear.forEach((point) => {
      runningHigh = Math.max(runningHigh, point.close)
      maxDrawdown1YPct = Math.min(maxDrawdown1YPct, ((point.close - runningHigh) / runningHigh) * 100)
    })
    const previousVolumes = allPoints.slice(-30, -10).map((p) => p.volume).filter((v): v is number => typeof v === 'number')
    const latestVolumes = allPoints.slice(-10).map((p) => p.volume).filter((v): v is number => typeof v === 'number')
    const previousVolumeAvg = previousVolumes.length > 0 ? previousVolumes.reduce((a, b) => a + b, 0) / previousVolumes.length : 0
    const latestVolumeAvg = latestVolumes.length > 0 ? latestVolumes.reduce((a, b) => a + b, 0) / latestVolumes.length : 0
    const high52Week = oneYear.length > 0 ? Math.max(...oneYear.map((p) => p.close)) : null
    const low52Week = oneYear.length > 0 ? Math.min(...oneYear.map((p) => p.close)) : null
    return {
      currentPrice,
      change1M: pctChangeForRange(allPoints, '1M'),
      change3M: pctChangeForRange(allPoints, '3M'),
      change6M: pctChangeForRange(allPoints, '6M'),
      changeYTD: pctChangeForRange(allPoints, 'YTD'),
      change1Y: pctChangeForRange(allPoints, '1Y'),
      change5Y: pctChangeForRange(allPoints, '5Y'),
      allTimeHigh: historyMax,
      allTimeLow: historyMin,
      distanceFromHighPct: historyMax ? ((currentPrice - historyMax) / historyMax) * 100 : null,
      avgVolume30d: recentVolumes.length > 0 ? recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length : null,
      volumeTrendPct: previousVolumeAvg > 0 ? ((latestVolumeAvg - previousVolumeAvg) / previousVolumeAvg) * 100 : null,
      volatility30dPct,
      maxDrawdown1YPct: oneYear.length > 1 ? maxDrawdown1YPct : null,
      positiveDays30Pct: dailyReturns.length > 0 ? (dailyReturns.filter((value) => value > 0).length / dailyReturns.length) * 100 : null,
      positionInAllTimeRangePct: historyMax !== null && historyMin !== null && historyMax !== historyMin
        ? ((currentPrice - historyMin) / (historyMax - historyMin)) * 100
        : null,
      high52Week,
      low52Week,
      dataFrom: allPoints[0].date,
      dataTo: allPoints.at(-1)!.date,
    }
  }, [allPoints, historyMax, historyMin])

  const runAnalysis = useCallback(async () => {
    if (!stats) return
    setAnalyzing(true)
    setAnalysisError(null)
    try {
      const res = await fetch('/api/stock-price/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, companyName: company, stats }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.analysis) setAnalysis(data.analysis as StockAnalysis)
        if (data?.nextAnalyzeAt) setNextAnalyzeAt(data.nextAnalyzeAt as string)
        if (typeof data?.canAnalyze === 'boolean') setCanAnalyze(data.canAnalyze)
        throw new Error(data?.error ?? 'Phân tích thất bại')
      }
      setAnalysis(data.analysis as StockAnalysis)
      setAnalyzedAt(data.analyzedAt as string)
      setNextAnalyzeAt(data.nextAnalyzeAt as string)
      setCanAnalyze(data.canAnalyze as boolean)
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Phân tích thất bại')
    } finally {
      setAnalyzing(false)
    }
  }, [stats, ticker, company])

  useEffect(() => {
    if (!active || loadedSavedRef.current) return
    loadedSavedRef.current = true
    let cancelled = false

    async function loadSavedAnalysis() {
      setLoadingSaved(true)
      setAnalysisError(null)
      try {
        const res = await fetch(`/api/stock-price/analyze?ticker=${encodeURIComponent(ticker)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? 'Không tải được phân tích đã lưu')
        if (cancelled) return
        setAnalysis(data.analysis as StockAnalysis | null)
        setAnalyzedAt((data.analyzedAt as string | undefined) ?? null)
        setNextAnalyzeAt((data.nextAnalyzeAt as string | undefined) ?? null)
        setCanAnalyze(data.canAnalyze !== false)
      } catch (err) {
        if (!cancelled) setAnalysisError(err instanceof Error ? err.message : 'Không tải được phân tích đã lưu')
      } finally {
        if (!cancelled) setLoadingSaved(false)
      }
    }

    void loadSavedAnalysis()
    return () => { cancelled = true }
  }, [active, ticker])

  const gradeStyle = analysis ? GRADE_STYLES[analysis.grade] : null
  const radarScores = analysis ? [
    { label: 'Quản trị', value: analysis.scores.governance, industry: analysis.industryScores.governance },
    { label: 'Thanh khoản', value: analysis.scores.liquidity, industry: analysis.industryScores.liquidity },
    { label: 'Định giá', value: analysis.scores.valuation, industry: analysis.industryScores.valuation },
    { label: 'Sinh lợi', value: analysis.scores.profitability, industry: analysis.industryScores.profitability },
    { label: 'An toàn vốn', value: analysis.scores.capitalSafety, industry: analysis.industryScores.capitalSafety },
    { label: 'Chất lượng tài sản', value: analysis.scores.assetQuality, industry: analysis.industryScores.assetQuality },
  ] : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
        <div>
          <p className="font-poppins text-sm font-semibold text-zinc-700">Xếp hạng cơ bản {ticker}</p>
          <p className="mt-0.5 text-[11px] text-zinc-400">AI ước tính từ dữ liệu giá &amp; khối lượng lịch sử — không thay thế báo cáo tài chính chính thức</p>
        </div>
        <button type="button" onClick={runAnalysis} disabled={analyzing || loadingSaved || !stats || !canAnalyze}
          title={!canAnalyze && nextAnalyzeAt ? `Có thể phân tích lại từ ${formatDateTime(nextAnalyzeAt)}` : undefined}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
          {analyzing ? <RefreshCw className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {analyzing
            ? 'Đang phân tích...'
            : !canAnalyze && nextAnalyzeAt
              ? `Mở lại ${new Intl.DateTimeFormat('vi-VN').format(new Date(nextAnalyzeAt))}`
              : analysis ? 'Phân tích lại' : 'Phân tích bằng AI'}
        </button>
      </div>

      {(analyzedAt || nextAnalyzeAt) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
          <span>{analyzedAt ? `Đã phân tích: ${formatDateTime(analyzedAt)}` : ''}</span>
          <span>{canAnalyze ? 'Có thể cập nhật báo cáo' : `Có thể phân tích lại từ ${formatDateTime(nextAnalyzeAt!)}`}</span>
        </div>
      )}

      {analysisError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <AlertCircle className="size-4 shrink-0" /> {analysisError}
        </div>
      )}

      {!analysis && (analyzing || loadingSaved) && (
        <div className="flex h-64 items-center justify-center gap-2 text-xs text-zinc-400">
          <RefreshCw className="size-4 animate-spin" /> {loadingSaved ? `Đang tải phân tích đã lưu của ${ticker}...` : `Đang chấm điểm ${ticker}...`}
        </div>
      )}

      {!analysis && !analyzing && !loadingSaved && !analysisError && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200 py-16 text-center">
          <Sparkles className="size-8 text-zinc-300" />
          <p className="text-sm text-zinc-400">Chưa có báo cáo đã lưu cho {ticker}.</p>
          <button type="button" onClick={runAnalysis} disabled={!stats || !canAnalyze}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            Phân tích bằng AI
          </button>
        </div>
      )}

      {analysis && gradeStyle && (
        <>
          <div className={`flex items-start gap-3 rounded-xl ${gradeStyle.bg} px-4 py-3 ring-1 ${gradeStyle.ring}`}>
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold ${gradeStyle.text} ring-1 ${gradeStyle.ring}`}>
              {analysis.grade}
            </div>
            <p className={`text-xs leading-5 ${gradeStyle.text}`}>{analysis.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
            {[
              ['Khuyến nghị', analysis.recommendation],
              ['Độ tin cậy', `${analysis.confidence.score}/100 · ${analysis.confidence.level}`],
              ['Xu hướng', `${analysis.marketView.trend} · ${analysis.marketView.cycle}`],
              ['Động lượng', analysis.marketView.momentum],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase text-zinc-400">{label}</p>
                <p className="mt-1 text-xs font-bold text-zinc-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-100 px-3 py-2.5">
            <p className="text-xs font-semibold text-zinc-500">Mức tin cậy của báo cáo</p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">{analysis.confidence.rationale}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-100 p-3">
              <RadarChart scores={radarScores} />
              <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500" /> {ticker}</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-200" /> Ngành</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/70">
                    <th className="px-3 py-2 text-left font-semibold text-zinc-500">Tiêu chí</th>
                    <th className="px-3 py-2 text-right font-semibold text-zinc-500">{ticker}</th>
                    <th className="px-3 py-2 text-right font-semibold text-zinc-500">Ngành</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {radarScores.map((s) => (
                    <tr key={s.label}>
                      <td className="px-3 py-2 text-zinc-500">{s.label}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-zinc-800">{s.value.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{s.industry.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-50/70">
                    <td className="px-3 py-2 font-semibold text-zinc-700">Điểm cơ bản</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-zinc-900">{analysis.overallScore.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-zinc-500">{analysis.industryOverallScore.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-2 font-poppins text-sm font-semibold text-zinc-700">Luận giải điểm số</p>
            <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-100 bg-zinc-100 sm:grid-cols-2">
              {([
                ['governance', 'Quản trị'],
                ['liquidity', 'Thanh khoản'],
                ['valuation', 'Định giá'],
                ['profitability', 'Sinh lợi'],
                ['capitalSafety', 'An toàn vốn'],
                ['assetQuality', 'Chất lượng tài sản'],
              ] as const).map(([key, label]) => (
                <div key={key} className="bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-zinc-700">{label}</p>
                    <span className="text-xs font-bold tabular-nums text-blue-600">{analysis.scores[key].toFixed(1)}/10</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-zinc-500">{analysis.scoreRationales[key]}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-poppins text-sm font-semibold text-zinc-700">Trạng thái thị trường</p>
            <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-white">
              {[
                ['Vị trí giá', analysis.marketView.relativePosition],
                ['Dòng tiền', analysis.marketView.volumeSignal],
                ['Biến động & drawdown', analysis.marketView.volatilitySignal],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[150px_1fr]">
                  <p className="text-xs font-semibold text-zinc-500">{label}</p>
                  <p className="text-xs leading-5 text-zinc-700">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
              <p className="mb-1.5 text-xs font-semibold text-emerald-700">Luận điểm tăng giá</p>
              <ul className="space-y-1.5 text-xs leading-5 text-zinc-600">
                {analysis.investmentThesis.bullCase.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50/30 p-3">
              <p className="mb-1.5 text-xs font-semibold text-red-700">Luận điểm giảm giá</p>
              <ul className="space-y-1.5 text-xs leading-5 text-zinc-600">
                {analysis.investmentThesis.bearCase.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-red-100 bg-red-50/40 px-3 py-2.5">
            <p className="text-xs font-semibold text-red-700">Điều kiện vô hiệu luận điểm</p>
            <p className="mt-1 text-xs leading-5 text-zinc-700">{analysis.investmentThesis.invalidation}</p>
          </div>

          <div>
            <p className="mb-2 font-poppins text-sm font-semibold text-zinc-700">Kịch bản định lượng</p>
            <div className="overflow-hidden rounded-xl border border-zinc-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/70">
                    <th className="px-3 py-2 text-left font-semibold text-zinc-500">Kịch bản</th>
                    <th className="px-3 py-2 text-right font-semibold text-zinc-500">Xác suất</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-500">Vùng giá</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-500">Điều kiện xác nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {analysis.scenarios.map((scenario) => (
                    <tr key={scenario.name}>
                      <td className="px-3 py-2 font-semibold text-zinc-700">{scenario.name}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-zinc-800">{scenario.probability}%</td>
                      <td className="px-3 py-2 font-medium text-zinc-700">{scenario.priceZone}</td>
                      <td className="px-3 py-2 text-zinc-500">{scenario.conditions.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-100 p-3">
              <p className="mb-2 text-xs font-semibold text-zinc-700">Catalyst tích cực</p>
              <ul className="space-y-1 text-xs leading-5 text-zinc-600">
                {analysis.catalysts.positive.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-zinc-100 p-3">
              <p className="mb-2 text-xs font-semibold text-zinc-700">Rủi ro kích hoạt</p>
              <ul className="space-y-1 text-xs leading-5 text-zinc-600">
                {analysis.catalysts.negative.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>

          <div>
            <p className="mb-2 font-poppins text-sm font-semibold text-zinc-700">Kế hoạch hành động theo thời hạn</p>
            <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-100 bg-zinc-100 sm:grid-cols-3">
              {[
                ['1–4 tuần', analysis.actionPlan.shortTerm],
                ['3–12 tháng', analysis.actionPlan.mediumTerm],
                ['Trên 1 năm', analysis.actionPlan.longTerm],
              ].map(([label, value]) => (
                <div key={label} className="bg-white p-3">
                  <p className="text-xs font-semibold text-zinc-700">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-xl border border-zinc-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-zinc-700">Quản trị vị thế</p>
              <ul className="mt-1 space-y-1 text-xs leading-5 text-zinc-600">
                {analysis.actionPlan.riskManagement.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
              <p className="mb-1.5 text-xs font-semibold text-emerald-700">Điểm mạnh</p>
              <ul className="space-y-1 text-xs text-zinc-600">
                {analysis.strengths.map((s) => <li key={s}>• {s}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3">
              <p className="mb-1.5 text-xs font-semibold text-amber-700">Rủi ro / giới hạn dữ liệu</p>
              <ul className="space-y-1 text-xs text-zinc-600">
                {analysis.risks.map((s) => <li key={s}>• {s}</li>)}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
            <p className="text-xs font-semibold text-sky-700">Phạm vi &amp; chất lượng dữ liệu</p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">{analysis.dataQuality.coverage}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">{analysis.dataQuality.reliabilityNote}</p>
            <p className="mt-2 text-xs font-semibold text-zinc-600">Còn thiếu để nâng độ tin cậy:</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{analysis.dataQuality.missing.join(' · ')}</p>
          </div>

          {analysis.peers.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-100">
              <div className="border-b border-zinc-100 bg-zinc-50/70 px-3 py-2">
                <p className="font-poppins text-sm font-semibold text-zinc-700">Xếp hạng cổ phiếu ngành {analysis.sectorName}</p>
                <p className="text-[10px] text-zinc-400">AI ước tính tham khảo — không phải dữ liệu thị trường thời gian thực</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="px-2 py-2 text-left font-semibold text-zinc-400">STT</th>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-400">Mã CK</th>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-400">Xếp hạng</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Điểm cơ bản</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">An toàn vốn</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Chất lượng TS</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Quản trị</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Sinh lợi</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Thanh khoản</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Định giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {[...analysis.peers].sort((a, b) => b.overallScore - a.overallScore).map((peer, i) => (
                      <tr key={peer.ticker} className={peer.ticker === ticker ? 'bg-emerald-50/60' : undefined}>
                        <td className="px-2 py-2 text-zinc-400">{i + 1}</td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => onSelectTicker(peer.ticker)}
                            className="font-bold tracking-wide text-emerald-700 underline-offset-2 hover:text-emerald-900 hover:underline">
                            {peer.ticker}
                          </button>
                        </td>
                        <td className={`px-2 py-2 font-semibold ${GRADE_STYLES[peer.grade].text}`}>{peer.grade}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums text-zinc-800">{peer.overallScore.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{peer.scores.capitalSafety.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{peer.scores.assetQuality.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{peer.scores.governance.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{peer.scores.profitability.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{peer.scores.liquidity.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{peer.scores.valuation.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-zinc-100 p-3">
            <p className="mb-2 font-poppins text-sm font-semibold text-zinc-700">Thang xếp hạng A / B / C / D là gì?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(GRADE_STYLES) as StockAnalysis['grade'][]).map((grade) => (
                <div key={grade} className="flex items-start gap-2">
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${GRADE_STYLES[grade].bg} ${GRADE_STYLES[grade].text} ring-1 ${GRADE_STYLES[grade].ring}`}>
                    {grade}
                  </span>
                  <p className="text-[11px] leading-4 text-zinc-500">{GRADE_DESCRIPTIONS[grade]}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-zinc-400">Xếp hạng do AI ước tính dựa trên dữ liệu giá/khối lượng lịch sử, mang tính tham khảo — không phải khuyến nghị đầu tư chính thức.</p>
          </div>
        </>
      )}
    </div>
  )
}
