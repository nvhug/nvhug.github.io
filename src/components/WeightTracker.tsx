'use client'

import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { WeightLog } from '@/types'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useLanguage } from '@/lib/i18n/language-context'
import { weightProgress } from '@/lib/weight-progress'
import {
  DEFAULT_WEIGHT_GOAL,
  WEIGHT_GOAL_PROFILE_KEY,
  parseWeightGoal,
  parseWeightInput,
  type WeightGoal,
} from '@/lib/weight-goal'
import { DatePicker } from '@/components/ui/date-picker'
import { getIntlLocale } from '@/lib/i18n/locale'
import type { Lang } from '@/lib/i18n/language-context'
import { getTodayLocalISODate } from '@/lib/date'

function todayDate() {
  return getTodayLocalISODate()
}

function formatDate(iso: string, lang: Lang) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(getIntlLocale(lang), { day: 'numeric', month: 'numeric', year: 'numeric' })
    .format(new Date(y, m - 1, d))
}

// Simple SVG line chart for last 30 entries
function WeightChart({ logs, goal }: { logs: WeightLog[]; goal: WeightGoal }) {
  if (logs.length < 2) return null

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  const weights = sorted.map((l) => l.weight)
  // Both guide lines must be inside the domain regardless of which bound is
  // the larger — the goal can point either way.
  const minW = Math.min(...weights, goal.start, goal.target) - 1
  const maxW = Math.max(...weights, goal.start, goal.target) + 1

  const W = 600
  const H = 160
  const PAD = { top: 10, right: 10, bottom: 20, left: 30 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const xOf = (i: number) => PAD.left + (i / (sorted.length - 1)) * chartW
  const yOf = (w: number) => PAD.top + ((maxW - w) / (maxW - minW)) * chartH

  const linePath = sorted
    .map((l, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(l.weight).toFixed(1)}`)
    .join(' ')

  const targetY = yOf(goal.target).toFixed(1)
  const startY = yOf(goal.start).toFixed(1)

  return (
    <div className="mt-4 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px]" style={{ height: H }}>
        {/* Target line */}
        <line x1={PAD.left} y1={targetY} x2={W - PAD.right} y2={targetY}
          stroke="#10b981" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - PAD.right - 2} y={Number(targetY) - 4} textAnchor="end"
          fontSize="10" fill="#10b981">{goal.target}kg</text>

        {/* Start line */}
        <line x1={PAD.left} y1={startY} x2={W - PAD.right} y2={startY}
          stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - PAD.right - 2} y={Number(startY) - 4} textAnchor="end"
          fontSize="10" fill="#94a3b8">{goal.start}kg</text>

        {/* Weight line */}
        <path d={linePath} fill="none" stroke="#a05b35" strokeWidth="2" strokeLinejoin="round" />

        {/* Dots */}
        {sorted.map((l, i) => (
          <circle key={l.id} cx={xOf(i)} cy={yOf(l.weight)} r="3"
            fill="#a05b35" />
        ))}

        {/* Last value label */}
        {(() => {
          const last = sorted[sorted.length - 1]
          const x = xOf(sorted.length - 1)
          const y = yOf(last.weight)
          return (
            <text x={x} y={y - 7} textAnchor="middle" fontSize="11" fontWeight="600" fill="#7c3d1e">
              {last.weight}kg
            </text>
          )
        })()}
      </svg>
    </div>
  )
}

type GoalField = keyof WeightGoal

export function WeightTracker() {
  const { t, lang } = useLanguage()
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayDate())
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // The goal is per user (ADR-009 pattern: a key in user_profiles.profile_data).
  // Until it loads — or if it was never set — the card shows the starter goal.
  const [goal, setGoal] = useState<WeightGoal>(DEFAULT_WEIGHT_GOAL)
  const [editingGoalField, setEditingGoalField] = useState<GoalField | null>(null)
  const [goalDraft, setGoalDraft] = useState('')

  useEffect(() => {
    fetchLogs()
    fetchGoal()
  }, [])

  async function fetchLogs() {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(60)
    setLogs(data || [])
    setLoading(false)
  }

  async function fetchGoal() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('id', user.id)
      .maybeSingle()
    const raw = (data?.profile_data as Record<string, unknown> | null)?.[WEIGHT_GOAL_PROFILE_KEY]
    setGoal(parseWeightGoal(raw))
  }

  function startGoalEdit(field: GoalField) {
    setEditingGoalField(field)
    setGoalDraft(String(goal[field]))
  }

  async function commitGoalEdit() {
    const field = editingGoalField
    if (!field) return
    setEditingGoalField(null)

    const value = parseWeightInput(goalDraft)
    if (value === null) { toast.error(t('weightTracker.invalidGoal')); return }
    if (value === goal[field]) return

    const previous = goal
    const next = { ...goal, [field]: value }
    setGoal(next)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error(t('weightTracker.goalSaveFailed')); setGoal(previous); return }

    // Merge, not replace: profile_data also holds the profile page's fields and
    // the horoscope profile. Upsert because a fresh account may have no row yet.
    const { data: existing, error: fetchError } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('id', user.id)
      .maybeSingle()
    const mergedProfileData = { ...(existing?.profile_data ?? {}), [WEIGHT_GOAL_PROFILE_KEY]: next }
    const { error } = fetchError
      ? { error: fetchError }
      : await supabase.from('user_profiles').upsert({ id: user.id, profile_data: mergedProfileData })
    if (error) { toast.error(t('weightTracker.goalSaveFailed')); setGoal(previous); return }
    toast.success(t('weightTracker.goalSaved'))
  }

  function startEdit(log: WeightLog) {
    setEditingId(log.id)
    setDate(log.date)
    setWeight(String(log.weight))
    setNotes(log.notes || '')
  }

  function resetForm() {
    setEditingId(null)
    setDate(todayDate())
    setWeight('')
    setNotes('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const w = parseFloat(weight)
    if (isNaN(w) || w <= 0) { toast.error(t('weightTracker.invalidWeight')); return }
    setSaving(true)

    if (editingId) {
      const { error } = await supabase
        .from('weight_logs')
        .update({ date, weight: w, notes: notes || null })
        .eq('id', editingId)
      if (error) { toast.error(t('weightTracker.saveFailed')); setSaving(false); return }
      toast.success(t('weightTracker.updated'))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error(t('weightTracker.saveFailed')); setSaving(false); return }
      const { error } = await supabase
        .from('weight_logs')
        .upsert({ user_id: user.id, date, weight: w, notes: notes || null }, { onConflict: 'user_id,date' })
      if (error) { toast.error(t('weightTracker.saveFailed')); setSaving(false); return }
      toast.success(t('weightTracker.saved'))
    }

    await fetchLogs()
    resetForm()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('weight_logs').delete().eq('id', id)
    if (error) { toast.error(t('weightTracker.deleteFailed')); return }
    toast.success(t('weightTracker.deleted'))
    setLogs((prev) => prev.filter((l) => l.id !== id))
  }

  const latest = logs[0]
  const progress = latest ? weightProgress(latest.weight, goal.start, goal.target) : null

  // "Lost" is progress on a loss goal and regression on a gain goal; "Gained"
  // is the reverse. The label follows the direction the weight actually moved,
  // and the colour follows whether that was toward the target.
  const movedDown = progress ? (progress.direction === 'lose') === (progress.progressed >= 0) : true
  const towardTarget = progress ? progress.progressed >= 0 : true

  function renderGoalBound(field: GoalField, label: string) {
    if (editingGoalField === field) {
      return (
        <input
          className="h-6 w-20 rounded-md border border-emerald-300 bg-white px-1.5 text-xs text-zinc-900 outline-none focus:border-emerald-500"
          inputMode="decimal"
          value={goalDraft}
          onChange={(e) => setGoalDraft(e.target.value)}
          onBlur={() => void commitGoalEdit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void commitGoalEdit() }
            if (e.key === 'Escape') setEditingGoalField(null)
          }}
          autoFocus
        />
      )
    }
    return (
      <button
        type="button"
        onDoubleClick={() => startGoalEdit(field)}
        className="cursor-text rounded px-1 -mx-1 hover:bg-emerald-50"
        title={t('weightTracker.editGoalHint')}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      {latest && (
        <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs text-zinc-500">{t('weightTracker.current')}</p>
              <p className="text-3xl font-bold text-zinc-900">{latest.weight} <span className="text-lg font-normal text-zinc-500">kg</span></p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">
                {movedDown ? t('weightTracker.lost') : t('weightTracker.gainedBack')}
              </p>
              <p
                className={`text-xl font-semibold ${towardTarget ? 'text-emerald-600' : 'text-rose-500'}`}
              >
                {Math.abs(progress!.progressed).toFixed(1)} kg
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">{t('weightTracker.remaining')}</p>
              <p className="text-xl font-semibold text-amber-600">{progress!.remaining.toFixed(1)} kg</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              {renderGoalBound('start', `${goal.start}kg`)}
              {renderGoalBound('target', t('weightTracker.targetLabel', { target: goal.target }))}
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-200">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress!.percent}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-zinc-500">{progress!.percent.toFixed(0)}%</p>
          </div>
          <WeightChart logs={logs} goal={goal} />
        </div>
      )}

      {/* Form */}
      <div className="rounded-2xl border border-emerald-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700">
          {editingId ? t('weightTracker.editHeading') : t('weightTracker.addHeading')}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">{t('weightTracker.dateLabel')}</label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">{t('weightTracker.weightLabel')}</label>
            <input
              type="number"
              step="0.1"
              min="30"
              max="200"
              placeholder="62.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-28 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400"
              required
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-32">
            <label className="text-xs text-zinc-500">{t('weightTracker.notesLabel')}</label>
            <input
              type="text"
              placeholder={t('weightTracker.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {editingId ? t('weightTracker.update') : t('common.save')}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
              {t('common.cancel')}
            </button>
          )}
        </form>
      </div>

      {/* History */}
      <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden">
        <div className="border-b border-emerald-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('weightTracker.history')}</p>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-zinc-400">{t('common.loading')}</p>
        ) : logs.length === 0 ? (
          <p className="p-4 text-sm text-zinc-400">{t('weightTracker.emptyHistory')}</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-semibold text-zinc-800">{log.weight} kg</span>
                  <span className="ml-2 text-xs text-zinc-400">{formatDate(log.date, lang)}</span>
                  {log.notes && <span className="ml-2 text-xs text-zinc-400">· {log.notes}</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(log)}
                    className="rounded p-1.5 sm:p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                    <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(log.id)}
                    className="rounded p-1.5 sm:p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteId}
        itemContent={t('weightTracker.deleteConfirmContent')}
        itemMeta={t('weightTracker.deleteConfirmMeta')}
        onConfirm={() => { if (deleteId) { handleDelete(deleteId); setDeleteId(null) } }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
