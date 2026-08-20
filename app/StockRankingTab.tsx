'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import { filterByRange, formatDateTime, pctChangeForRange } from './stockChartUtils'
import { type DailyPricePoint } from './stockTypes'
import { AITrialExhaustedModal, type AITrialExhaustedInfo } from '@/components/ui/ai-trial-exhausted-modal'

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
  liquidity: number | null
  valuation: number | null
  profitability: number | null
  capitalSafety: number | null
  assetQuality: number | null
}

type PeerRanking = {
  ticker: string
  grade: 'A' | 'B' | 'C' | 'D'
  overallScore: number
  scores: CategoryScores
}

type StockAnalysis = {
  grade: 'A' | 'B' | 'C' | 'D'
  overallScore: number | null
  scores: CategoryScores
  industryScores: CategoryScores
  industryOverallScore: number | null
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
  fundamentals?: {
    source: 'Vietcap'
    reportPeriod: string
    pe: number | null
    pb: number | null
    roePct: number | null
    roaPct: number | null
    nimPct: number | null
    nplPct: number | null
    assetQualityScore: number | null
  }
  governanceDisclosures?: {
    source: 'Vietstock'
    documents: { title: string; url: string; publishedAt: string | null }[]
  }
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

export function RankingTab({ ticker, company, allPoints, historyMax, historyMin, active, onSelectTicker }: {
  ticker: string
  company: string | null
  allPoints: DailyPricePoint[]
  historyMax: number | null
  historyMin: number | null
  active: boolean
  onSelectTicker: (ticker: string) => void
}) {
  const [trialExhausted, setTrialExhausted] = useState<AITrialExhaustedInfo | null>(null)
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
        if (res.status === 402 && data?.trialExhausted) {
          setTrialExhausted({ feature: data.feature, used: data.used, limit: data.limit })
          return
        }
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
  const formatScore = (value: number | null) => value == null ? 'N/A' : value.toFixed(1)
  const scoreEntries = [
    ['liquidity', 'Thanh khoản'],
    ['valuation', 'Định giá'],
    ['profitability', 'Sinh lợi'],
    ['capitalSafety', 'An toàn vốn'],
    ['assetQuality', 'Chất lượng tài sản'],
  ] as const

  return (
    <>
    <AITrialExhaustedModal
      open={!!trialExhausted}
      info={trialExhausted}
      onClose={() => setTrialExhausted(null)}
    />
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
        <div>
          <p className="font-poppins text-sm font-semibold text-zinc-700">Xếp hạng cơ bản {ticker}</p>
          <p className="mt-0.5 text-[11px] text-zinc-400">Chỉ hiển thị các tiêu chí có dữ liệu quan sát được; các chỉ số tài chính/giao dịch không có nguồn chứng thực sẽ là N/A.</p>
        </div>
        {(canAnalyze || analyzing) && (
          <button type="button" onClick={runAnalysis} disabled={analyzing || loadingSaved || !stats}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            {analyzing ? <RefreshCw className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {analyzing ? 'Đang phân tích...' : analysis ? 'Phân tích lại' : 'Phân tích bằng AI'}
          </button>
        )}
      </div>

      {analyzedAt && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
          <span>Đã phân tích: {formatDateTime(analyzedAt)}</span>
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
          {canAnalyze && (
            <button type="button" onClick={runAnalysis} disabled={!stats}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              Phân tích bằng AI
            </button>
          )}
        </div>
      )}

      {analysis && gradeStyle && (
        <>
          <div className={`rounded-xl ${gradeStyle.bg} px-4 py-4 ring-1 ${gradeStyle.ring}`}>
            <div className="flex items-center gap-4">
              <div className={`flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl font-bold ${gradeStyle.text} ring-2 ${gradeStyle.ring} shadow-sm`}>
                {analysis.grade}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold tabular-nums ${gradeStyle.text}`}>{formatScore(analysis.overallScore)}</span>
                  <span className={`text-sm font-medium opacity-60 ${gradeStyle.text}`}>/10</span>
                </div>
                <p className={`mt-1 text-xs leading-5 ${gradeStyle.text}`}>{analysis.summary}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
            <div className="bg-white px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase text-zinc-400">Khuyến nghị</p>
              <p className="mt-1 text-xs font-bold text-zinc-800">{analysis.recommendation}</p>
            </div>
            <div className="bg-white px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase text-zinc-400">Độ tin cậy</p>
              <p className={`mt-1 text-xs font-bold tabular-nums ${analysis.confidence.level === 'Cao' ? 'text-emerald-700' : analysis.confidence.level === 'Trung bình' ? 'text-amber-700' : 'text-red-600'}`}>
                {analysis.confidence.score}/100 · {analysis.confidence.level}
              </p>
            </div>
            <div className="bg-white px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase text-zinc-400">Xu hướng</p>
              <p className={`mt-1 text-xs font-bold ${analysis.marketView.trend === 'Tăng' ? 'text-emerald-700' : analysis.marketView.trend === 'Giảm' ? 'text-red-600' : 'text-zinc-600'}`}>
                {analysis.marketView.trend} · {analysis.marketView.cycle}
              </p>
            </div>
            <div className="bg-white px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase text-zinc-400">Động lượng</p>
              <p className={`mt-1 text-xs font-bold ${analysis.marketView.momentum === 'Mạnh' ? 'text-emerald-700' : analysis.marketView.momentum === 'Yếu' ? 'text-red-600' : 'text-zinc-600'}`}>
                {analysis.marketView.momentum}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-100 px-3 py-2.5">
            <p className="text-xs font-semibold text-zinc-500">Mức tin cậy của báo cáo</p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">{analysis.confidence.rationale}</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/70">
                    <th className="px-3 py-2 text-left font-semibold text-zinc-500">Tiêu chí</th>
                    <th className="px-3 py-2 text-right font-semibold text-zinc-500">{ticker}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {scoreEntries.map(([key, label]) => (
                      <tr key={key}>
                        <td className="px-3 py-2 text-zinc-500">{label}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-zinc-800">{formatScore(analysis?.scores[key] ?? null)}</td>
                      </tr>
                  ))}
                  <tr className="bg-zinc-50/70">
                    <td className="px-3 py-2 font-semibold text-zinc-700">Điểm tổng hợp dữ liệu hiện có</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-zinc-900">{formatScore(analysis.overallScore)}</td>
                  </tr>
                </tbody>
              </table>
          </div>

          <div>
            <p className="mb-2 border-l-2 border-blue-400 pl-2 font-poppins text-sm font-semibold text-zinc-700">Luận giải điểm số</p>
            <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-100 bg-zinc-100 sm:grid-cols-2">
              {scoreEntries.map(([key, label]) => {
                const value = analysis.scores[key]
                return (
                  <div key={key} className="bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-zinc-700">{label}</p>
                      <span className="text-xs font-bold tabular-nums text-blue-600">{value == null ? 'N/A' : `${value.toFixed(1)}/10`}</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(value ?? 0) * 10}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">{value == null ? 'Dữ liệu tài chính chính thức chưa đủ để chấm điểm trung thực.' : analysis.scoreRationales[key]}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 border-l-2 border-blue-400 pl-2 font-poppins text-sm font-semibold text-zinc-700">Trạng thái thị trường</p>
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
            <p className="mb-2 border-l-2 border-blue-400 pl-2 font-poppins text-sm font-semibold text-zinc-700">Kịch bản định lượng</p>
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
            <p className="mb-2 border-l-2 border-blue-400 pl-2 font-poppins text-sm font-semibold text-zinc-700">Kế hoạch hành động theo thời hạn</p>
            <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-100 bg-zinc-100 sm:grid-cols-3">
              {([
                { label: '1–4 tuần', value: analysis.actionPlan.shortTerm, dot: 'bg-blue-400' },
                { label: '3–12 tháng', value: analysis.actionPlan.mediumTerm, dot: 'bg-amber-400' },
                { label: 'Trên 1 năm', value: analysis.actionPlan.longTerm, dot: 'bg-emerald-400' },
              ]).map(({ label, value, dot }) => (
                <div key={label} className="bg-white p-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${dot}`} />
                    <p className="text-xs font-semibold text-zinc-700">{label}</p>
                  </div>
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

          {analysis.fundamentals && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <p className="text-xs font-semibold text-emerald-800">Số liệu cơ bản đã xác minh</p>
                <p className="text-[10px] text-emerald-700">Nguồn {analysis.fundamentals.source} · {analysis.fundamentals.reportPeriod}</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                {[
                  ['P/E', analysis.fundamentals.pe, 'x'],
                  ['P/B', analysis.fundamentals.pb, 'x'],
                  ['ROE', analysis.fundamentals.roePct, '%'],
                  ['ROA', analysis.fundamentals.roaPct, '%'],
                  ['NIM', analysis.fundamentals.nimPct, '%'],
                  ['NPL', analysis.fundamentals.nplPct, '%'],
                ].map(([label, value, suffix]) => (
                  <p key={label as string} className="text-zinc-600"><span className="text-zinc-400">{label}: </span><span className="font-semibold tabular-nums text-zinc-800">{typeof value === 'number' ? `${value.toFixed(2)}${suffix}` : 'N/A'}</span></p>
                ))}
              </div>
            </div>
          )}

          {analysis.governanceDisclosures && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <p className="text-xs font-semibold text-blue-800">Tài liệu quản trị đã xác minh</p>
                <p className="text-[10px] text-blue-700">Nguồn {analysis.governanceDisclosures.source}</p>
              </div>
              <ul className="mt-2 space-y-1.5">
                {analysis.governanceDisclosures.documents.map((document) => (
                  <li key={document.url} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
                    <a href={document.url} target="_blank" rel="noreferrer" className="min-w-0 text-blue-700 underline-offset-2 hover:underline">{document.title}</a>
                    {document.publishedAt && <span className="shrink-0 text-[10px] text-zinc-400">{formatDateTime(document.publishedAt)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.peers.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-100">
              <div className="border-b border-zinc-100 bg-zinc-50/70 px-3 py-2">
                <p className="border-l-2 border-blue-400 pl-2 font-poppins text-sm font-semibold text-zinc-700">Xếp hạng cổ phiếu ngành {analysis.sectorName}</p>
                <p className="text-[10px] text-zinc-400">AI ước tính tham khảo — không phải dữ liệu thị trường thời gian thực</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-160 text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="px-2 py-2 text-left font-semibold text-zinc-400">STT</th>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-400">Mã CK</th>
                      <th className="px-2 py-2 text-left font-semibold text-zinc-400">Xếp hạng</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Điểm cơ bản</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">An toàn vốn</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Chất lượng TS</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Sinh lợi</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Thanh khoản</th>
                      <th className="px-2 py-2 text-right font-semibold text-zinc-400">Định giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {[...analysis.peers].sort((a, b) => b.overallScore - a.overallScore).map((peer, i) => (
                      <tr key={peer.ticker} className={peer.ticker === ticker ? 'bg-emerald-50 font-medium' : 'hover:bg-zinc-50/60'}>
                        <td className="px-2 py-2 text-zinc-400">{i + 1}</td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => onSelectTicker(peer.ticker)}
                            className="font-bold tracking-wide text-emerald-700 underline-offset-2 hover:text-emerald-900 hover:underline">
                            {peer.ticker}
                          </button>
                        </td>
                        <td className={`px-2 py-2 font-semibold ${GRADE_STYLES[peer.grade].text}`}>{peer.grade}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums text-zinc-800">{peer.overallScore.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{formatScore(peer.scores.capitalSafety)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{formatScore(peer.scores.assetQuality)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{formatScore(peer.scores.profitability)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{formatScore(peer.scores.liquidity)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-zinc-600">{formatScore(peer.scores.valuation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-zinc-100 p-3">
            <p className="mb-2 border-l-2 border-zinc-300 pl-2 font-poppins text-sm font-semibold text-zinc-500">Thang xếp hạng A / B / C / D là gì?</p>
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
    </>
  )
}
