'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Sparkles, RefreshCw, ChevronRight,
  AlertCircle, Info, Lightbulb, History, ChevronDown, ChevronUp,
  Scale, Utensils, BookOpen, Crown, X, Dumbbell, CalendarDays, Activity, Target,
} from 'lucide-react'
import { Note } from '@/types'
import { useLanguage } from '@/lib/i18n/language-context'
import { getIntlLocale } from '@/lib/i18n/locale'
import type { Lang } from '@/lib/i18n/language-context'
import { useFeatureAccess } from '@/lib/useFeatureAccess'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useUserRole } from '@/lib/useUserRole'
import { AITrialExhaustedModal, type AITrialExhaustedInfo } from '@/components/ui/ai-trial-exhausted-modal'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

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
  macro_avg?: string | null
}

interface GymInsight {
  verdict:          string
  points:           string[]
  strongest_muscle: string
  next_challenge:   string
}

interface CalendarInsight {
  verdict:      string
  points:       string[]
  busiest_day:  string
  tip:          string
}

interface DigestiveInsight {
  verdict: string
  points:  string[]
  tip:     string
}

interface GoalsInsight {
  verdict: string
  points:  string[]
  focus:   string
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
  gym?:           GymInsight
  calendar?:      CalendarInsight
  digestive?:     DigestiveInsight
  goals?:         GoalsInsight
  notes_habits?:  NotesHabitsInsight
  pattern:        string
  recommendation: string
  analyzedAt:     string
  period?:        Period
  tokenUsage?:    TokenUsage
}

// ─── Period options ───────────────────────────────────────────────────────────

