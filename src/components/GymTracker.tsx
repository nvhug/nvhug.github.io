'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Dumbbell, ChevronDown, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { GymLog } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { DatePicker } from '@/components/ui/date-picker'

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
  exercise: '', muscle_group: '', sets: '3', reps: '12', weight_kg: '', note: '',
}

// ─── ExerciseSuggest ──────────────────────────────────────────────────────────
function ExerciseSuggest({ value, onChange, onSelect }: {
  value: string
  onChange: (v: string) => void
  onSelect: (preset: typeof PRESETS[0]) => void
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
        placeholder="Tên bài tập..."
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
  const [date,        setDate]        = useState(todayISO)
  const [logs,        setLogs]        = useState<GymLog[]>([])
  const [loading,     setLoading]     = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState<LogForm>(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [deleteTarget,setDeleteTarget]= useState<GymLog | null>(null)
  const [deleting,    setDeleting]    = useState(false)

  async function fetchLogs(d = date) {
    setLoading(true)
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
      toast.error('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchLogs(date) }, [date])

  function patch(key: keyof LogForm, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function selectPreset(p: typeof PRESETS[0]) {
    setForm(f => ({ ...f, exercise: p.exercise, muscle_group: p.muscle_group }))
  }

  async function saveLog() {
    if (!form.exercise.trim()) { toast.error('Nhập tên bài tập'); return }
    const sets = parseInt(form.sets)
    if (!sets || sets < 1) { toast.error('Số hiệp phải ≥ 1'); return }
    if (!form.reps.trim()) { toast.error('Nhập số lần'); return }

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
      toast.success('Đã lưu bài tập')
      setForm(EMPTY_FORM)
      setShowForm(false)
      await fetchLogs(date)
    } catch {
      toast.error('Có lỗi xảy ra')
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
      toast.success('Đã xoá bài tập')
      setDeleteTarget(null)
    } catch {
      toast.error('Có lỗi xảy ra')
    } finally {
      setDeleting(false)
    }
  }

  const totalSets = logs.reduce((sum, l) => sum + l.sets, 0)

  return (
    <div className="space-y-4">
      {/* Date selector + summary */}
      <div className="flex flex-wrap items-center gap-3">
        <DatePicker value={date} onChange={d => { setDate(d); setShowForm(false) }} />
        {logs.length > 0 && (
          <span className="text-xs text-zinc-500">
            {logs.length} bài tập · {totalSets} hiệp tổng
          </span>
        )}
        <Button
          size="sm"
          className="ml-auto h-7 gap-1 text-xs"
          onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM) }}
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Đóng' : 'Thêm bài tập'}
        </Button>
      </div>

      {/* Add exercise form */}
      {showForm && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Thêm bài tập</p>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Bài tập *</label>
            <ExerciseSuggest
              value={form.exercise}
              onChange={v => patch('exercise', v)}
              onSelect={selectPreset}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Cơ chính</label>
            <Input
              value={form.muscle_group}
              onChange={e => patch('muscle_group', e.target.value)}
              placeholder="Ngực, vai, tay sau..."
              className="text-sm"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Số hiệp *</label>
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
              <label className="mb-1 block text-xs font-medium text-zinc-600">Số lần *</label>
              <Input
                value={form.reps}
                onChange={e => patch('reps', e.target.value)}
                placeholder="12 hoặc 10–12"
                className="text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Tạ (kg)</label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={form.weight_kg}
                onChange={e => patch('weight_kg', e.target.value)}
                placeholder="–"
                className="text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Ghi chú</label>
            <Input
              value={form.note}
              onChange={e => patch('note', e.target.value)}
              placeholder="Cảm nhận, mỗi tay..."
              className="text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Huỷ
            </button>
            <Button size="sm" disabled={saving} onClick={saveLog} className="h-7 text-xs">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </div>
        </div>
      )}

      {/* Exercise list */}
      {loading ? (
        <p className="py-4 text-center text-sm text-zinc-400">Đang tải...</p>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center">
          <Dumbbell className="mx-auto mb-2 h-8 w-8 text-zinc-200" />
          <p className="text-sm text-zinc-400">Chưa có bài tập nào hôm nay</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 text-xs font-medium text-emerald-600 hover:underline"
          >
            + Thêm bài tập đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, idx) => (
            <div
              key={log.id}
              className="group flex items-start gap-3 rounded-xl border border-zinc-100 bg-white px-4 py-3 shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_3px_10px_0_rgba(0,0,0,0.07)]"
            >
              {/* Index badge */}
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

              <button
                onClick={() => setDeleteTarget(log)}
                className="mt-0.5 shrink-0 rounded p-1 text-zinc-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                aria-label="Xoá"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
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
