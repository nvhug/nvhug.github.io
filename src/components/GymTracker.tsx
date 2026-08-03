'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Dumbbell, X, Pencil, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { GymLog } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { DatePicker } from '@/components/ui/date-picker'
import { useLanguage } from '@/lib/i18n/language-context'

// ─── Preset exercises ─────────────────────────────────────────────────────────
const PRESETS: { exercise: string; muscle_group: string }[] = [
  { exercise: 'Hít đất (Push-up)',                    muscle_group: 'Ngực, vai trước, tay sau' },
  { exercise: 'One-arm Dumbbell Row',                  muscle_group: 'Lưng, xô, tay trước' },
  { exercise: 'One-arm Shoulder Press',                muscle_group: 'Vai' },
  { exercise: 'Dumbbell Biceps Curl',                  muscle_group: 'Tay trước' },
  { exercise: 'One-arm Overhead Triceps Extension',    muscle_group: 'Tay sau' },
  { exercise: 'Squat',                                 muscle_group: 'Đùi, mông' },
  { exercise: 'Deadlift',                              muscle_group: 'Lưng dưới, đùi sau, mông' },
  { exercise: 'Bench Press',                           muscle_group: 'Ngực, vai, tay sau' },
  { exercise: 'Pull-up / Chin-up',                     muscle_group: 'Lưng, xô, tay trước' },
  { exercise: 'Dumbbell Lateral Raise',                muscle_group: 'Vai ngang' },
  { exercise: 'Plank',                                 muscle_group: 'Core' },
  { exercise: 'Lunges',                                muscle_group: 'Đùi, mông' },
  { exercise: 'Leg Press',                             muscle_group: 'Đùi trước' },
  { exercise: 'Calf Raise',                            muscle_group: 'Bắp chân' },
  { exercise: 'Crunch / Sit-up',                       muscle_group: 'Bụng trên' },
  { exercise: 'Russian Twist',                         muscle_group: 'Bụng chéo' },
  { exercise: 'Hip Thrust',                            muscle_group: 'Mông, đùi sau' },
  { exercise: 'Face Pull',                             muscle_group: 'Vai sau, lưng trên' },
  { exercise: 'Triceps Dips',                          muscle_group: 'Tay sau, ngực dưới' },
  { exercise: 'Arnold Press',                          muscle_group: 'Vai toàn phần' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

type LogForm = {
  exercise: string
  muscle_group: string
  sets: string
  reps: string
  weight_kg: string
  note: string
}

const EMPTY_FORM: LogForm = {
  exercise: '', muscle_group: '', sets: '3', reps: '12', weight_kg: '10', note: '',
}

// ─── ExerciseSuggest ──────────────────────────────────────────────────────────
function ExerciseSuggest({ value, onChange, onSelect, placeholder }: {
  value: string
  onChange: (v: string) => void
  onSelect: (preset: typeof PRESETS[0]) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = value.trim()
    ? PRESETS.filter(p => p.exercise.toLowerCase().includes(value.toLowerCase()))
    : PRESETS

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <Input
        autoFocus
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="text-sm"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {filtered.map(p => (
            <button
              key={p.exercise}
              type="button"
              onClick={() => { onSelect(p); setOpen(false) }}
              className="flex w-full flex-col px-3 py-2 text-left hover:bg-emerald-50 transition-colors border-b border-zinc-50 last:border-0"
            >
              <span className="text-sm font-medium text-zinc-800">{p.exercise}</span>
              <span className="text-[11px] text-zinc-400">{p.muscle_group}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function GymTracker() {
  const { t } = useLanguage()
  const [date,        setDate]        = useState(todayISO)
  const [logs,        setLogs]        = useState<GymLog[]>([])
  const [loading,     setLoading]     = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState<LogForm>(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editForm,    setEditForm]    = useState<LogForm>(EMPTY_FORM)
  const [savingEdit,  setSavingEdit]  = useState(false)
  const [savingQuick, setSavingQuick] = useState<string | null>(null)
  const [deleteTarget,setDeleteTarget]= useState<GymLog | null>(null)
  const [deleting,    setDeleting]    = useState(false)

  const fetchLogs = useCallback(async (d = date) => {
    try {
      const { data, error } = await supabase
        .from('gym_logs')
        .select('*')
        .eq('log_date', d)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      setLogs((data ?? []) as GymLog[])
    } catch {
      toast.error(t('gymTracker.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [date, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs(date)
  }, [date, fetchLogs])

  function patch(key: keyof LogForm, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function selectPreset(p: typeof PRESETS[0]) {
    setForm(f => ({ ...f, exercise: p.exercise, muscle_group: p.muscle_group }))
  }

  async function saveLog() {
    if (!form.exercise.trim()) { toast.error(t('gymTracker.exerciseRequired')); return }
    const sets = parseInt(form.sets)
    if (!sets || sets < 1) { toast.error(t('gymTracker.setsMin')); return }
    if (!form.reps.trim()) { toast.error(t('gymTracker.repsRequired')); return }

    setSaving(true)
    try {
      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
      const { error } = await supabase.from('gym_logs').insert([{
        user_id:      user?.id,
        log_date:     date,
        exercise:     form.exercise.trim(),
        muscle_group: form.muscle_group.trim() || null,
        sets,
        reps:         form.reps.trim(),
        weight_kg:    form.weight_kg ? parseFloat(form.weight_kg) : null,
        note:         form.note.trim() || null,
        order_index:  logs.length,
      }])
      if (error) throw error
      toast.success(t('gymTracker.saved'))
      setForm(EMPTY_FORM)
      setShowForm(false)
      setLoading(true)
      await fetchLogs(date)
    } catch {
      toast.error(t('gymTracker.genericError'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('gym_logs').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setLogs(prev => prev.filter(l => l.id !== deleteTarget.id))
      toast.success(t('gymTracker.deleted'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('gymTracker.genericError'))
    } finally {
      setDeleting(false)
    }
  }

  function startEdit(log: GymLog) {
    setEditingId(log.id)
    setEditForm({
      exercise:     log.exercise,
      muscle_group: log.muscle_group ?? '',
      sets:         String(log.sets),
      reps:         log.reps,
      weight_kg:    log.weight_kg != null ? String(log.weight_kg) : '',
      note:         log.note ?? '',
    })
    setShowForm(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(EMPTY_FORM)
  }

  async function saveEdit(id: string) {
    const sets = parseInt(editForm.sets)
    if (!editForm.exercise.trim()) { toast.error(t('gymTracker.exerciseRequired')); return }
    if (!sets || sets < 1) { toast.error(t('gymTracker.setsMin')); return }
    if (!editForm.reps.trim()) { toast.error(t('gymTracker.repsRequired')); return }

    setSavingEdit(true)
    try {
      const { error } = await supabase.from('gym_logs').update({
        exercise:     editForm.exercise.trim(),
        muscle_group: editForm.muscle_group.trim() || null,
        sets,
        reps:         editForm.reps.trim(),
        weight_kg:    editForm.weight_kg ? parseFloat(editForm.weight_kg) : null,
        note:         editForm.note.trim() || null,
      }).eq('id', id)
      if (error) throw error
      setLogs(prev => prev.map(l => l.id !== id ? l : {
        ...l,
        exercise:     editForm.exercise.trim(),
        muscle_group: editForm.muscle_group.trim() || undefined,
        sets,
        reps:         editForm.reps.trim(),
        weight_kg:    editForm.weight_kg ? parseFloat(editForm.weight_kg) : undefined,
        note:         editForm.note.trim() || undefined,
      }))
      toast.success(t('gymTracker.updated'))
      cancelEdit()
    } catch {
      toast.error(t('gymTracker.genericError'))
    } finally {
      setSavingEdit(false)
    }
  }

  async function adjustSetsQuick(id: string, delta: 1 | -1) {
    const currentLog = logs.find(l => l.id === id)
    if (!currentLog) return

    const nextSets = Math.max(1, Math.min(20, currentLog.sets + delta))
    if (nextSets === currentLog.sets) return

    setSavingQuick(id)
    setLogs(prev => prev.map(l => l.id === id ? { ...l, sets: nextSets } : l))

    try {
      const { error } = await supabase
        .from('gym_logs')
        .update({ sets: nextSets })
        .eq('id', id)
      if (error) throw error
    } catch {
      setLogs(prev => prev.map(l => l.id === id ? { ...l, sets: currentLog.sets } : l))
      toast.error(t('gymTracker.quickUpdateFailed'))
    } finally {
      setSavingQuick(prev => prev === id ? null : prev)
    }
  }

  const totalSets = logs.reduce((sum, l) => sum + l.sets, 0)

  return (
    <div className="space-y-4">
      {/* Date selector + summary */}
      <div className="flex flex-wrap items-center gap-3">
        <DatePicker value={date} onChange={d => { setLoading(true); setDate(d); setShowForm(false) }} />
        {logs.length > 0 && (
          <span className="text-xs text-zinc-500">
            {t('gymTracker.summary', { exercises: logs.length, sets: totalSets })}
          </span>
        )}
        <Button
          size="sm"
          className="ml-auto h-7 gap-1 text-xs"
          onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM) }}
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? t('common.close') : t('gymTracker.addExercise')}
        </Button>
      </div>

      {/* Add exercise form */}
      {showForm && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t('gymTracker.addHeading')}</p>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.exerciseLabel')} *</label>
            <ExerciseSuggest
              value={form.exercise}
              onChange={v => patch('exercise', v)}
              onSelect={selectPreset}
              placeholder={t('gymTracker.exercisePlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.muscleLabel')}</label>
            <Input
              value={form.muscle_group}
              onChange={e => patch('muscle_group', e.target.value)}
              placeholder={t('gymTracker.musclePlaceholder')}
              className="text-sm"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.setsLabel')} *</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={form.sets}
                onChange={e => patch('sets', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.repsLabel')} *</label>
              <Input
                value={form.reps}
                onChange={e => patch('reps', e.target.value)}
                placeholder={t('gymTracker.repsPlaceholder')}
                className="text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.weightLabel')}</label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={form.weight_kg}
                onChange={e => patch('weight_kg', e.target.value)}
                placeholder={t('gymTracker.weightPlaceholder')}
                className="text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.notesLabel')}</label>
            <Input
              value={form.note}
              onChange={e => patch('note', e.target.value)}
              placeholder={t('gymTracker.notesPlaceholder')}
              className="text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              {t('common.cancel')}
            </button>
            <Button size="sm" disabled={saving} onClick={saveLog} className="h-7 text-xs">
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      )}

      {/* Exercise list */}
      {loading ? (
        <p className="py-4 text-center text-sm text-zinc-400">{t('common.loading')}</p>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center">
          <Dumbbell className="mx-auto mb-2 h-8 w-8 text-zinc-200" />
          <p className="text-sm text-zinc-400">{t('gymTracker.emptyToday')}</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 text-xs font-medium text-emerald-600 hover:underline"
          >
            + {t('gymTracker.addFirstExercise')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, idx) => (
            <div
              key={log.id}
              className="group rounded-xl border border-zinc-100 bg-white shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_3px_10px_0_rgba(0,0,0,0.07)]"
            >
              {editingId === log.id ? (
                /* ── Inline edit form ── */
                <div className="space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                      {idx + 1}
                    </span>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">{t('gymTracker.editHeading')}</p>
                    <button onClick={cancelEdit} className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.exerciseLabel')} *</label>
                    <Input
                      autoFocus
                      value={editForm.exercise}
                      onChange={e => setEditForm(f => ({ ...f, exercise: e.target.value }))}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.muscleLabel')}</label>
                    <Input
                      value={editForm.muscle_group}
                      onChange={e => setEditForm(f => ({ ...f, muscle_group: e.target.value }))}
                      placeholder={t('gymTracker.musclePlaceholder')}
                      className="text-sm"
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.setsLabel')} *</label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={editForm.sets}
                        onChange={e => setEditForm(f => ({ ...f, sets: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.repsLabel')} *</label>
                      <Input
                        value={editForm.reps}
                        onChange={e => setEditForm(f => ({ ...f, reps: e.target.value }))}
                        placeholder={t('gymTracker.repsPlaceholder')}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.weightLabel')}</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={editForm.weight_kg}
                        onChange={e => setEditForm(f => ({ ...f, weight_kg: e.target.value }))}
                        placeholder={t('gymTracker.weightPlaceholder')}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">{t('gymTracker.notesLabel')}</label>
                    <Input
                      value={editForm.note}
                      onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                      placeholder={t('gymTracker.notesPlaceholder')}
                      className="text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                    >
                      {t('common.cancel')}
                    </button>
                    <Button size="sm" disabled={savingEdit} onClick={() => saveEdit(log.id)} className="h-7 text-xs">
                      {savingEdit ? t('common.saving') : t('gymTracker.update')}
                    </Button>
                  </div>
                </div>
              ) : (
                /* ── Display row ── */
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 leading-tight">{log.exercise}</p>
                    {log.muscle_group && (
                      <p className="text-[11px] text-zinc-400 mt-0.5">{log.muscle_group}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {log.sets} hiệp × {log.reps} lần
                      </span>
                      <button
                        type="button"
                        onClick={() => void adjustSetsQuick(log.id, 1)}
                        disabled={savingQuick === log.id}
                        className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 p-1.5 sm:p-1 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-50"
                        aria-label={t('gymTracker.increaseSetsAria')}
                      >
                        <ChevronUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      </button>
                      {log.weight_kg && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {log.weight_kg} kg
                        </span>
                      )}
                      {log.note && (
                        <span className="text-[11px] italic text-zinc-400">{log.note}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-0.5 flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => startEdit(log)}
                      className="rounded p-1.5 sm:p-1 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                      aria-label={t('common.edit')}
                    >
                      <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(log)}
                      className="rounded p-1.5 sm:p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        itemContent={deleteTarget?.exercise}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