function generatePeriodOptions(t: (key: string, vars?: Record<string, string | number>) => string): PeriodOption[] {
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
      label: t('notesAIInsights.monthLabel', { m, y }),
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
      label: t('notesAIInsights.quarterLabel', { q, y }),
      from:  `${y}-${String(startM).padStart(2, '0')}-01`,
      to:    `${y}-${String(endM).padStart(2, '0')}-${lastDay}`,
    })
  }

  return opts
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string, lang: Lang) {
  return new Date(iso).toLocaleString(getIntlLocale(lang), {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmtN(n: number, lang: Lang) { return n.toLocaleString(getIntlLocale(lang)) }

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${parseInt(d)}/${parseInt(m)}/${y}`
}

const STRIP_HTML = /<[^>]*>/g
const ANALYZE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const MIN_NOTES_REQUIRED = 5
function getCooldownInfo(lastAnalyzedAt?: string | null) {
  if (!lastAnalyzedAt) {
    return { isBlocked: false, remainingMs: 0 }
  }

  const last = new Date(lastAnalyzedAt).getTime()
  if (Number.isNaN(last)) {
    return { isBlocked: false, remainingMs: 0 }
  }

  const remainingMs = last + ANALYZE_COOLDOWN_MS - Date.now()
  return {
    isBlocked: remainingMs > 0,
    remainingMs: Math.max(0, remainingMs),
  }
}

function formatRemainingCooldown(ms: number, t: (key: string, vars?: Record<string, string | number>) => string) {
  const totalHours = Math.ceil(ms / (60 * 60 * 1000))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  if (days <= 0) {
    return t('notesAIInsights.hoursRemaining', { h: hours })
  }

  if (hours === 0) {
    return t('notesAIInsights.daysRemaining', { d: days })
  }

  return t('notesAIInsights.daysHoursRemaining', { d: days, h: hours })
}

function verdictBadge(verdict: string) {
  // positive verdicts → green
  if (/Đúng|Đủ|Bình thường|Đều đặn|Đang tốt|Lập lịch tốt|Khỏe mạnh|On track|Sufficient|Consistent|Well scheduled|Healthy/i.test(verdict))
    return 'bg-emerald-100 text-emerald-700'
  // warning / under-performing → amber
  if (/Chậm|Thiếu|Chưa đều|Cần chú ý|Cần tập trung|Ít sử dụng|Too slow|deficit|Inconsistent|Lightly used|Needs attention|Needs focus/i.test(verdict))
    return 'bg-amber-100 text-amber-700'
  // over-performing or just started → sky/blue
  if (/Nhanh|Dư|Mới bắt đầu|Too fast|surplus|Getting started/i.test(verdict))
    return 'bg-sky-100 text-sky-700'
  // no data / not used → zinc
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
  const { t, lang } = useLanguage()
  const { allowed: canUseAI } = useFeatureAccess('notes.ai_analysis')
  const { role } = useUserRole()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const periodOptions = useMemo(() => generatePeriodOptions(t), [lang])

  const [selectedIdx,  setSelectedIdx]  = useState(0)
  const [history,      setHistory]      = useState<AIInsights[]>([])
  const [viewIndex,    setViewIndex]    = useState(0)
  const [showHistory,  setShowHistory]  = useState(false)
  const [loading,          setLoading]          = useState(false)
  const [fetching,         setFetching]         = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [cooldownInfo,     setCooldownInfo]     = useState<string | null>(null)
  const [trialExhausted,   setTrialExhausted]   = useState<AITrialExhaustedInfo | null>(null)
  const [showDonateModal,  setShowDonateModal]  = useState(false)
  const [donating,         setDonating]         = useState(false)
  const [donated,          setDonated]          = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
      if (!user) { setFetching(false); return }
      const { data } = await getSupabaseBrowserClient()
        .from('ai_analysis_history')
        .select('id, result, prompt_tokens, completion_tokens, total_tokens, period_label, period_from, period_to, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data?.length) setHistory((data as Parameters<typeof rowToInsight>[0][]).map(rowToInsight))
      setFetching(false)
    }
    void load()
  }, [])

  const viewed          = history[viewIndex] ?? null
  const selectedPeriod  = periodOptions[selectedIdx]
  const latestAnalysis  = history[0] ?? null
  const cooldown        = getCooldownInfo(latestAnalysis?.analyzedAt)
  const cooldownLabel   = cooldown.isBlocked ? formatRemainingCooldown(cooldown.remainingMs, t) : ''

  // Notes filtered to the selected period (client-side)
  const filteredNotes = useMemo(
    () => notes.filter(n => n.note_date >= selectedPeriod.from && n.note_date <= selectedPeriod.to),
    [notes, selectedPeriod]
  )

  // Total data items available for analysis (notes in period + all habits)
  const totalItems = filteredNotes.length + habits.length
  const notEnoughData = totalItems < MIN_NOTES_REQUIRED
  const [showDataHint, setShowDataHint] = useState(false)
  const dataHintMessage = totalItems === 0
    ? t('notesAIInsights.noDataForPeriod', { period: selectedPeriod.label })
    : t('notesAIInsights.minNotesHint', { min: MIN_NOTES_REQUIRED, n: totalItems })

  function handleAnalyzeClick() {
    if (!canUseAI) {
      setShowDonateModal(true)
      return
    }
    void analyze()
  }

  async function handleDonateConfirm() {
    setDonating(true)
    let succeeded = false
    try {
      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
      const res = await fetch('/api/donate-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName:  user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '',
          userEmail: user?.email ?? '',
          ts: new Date().toLocaleString('vi-VN'),
        }),
      })
      succeeded = res.ok
    } finally {
      setDonating(false)
      setDonated(true)
      if (succeeded) setTimeout(() => window.location.reload(), 2000)
    }
  }

  async function analyze() {
    if (role !== 'admin' && cooldown.isBlocked) {
      setCooldownInfo(t('notesAIInsights.cooldownHint', { cooldown: cooldownLabel }))
      return
    }

    setLoading(true)
    setError(null)
    setCooldownInfo(null)
    try {
      const res = await fetch('/api/notes/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes:   filteredNotes.map(n => ({ ...n, content: n.content.replace(STRIP_HTML, '').slice(0, 200) })),
          habits:  habits.map(h => ({ ...h, content: h.content.replace(STRIP_HTML, '').slice(0, 100) })),
          period:  selectedPeriod,
          lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402 && data?.trialExhausted) {
          setTrialExhausted({ feature: data.feature, used: data.used, limit: data.limit })
          return
        }
        throw new Error(data.error ?? t('notesAIInsights.analyzeFailed'))
      }

      const result: AIInsights = data
      setHistory(prev => [result, ...prev].slice(0, 10))
      setViewIndex(0)
      setShowHistory(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('notesAIInsights.analyzeError'))
    } finally {
      setLoading(false)
    }
  }

  const months   = useMemo(() => periodOptions.filter(o => o.group === 'month'),   [periodOptions])
  const quarters = useMemo(() => periodOptions.filter(o => o.group === 'quarter'), [periodOptions])

  return (
    <>
    <AITrialExhaustedModal
      open={!!trialExhausted}
      info={trialExhausted}
      onClose={() => setTrialExhausted(null)}
    />
    <div className="space-y-3 p-3">
      {/* Controls row */}
      <div className="rounded-xl border border-zinc-100 bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-2">
        {/* Period dropdown */}
        <select
          value={selectedIdx}
          onChange={e => setSelectedIdx(Number(e.target.value))}
          disabled={loading}
          className="min-w-45 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-60"
        >
          <optgroup label={t('notesAIInsights.byMonth')}>
            {months.map(o => {
              const idx = periodOptions.indexOf(o)
              return <option key={idx} value={idx}>{o.label}</option>
            })}
          </optgroup>
          <optgroup label={t('notesAIInsights.byQuarter')}>
            {quarters.map(o => {
              const idx = periodOptions.indexOf(o)
              return <option key={idx} value={idx}>{o.label}</option>
            })}
          </optgroup>
        </select>

        {/* Note count hint */}
        <span className="rounded-md bg-zinc-50 px-2 py-1 text-xs text-zinc-500">
          {t('notesAIInsights.notesCount', { n: totalItems })}
          {' '}
          <span className="text-zinc-400">(+ cân, gym, lịch)</span>
        </span>

        <Tooltip open={notEnoughData && showDataHint} onOpenChange={setShowDataHint}>
          <TooltipTrigger
            render={
              <button
                onClick={() => {
                  if (notEnoughData) { setShowDataHint(true); return }
                  handleAnalyzeClick()
                }}
                disabled={loading || fetching}
                aria-disabled={notEnoughData}
                className={cn(
                  'ml-auto flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60',
                  notEnoughData && 'cursor-not-allowed opacity-60 hover:bg-violet-600'
                )}
              >
                {loading
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />}
                {loading ? t('notesAIInsights.analyzing') : t('notesAIInsights.analyzeAI')}
                {!canUseAI && <Crown className="h-3.5 w-3.5 text-amber-300" />}
              </button>
            }
          />
          <TooltipContent>{dataHintMessage}</TooltipContent>
        </Tooltip>
        </div>
      </div>

      {/* Empty / insufficient notes warning */}
      {!loading && !fetching && totalItems === 0 && (
        <p className="text-center text-sm text-zinc-400">
          {t('notesAIInsights.noDataForPeriod', { period: selectedPeriod.label })}
        </p>
      )}
      {!loading && !fetching && totalItems > 0 && totalItems < MIN_NOTES_REQUIRED && (
        <p className="text-center text-sm text-amber-500">
          {t('notesAIInsights.minNotesHint', { min: MIN_NOTES_REQUIRED, n: totalItems })}
        </p>
      )}

      {/* Cooldown info — gentle, not an error */}
      {cooldownInfo && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {cooldownInfo}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton — matches 2 rows of 3 cards + notes row */}
      {(fetching || (loading && !viewed)) && (
        <div className="animate-pulse space-y-3">
          <div className="h-16 rounded-xl bg-violet-50" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-28 rounded-xl bg-indigo-50" />
            <div className="h-28 rounded-xl bg-amber-50" />
            <div className="h-28 rounded-xl bg-teal-50" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-28 rounded-xl bg-orange-50" />
            <div className="h-28 rounded-xl bg-violet-50" />
            <div className="h-28 rounded-xl bg-rose-50" />
          </div>
          <div className="h-20 rounded-xl bg-emerald-50" />
          <div className="h-14 rounded-xl bg-blue-50" />
        </div>
      )}

      {/* Result */}
      {viewed && !loading && !fetching && (
        <div className="space-y-2.5">
          {/* Period badge */}
          {viewed.period && (
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                {viewed.period.label}
              </span>
              <span className="text-xs text-zinc-400">
                {fmtDate(viewed.period.from)} → {fmtDate(viewed.period.to)}
              </span>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
            <p className="text-sm leading-relaxed text-violet-900">{viewed.summary}</p>
          </div>

          {/* Domain cards — row 1: body metrics */}
          <div className="grid gap-2 sm:grid-cols-3">
            {/* Weight */}
            {viewed.weight && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-indigo-600" />
                    <h4 className="text-xs font-semibold text-indigo-600">{t('notesAIInsights.weightCard')}</h4>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${verdictBadge(viewed.weight.verdict)}`}>
                    {viewed.weight.verdict}
                  </span>
                </div>
                <ul className="mb-2 space-y-1">
                  {viewed.weight.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-indigo-800">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-indigo-400" />{p}
                    </li>
                  ))}
                </ul>
                {viewed.weight.next_target && (
                  <div className="rounded-lg bg-indigo-100/70 px-2 py-1 text-xs text-indigo-700">
                    <span className="font-medium">{t('notesAIInsights.targetLabel')}</span>{viewed.weight.next_target}
                  </div>
                )}
              </div>
            )}

            {/* Nutrition */}
            {viewed.nutrition && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Utensils className="h-3.5 w-3.5 text-amber-600" />
                    <h4 className="text-xs font-semibold text-amber-600">{t('notesAIInsights.nutritionCard')}</h4>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${verdictBadge(viewed.nutrition.verdict)}`}>
                    {viewed.nutrition.verdict}
                  </span>
                </div>
                <ul className="mb-2 space-y-1">
                  {viewed.nutrition.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-amber-800">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />{p}
                    </li>
                  ))}
                </ul>
                <div className="space-y-1">
                  {viewed.nutrition.macro_avg && (
                    <div className="rounded-lg bg-amber-100/70 px-2 py-1 text-xs text-amber-700">
                      <span className="font-medium">{t('notesAIInsights.macroAverageLabel')}</span>{viewed.nutrition.macro_avg}
                    </div>
                  )}
                  {viewed.nutrition.worst_day && (
                    <p className="text-xs text-amber-700">
                      <span className="font-medium">{t('notesAIInsights.worstDayLabel')}</span>{viewed.nutrition.worst_day}
                    </p>
                  )}
                  {viewed.nutrition.skip_habit && (
                    <p className="text-xs text-amber-700">
                      <span className="font-medium">{t('notesAIInsights.skipHabitLabel')}</span>{viewed.nutrition.skip_habit}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Digestive */}
            {viewed.digestive && (
              <div className="rounded-xl border border-teal-100 bg-teal-50 p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-teal-600" />
                    <h4 className="text-xs font-semibold text-teal-600">Tiêu hóa</h4>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${verdictBadge(viewed.digestive.verdict)}`}>
                    {viewed.digestive.verdict}
                  </span>
                </div>
                <ul className="mb-2 space-y-1">
                  {viewed.digestive.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-teal-800">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-teal-400" />{p}
                    </li>
                  ))}
                </ul>
                {viewed.digestive.tip && (
                  <div className="rounded-lg bg-teal-100/70 px-2 py-1 text-xs text-teal-700">
                    <span className="font-medium">Gợi ý: </span>{viewed.digestive.tip}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Domain cards — row 2: training & planning */}
          <div className="grid gap-2 sm:grid-cols-3">
            {/* Gym */}
            {viewed.gym && (
              <div className="rounded-xl border border-orange-100 bg-orange-50 p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Dumbbell className="h-3.5 w-3.5 text-orange-600" />
                    <h4 className="text-xs font-semibold text-orange-600">Gym</h4>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${verdictBadge(viewed.gym.verdict)}`}>
                    {viewed.gym.verdict}
                  </span>
                </div>
                <ul className="mb-2 space-y-1">
                  {viewed.gym.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-orange-800">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-orange-400" />{p}
                    </li>
                  ))}
                </ul>
                <div className="space-y-1">
                  {viewed.gym.strongest_muscle && (
                    <p className="text-xs text-orange-700">
                      <span className="font-medium">Cơ chủ đạo: </span>{viewed.gym.strongest_muscle}
                    </p>
                  )}
                  {viewed.gym.next_challenge && (
                    <div className="rounded-lg bg-orange-100/70 px-2 py-1 text-xs text-orange-700">
                      <span className="font-medium">Thử thách tới: </span>{viewed.gym.next_challenge}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Calendar */}
            {viewed.calendar && (
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-violet-600" />
                    <h4 className="text-xs font-semibold text-violet-600">Lịch trình</h4>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${verdictBadge(viewed.calendar.verdict)}`}>
                    {viewed.calendar.verdict}
                  </span>
                </div>
                <ul className="mb-2 space-y-1">
                  {viewed.calendar.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-violet-800">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />{p}
                    </li>
                  ))}
                </ul>
                <div className="space-y-1">
                  {viewed.calendar.busiest_day && (
                    <p className="text-xs text-violet-700">
                      <span className="font-medium">Ngày bận nhất: </span>{viewed.calendar.busiest_day}
                    </p>
                  )}
                  {viewed.calendar.tip && (
                    <div className="rounded-lg bg-violet-100/70 px-2 py-1 text-xs text-violet-700">
                      <span className="font-medium">Gợi ý: </span>{viewed.calendar.tip}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Goals */}
            {viewed.goals && (
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-rose-600" />
                    <h4 className="text-xs font-semibold text-rose-600">Mục tiêu</h4>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${verdictBadge(viewed.goals.verdict)}`}>
                    {viewed.goals.verdict}
                  </span>
                </div>
                <ul className="mb-2 space-y-1">
                  {viewed.goals.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-rose-800">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />{p}
                    </li>
                  ))}
                </ul>
                {viewed.goals.focus && (
                  <div className="rounded-lg bg-rose-100/70 px-2 py-1 text-xs text-rose-700">
                    <span className="font-medium">Ưu tiên: </span>{viewed.goals.focus}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Domain cards — row 3: notes & habits */}
          <div className="grid gap-2 sm:grid-cols-1">
            {/* Notes & Habits */}
            {viewed.notes_habits && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                  <h4 className="text-xs font-semibold text-emerald-600">{t('notesAIInsights.notesHabitsCard')}</h4>
                </div>
                <ul className="mb-2 grid gap-1 sm:grid-cols-2">
                  {viewed.notes_habits.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-emerald-800">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />{p}
                    </li>
                  ))}
                </ul>
                {viewed.notes_habits.habit_gap && (
                  <div className="rounded-lg bg-emerald-100/70 px-2 py-1 text-xs text-emerald-700">
                    <span className="font-medium">{t('notesAIInsights.habitGapLabel')}</span>{viewed.notes_habits.habit_gap}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pattern + Recommendation */}
          <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-blue-600" />
                <h4 className="text-xs font-semibold text-blue-600">Tương quan nổi bật</h4>
              </div>
              <p className="text-xs leading-relaxed text-blue-900">{viewed.pattern}</p>
            </div>
            <div className="border-t border-blue-100 pt-2.5">
              <p className="mb-1.5 text-xs font-semibold text-blue-600">{t('notesAIInsights.recommendationCard')}</p>
              <ol className="space-y-1">
                {viewed.recommendation
                  .split(/(?=\d+\.\s)/)
                  .map(s => s.replace(/^\d+\.\s*/, '').trim())
                  .filter(Boolean)
                  .map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-blue-800">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-200 text-[10px] font-bold text-blue-700">
                        {i + 1}
                      </span>
                      {item}
                    </li>
                  ))}
              </ol>
            </div>
          </div>

          {/* Token + timestamp footer — only shown when token data is available */}
          {viewed.tokenUsage && viewed.tokenUsage.total > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-500">
              <span className="font-semibold text-zinc-700">
                {t('notesAIInsights.tokensLabel', { n: fmtN(viewed.tokenUsage.total, lang) })}
              </span>
              <span className="text-zinc-300">|</span>
              <span>{t('notesAIInsights.inputTokens', { n: fmtN(viewed.tokenUsage.prompt, lang) })}</span>
              <span>·</span>
              <span>{t('notesAIInsights.outputTokens', { n: fmtN(viewed.tokenUsage.completion, lang) })}</span>
              <span className="text-zinc-400 sm:ml-auto">{formatDateTime(viewed.analyzedAt, lang)}</span>
            </div>
          )}
        </div>
      )}

      {/* Donate modal — shown when user clicks Analyze without permission */}
      {showDonateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => { setShowDonateModal(false); setDonated(false) }}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setShowDonateModal(false); setDonated(false) }}
              className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-center text-lg font-bold text-zinc-800">
              {t('notesAIInsights.donateModalTitle')}
            </h3>
            <p className="mt-3 text-center text-sm leading-relaxed text-zinc-500">
              {t('notesAIInsights.donateModalBody')}
            </p>
            <div className="mt-5 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/dnm.jpg" alt="Donate QR" className="h-56 w-56 rounded-xl object-cover" />
            </div>

            {donated ? (
              <p className="mt-5 text-center text-base font-semibold text-violet-600">
                {t('notesAIInsights.donateModalThanks')}
              </p>
            ) : (
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => { setShowDonateModal(false); setDonated(false) }}
                  className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-50"
                >
                  {t('notesAIInsights.donateModalClose')}
                </button>
                <button
                  onClick={handleDonateConfirm}
                  disabled={donating}
                  className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {donating
                    ? t('notesAIInsights.donateModalConfirming')
                    : t('notesAIInsights.donateModalConfirm')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && !fetching && (
        <div className="rounded-xl border border-zinc-100">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-700"
          >
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              {t('notesAIInsights.historyHeading', { n: history.length })}
            </div>
            {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showHistory && (
            <div className="border-t border-zinc-100">
              {history.map((item, idx) => (
                <button
                  key={item.id ?? idx}
                  onClick={() => { setViewIndex(idx); setShowHistory(false) }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-zinc-50 ${
                    idx === viewIndex ? 'bg-violet-50' : ''
                  } ${idx < history.length - 1 ? 'border-b border-zinc-50' : ''}`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${idx === viewIndex ? 'bg-violet-500' : 'bg-zinc-300'}`} />

                  {/* Period label */}
                  {item.period ? (
                    <span className={`w-20 shrink-0 font-medium ${idx === viewIndex ? 'text-violet-700' : 'text-zinc-700'}`}>
                      {item.period.label}
                    </span>
                  ) : (
                    <span className="w-20 shrink-0 text-zinc-400">—</span>
                  )}

                  <span className="flex-1 text-zinc-400">{formatDateTime(item.analyzedAt, lang)}</span>

                  {item.tokenUsage && item.tokenUsage.total > 0 && (
                    <span className="text-zinc-400">🪙 {fmtN(item.tokenUsage.total, lang)}</span>
                  )}
                  {idx === viewIndex && (
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-600">{t('notesAIInsights.currentlyViewing')}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}
