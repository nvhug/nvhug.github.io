'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Sparkles, RefreshCw, ChevronRight,
  AlertCircle, Lightbulb, History, ChevronDown, ChevronUp,
  Scale, Utensils, BookOpen,
} from 'lucide-react'
import { Note } from '@/types'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Period { label: string; from: string; to: string }

interface PeriodOption extends Period { group: 'month' | 'quarter' }

interface TokenUsage { prompt: number; completion: number; total: number }

interface WeightInsight {
  verdict:     string
  points:      string[]
  next_target: string
}

interface NutritionInsight {
  verdict:    string
  points:     string[]
  worst_day:  string
  skip_habit: string
}

interface NotesHabitsInsight {
  points:    string[]
  habit_gap: string
}

interface AIInsights {
  id?:            string
  summary:        string
  weight?:        WeightInsight
  nutrition?:     NutritionInsight
  notes_habits?:  NotesHabitsInsight
  pattern:        string
  recommendation: string
  analyzedAt:     string
  period?:        Period
  tokenUsage?:    TokenUsage
}

// ─── Period options ───────────────────────────────────────────────────────────

function generatePeriodOptions(): PeriodOption[] {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() // 0-based

  const opts: PeriodOption[] = []

  // Last 12 months
  for (let i = 0; i < 12; i++) {
    const d  = new Date(year, month - i, 1)
    const y  = d.getFullYear()
    const m  = d.getMonth() + 1
    const mm = String(m).padStart(2, '0')
    const lastDay = new Date(y, m, 0).getDate()
    opts.push({
      group: 'month',
      label: `Tháng ${m}/${y}`,
      from:  `${y}-${mm}-01`,
      to:    `${y}-${mm}-${lastDay}`,
    })
  }

  // Last 6 quarters
  const curQ = Math.floor(month / 3) + 1 // 1-based quarter of current month
  for (let i = 0; i < 6; i++) {
    let q = curQ - i
    let y = year
    while (q <= 0) { q += 4; y-- }
    const startM  = (q - 1) * 3 + 1
    const endM    = q * 3
    const lastDay = new Date(y, endM, 0).getDate()
    opts.push({
      group: 'quarter',
      label: `Q${q}/${y}`,
      from:  `${y}-${String(startM).padStart(2, '0')}-01`,
      to:    `${y}-${String(endM).padStart(2, '0')}-${lastDay}`,
    })
  }

  return opts
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmtN(n: number) { return n.toLocaleString('vi-VN') }

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${parseInt(d)}/${parseInt(m)}/${y}`
}

const STRIP_HTML = /<[^>]*>/g

function verdictBadge(verdict: string) {
  if (/Đúng|Đủ/.test(verdict))    return 'bg-emerald-100 text-emerald-700'
  if (/Chậm|Thiếu/.test(verdict)) return 'bg-amber-100 text-amber-700'
  if (/Nhanh|Dư/.test(verdict))   return 'bg-sky-100 text-sky-700'
  return 'bg-zinc-100 text-zinc-500'
}

function rowToInsight(row: {
  id: string
  result: Omit<AIInsights, 'id' | 'analyzedAt' | 'tokenUsage' | 'period'>
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  period_label: string | null
  period_from: string | null
  period_to: string | null
  created_at: string
}): AIInsights {
  return {
    ...row.result,
    id:         row.id,
    analyzedAt: row.created_at,
    period: row.period_label ? {
      label: row.period_label,
      from:  row.period_from ?? '',
      to:    row.period_to   ?? '',
    } : undefined,
    tokenUsage: {
      prompt:     row.prompt_tokens,
      completion: row.completion_tokens,
      total:      row.total_tokens,
    },
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotesAIInsights({ notes, habits }: { notes: Note[]; habits: Note[] }) {
  const periodOptions = useMemo(generatePeriodOptions, [])

  const [selectedIdx,  setSelectedIdx]  = useState(0)
  const [history,      setHistory]      = useState<AIInsights[]>([])
  const [viewIndex,    setViewIndex]    = useState(0)
  const [showHistory,  setShowHistory]  = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [fetching,     setFetching]     = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('ai_analysis_history')
      .select('id, result, prompt_tokens, completion_tokens, total_tokens, period_label, period_from, period_to, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }: { data: Parameters<typeof rowToInsight>[0][] | null }) => {
        if (data?.length) setHistory(data.map(rowToInsight))
      })
      .finally(() => setFetching(false))
  }, [])

  const viewed          = history[viewIndex] ?? null
  const selectedPeriod  = periodOptions[selectedIdx]

  // Notes filtered to the selected period (client-side)
  const filteredNotes = useMemo(
    () => notes.filter(n => n.note_date >= selectedPeriod.from && n.note_date <= selectedPeriod.to),
    [notes, selectedPeriod]
  )

  async function analyze() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/notes/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes:   filteredNotes.map(n => ({ ...n, content: n.content.replace(STRIP_HTML, '').slice(0, 200) })),
          habits:  habits.map(h => ({ ...h, content: h.content.replace(STRIP_HTML, '').slice(0, 100) })),
          period:  selectedPeriod,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Phân tích thất bại')

      const result: AIInsights = data
      setHistory(prev => [result, ...prev].slice(0, 10))
      setViewIndex(0)
      setShowHistory(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi phân tích. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const months   = useMemo(() => periodOptions.filter(o => o.group === 'month'),   [periodOptions])
  const quarters = useMemo(() => periodOptions.filter(o => o.group === 'quarter'), [periodOptions])

  return (
    <div className="space-y-4 p-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period dropdown */}
        <select
          value={selectedIdx}
          onChange={e => setSelectedIdx(Number(e.target.value))}
          disabled={loading}
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-60"
        >
          <optgroup label="Theo tháng">
            {months.map(o => {
              const idx = periodOptions.indexOf(o)
              return <option key={idx} value={idx}>{o.label}</option>
            })}
          </optgroup>
          <optgroup label="Theo quý">
            {quarters.map(o => {
              const idx = periodOptions.indexOf(o)
              return <option key={idx} value={idx}>{o.label}</option>
            })}
          </optgroup>
        </select>

        {/* Note count hint */}
        <span className="text-sm text-zinc-400">
          {filteredNotes.length} notes
        </span>

        {/* Analyze button */}
        <button
          onClick={analyze}
          disabled={loading || fetching || filteredNotes.length === 0}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {loading
            ? <RefreshCw className="h-4 w-4 animate-spin" />
            : <Sparkles className="h-4 w-4" />}
          {loading ? 'Đang phân tích...' : 'Phân tích AI'}
        </button>
      </div>

      {/* Empty period warning */}
      {filteredNotes.length === 0 && !loading && !fetching && (
        <p className="text-center text-sm text-zinc-400">
          Không có dữ liệu ghi chú cho {selectedPeriod.label}.
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {(fetching || (loading && !viewed)) && (
        <div className="animate-pulse space-y-3">
          <div className="h-16 rounded-xl bg-violet-50" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-24 rounded-xl bg-emerald-50" />
            <div className="h-24 rounded-xl bg-amber-50" />
          </div>
          <div className="h-14 rounded-xl bg-blue-50" />
        </div>
      )}

      {/* Result */}
      {viewed && !loading && !fetching && (
        <div className="space-y-3">
          {/* Period badge */}
          {viewed.period && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">
                {viewed.period.label}
              </span>
              <span className="text-sm text-zinc-400">
                {fmtDate(viewed.period.from)} → {fmtDate(viewed.period.to)}
              </span>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
            <p className="text-base leading-relaxed text-violet-900">{viewed.summary}</p>
          </div>

          {/* Domain cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Weight */}
            {viewed.weight && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3.5">
                <div className="mb-2 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-indigo-600" />
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Cân nặng</h4>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${verdictBadge(viewed.weight.verdict)}`}>
                    {viewed.weight.verdict}
                  </span>
                </div>
                <ul className="mb-2.5 space-y-1.5">
                  {viewed.weight.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-indigo-800">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-indigo-400" />{p}
                    </li>
                  ))}
                </ul>
                {viewed.weight.next_target && (
                  <div className="rounded-lg bg-indigo-100/70 px-2.5 py-1.5 text-sm text-indigo-700">
                    <span className="font-medium">Mục tiêu: </span>{viewed.weight.next_target}
                  </div>
                )}
              </div>
            )}

            {/* Nutrition */}
            {viewed.nutrition && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3.5">
                <div className="mb-2 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Utensils className="h-3.5 w-3.5 text-amber-600" />
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-amber-600">Dinh dưỡng</h4>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${verdictBadge(viewed.nutrition.verdict)}`}>
                    {viewed.nutrition.verdict}
                  </span>
                </div>
                <ul className="mb-2.5 space-y-1.5">
                  {viewed.nutrition.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-amber-800">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />{p}
                    </li>
                  ))}
                </ul>
                <div className="space-y-1">
                  {viewed.nutrition.worst_day && (
                    <p className="text-sm text-amber-700">
                      <span className="font-medium">Ngày yếu: </span>{viewed.nutrition.worst_day}
                    </p>
                  )}
                  {viewed.nutrition.skip_habit && (
                    <p className="text-sm text-amber-700">
                      <span className="font-medium">Bỏ bữa: </span>{viewed.nutrition.skip_habit}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notes & Habits */}
            {viewed.notes_habits && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3.5">
                <div className="mb-2 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Ghi chú & Habit</h4>
                </div>
                <ul className="mb-2.5 space-y-1.5">
                  {viewed.notes_habits.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-emerald-800">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />{p}
                    </li>
                  ))}
                </ul>
                {viewed.notes_habits.habit_gap && (
                  <div className="rounded-lg bg-emerald-100/70 px-2.5 py-1.5 text-sm text-emerald-700">
                    <span className="font-medium">Habit gap: </span>{viewed.notes_habits.habit_gap}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pattern + Recommendation */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-blue-600" />
              <h4 className="text-sm font-semibold uppercase tracking-wide text-blue-600">Gợi ý</h4>
            </div>
            <p className="text-base font-medium text-blue-900">{viewed.pattern}</p>
            <p className="mt-2 text-base text-blue-700">{viewed.recommendation}</p>
          </div>

          {/* Token + timestamp footer */}
          {viewed.tokenUsage && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
              <span className="font-medium text-zinc-700">
                🪙 {fmtN(viewed.tokenUsage.total)} tokens
              </span>
              <span className="text-zinc-300">|</span>
              <span>input {fmtN(viewed.tokenUsage.prompt)}</span>
              <span>·</span>
              <span>output {fmtN(viewed.tokenUsage.completion)}</span>
              <span className="ml-auto text-zinc-400">{formatDateTime(viewed.analyzedAt)}</span>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 1 && !fetching && (
        <div className="rounded-xl border border-zinc-100">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-700"
          >
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Lịch sử phân tích ({history.length})
            </div>
            {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showHistory && (
            <div className="border-t border-zinc-100">
              {history.map((item, idx) => (
                <button
                  key={item.id ?? idx}
                  onClick={() => { setViewIndex(idx); setShowHistory(false) }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-zinc-50 ${
                    idx === viewIndex ? 'bg-violet-50' : ''
                  } ${idx < history.length - 1 ? 'border-b border-zinc-50' : ''}`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${idx === viewIndex ? 'bg-violet-500' : 'bg-zinc-300'}`} />

                  {/* Period label */}
                  {item.period ? (
                    <span className={`w-24 shrink-0 font-medium ${idx === viewIndex ? 'text-violet-700' : 'text-zinc-700'}`}>
                      {item.period.label}
                    </span>
                  ) : (
                    <span className="w-24 shrink-0 text-zinc-400">—</span>
                  )}

                  <span className="flex-1 text-zinc-400">{formatDateTime(item.analyzedAt)}</span>

                  {item.tokenUsage && (
                    <span className="text-zinc-400">🪙 {fmtN(item.tokenUsage.total)}</span>
                  )}
                  {idx === viewIndex && (
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-600">đang xem</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
