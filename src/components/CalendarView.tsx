'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Trash2, Clock, AlignLeft, CalendarDays, X, RefreshCw, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { CalendarEvent } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { TimePicker } from '@/components/ui/time-picker'
import { DatePicker } from '@/components/ui/date-picker'

// ─── Constants ────────────────────────────────────────────────────────────────
const PX_PER_HOUR = 64
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const MAX_MONTH_EVENTS = 3 // visible event rows per day cell in month view

const EVENT_COLORS: { id: string; label: string; bg: string; border: string; text: string; dot: string }[] = [
  { id: 'emerald', label: 'Xanh lá',   bg: '#d1fae5', border: '#059669', text: '#065f46', dot: '#059669' },
  { id: 'blue',    label: 'Xanh dương', bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a', dot: '#2563eb' },
  { id: 'violet',  label: 'Tím',        bg: '#ede9fe', border: '#7c3aed', text: '#4c1d95', dot: '#7c3aed' },
  { id: 'rose',    label: 'Hồng',       bg: '#ffe4e6', border: '#e11d48', text: '#881337', dot: '#e11d48' },
  { id: 'amber',   label: 'Vàng',       bg: '#fef3c7', border: '#d97706', text: '#92400e', dot: '#d97706' },
  { id: 'cyan',    label: 'Cyan',        bg: '#cffafe', border: '#0891b2', text: '#164e63', dot: '#0891b2' },
  { id: 'orange',  label: 'Cam',         bg: '#ffedd5', border: '#ea580c', text: '#7c2d12', dot: '#ea580c' },
  { id: 'slate',   label: 'Xám',         bg: '#f1f5f9', border: '#64748b', text: '#1e293b', dot: '#64748b' },
]

function colorById(id: string) {
  return EVENT_COLORS.find(c => c.id === id) ?? EVENT_COLORS[0]
}

// ─── Recurrence types ─────────────────────────────────────────────────────────
type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
type RecurrenceEnd  = { type: 'count'; count: number } | { type: 'until'; date: string }
type RecurrenceConfig = { type: RecurrenceType; interval: number; days: number[]; end: RecurrenceEnd }

const DEFAULT_RECURRENCE: RecurrenceConfig = { type: 'none', interval: 1, days: [], end: { type: 'count', count: 10 } }

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: 'Không lặp', daily: 'Hàng ngày', weekly: 'Hàng tuần', monthly: 'Hàng tháng', yearly: 'Hàng năm',
}
const RECURRENCE_MAX: Record<RecurrenceType, number> = {
  none: 1, daily: 90, weekly: 52, monthly: 24, yearly: 5,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minToTime(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

// Parse ISO date string as local date (avoids UTC-shift when constructing Date)
function parseLocal(iso: string) {
  const [y, mo, d] = iso.split('-').map(Number)
  return new Date(y, mo - 1, d)
}

// Expand a start date + recurrence config into a list of ISO date strings
function generateOccurrences(startDate: string, cfg: RecurrenceConfig): string[] {
  if (cfg.type === 'none') return [startDate]

  const start    = parseLocal(startDate)
  const maxCount = cfg.end.type === 'count' ? cfg.end.count : 500
  const until    = cfg.end.type === 'until' ? parseLocal(cfg.end.date) : null
  const dates: string[] = []

  if (cfg.type === 'weekly') {
    const selDays   = cfg.days.length > 0 ? cfg.days : [start.getDay()]
    const weekStart = new Date(start)
    weekStart.setDate(start.getDate() - start.getDay())

    outer: for (let w = 0; dates.length < maxCount; w++) {
      const ws = new Date(weekStart)
      ws.setDate(weekStart.getDate() + w * 7 * cfg.interval)
      for (const day of [...selDays].sort((a, b) => a - b)) {
        const d = new Date(ws)
        d.setDate(ws.getDate() + day)
        if (d < start) continue
        if (until && d > until) break outer
        dates.push(toISO(d))
        if (dates.length >= maxCount) break outer
      }
    }
    return dates
  }

  const cur = new Date(start)
  while (dates.length < maxCount) {
    if (until && cur > until) break
    dates.push(toISO(cur))
    if (cfg.type === 'daily')   cur.setDate(cur.getDate()           + cfg.interval)
    if (cfg.type === 'monthly') cur.setMonth(cur.getMonth()         + cfg.interval)
    if (cfg.type === 'yearly')  cur.setFullYear(cur.getFullYear()   + cfg.interval)
  }
  return dates
}

// Generate 6-row month grid (42 cells, starting Sunday)
function getMonthGrid(year: number, month: number): Date[] {
  const firstDay   = new Date(year, month, 1)
  const gridStart  = new Date(year, month, 1 - firstDay.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

// Mini-calendar grid starting Monday (matches Outlook style)
const MINI_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function getMiniGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const dow = firstDay.getDay() // 0=Sun…6=Sat
  const mondayOffset = dow === 0 ? 6 : dow - 1
  const gridStart = new Date(year, month, 1 - mondayOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

function getWeekStart(anchor: Date) {
  const d = new Date(anchor)
  d.setDate(d.getDate() - d.getDay()) // Sunday
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDates(anchor: Date) {
  const start = getWeekStart(anchor)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

// ─── Overlap layout ───────────────────────────────────────────────────────────
type LayoutEvent = CalendarEvent & { col: number; totalCols: number }

function computeLayout(events: CalendarEvent[]): LayoutEvent[] {
  const sorted = [...events].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
  const colEnds: number[] = []

  const withCol = sorted.map(ev => {
    const end = timeToMin(ev.end_time)
    const start = timeToMin(ev.start_time)
    let col = colEnds.findIndex(e => e <= start)
    if (col === -1) col = colEnds.length
    colEnds[col] = end
    return { ...ev, col, totalCols: 1 }
  })

  // Second pass: compute totalCols per overlap group
  return withCol.map(ev => {
    const s = timeToMin(ev.start_time)
    const e = timeToMin(ev.end_time)
    let max = ev.col
    for (const other of withCol) {
      if (other.id === ev.id) continue
      const os = timeToMin(other.start_time)
      const oe = timeToMin(other.end_time)
      if (os < e && oe > s) max = Math.max(max, other.col)
    }
    return { ...ev, totalCols: max + 1 }
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewMode = 'month' | 'week' | 'day'

type EventForm = {
  title: string
  description: string
  date: string
  start_time: string
  end_time: string
  color: string
  recurrence: RecurrenceConfig
}

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; event: CalendarEvent }
  | null

// scope picker shown when editing/deleting a recurring event
type RecurringScope = 'single' | 'all'

// ─── MiniCalendarNav ──────────────────────────────────────────────────────────
function MiniCalendarNav({
  anchorYear,
  anchorMonth,
  todayISO,
  activeISO,
  onDateSelect,
  onClose,
}: {
  anchorYear: number
  anchorMonth: number
  todayISO: string
  activeISO: string  // currently highlighted date in main view
  onDateSelect: (date: Date) => void
  onClose: () => void
}) {
  const [year,  setYear]  = useState(anchorYear)
  const [month, setMonth] = useState(anchorMonth)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const cells = getMiniGrid(year, month)
  const label = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date(year, month))

  return (
    <div
      ref={ref}
      className="absolute left-0 top-10 z-40 w-56 rounded-xl border border-zinc-200 bg-white p-3 shadow-2xl"
    >
      {/* Month navigation header */}
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={prev}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-zinc-100 text-zinc-500"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-semibold capitalize text-zinc-800">{label}</span>
        <button
          onClick={next}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-zinc-100 text-zinc-500"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Day headers — Monday first */}
      <div className="mb-1 grid grid-cols-7">
        {MINI_DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-zinc-400">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(date => {
          const iso      = toISO(date)
          const isToday  = iso === todayISO
          const isActive = iso === activeISO
          const inMonth  = date.getMonth() === month
          return (
            <button
              key={iso}
              onClick={() => { onDateSelect(date); onClose() }}
              className={`flex h-7 w-full items-center justify-center rounded text-xs font-medium transition-colors ${
                isToday
                  ? 'bg-emerald-600 text-white'
                  : isActive
                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                  : inMonth
                  ? 'text-zinc-700 hover:bg-zinc-100'
                  : 'text-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── RecurrenceForm ───────────────────────────────────────────────────────────
function RecurrenceForm({ value, onChange }: {
  value: RecurrenceConfig
  onChange: (v: RecurrenceConfig) => void
}) {
  function patch(partial: Partial<RecurrenceConfig>) {
    onChange({ ...value, ...partial })
  }
  function patchEnd(partial: Partial<RecurrenceEnd>) {
    onChange({ ...value, end: { ...value.end, ...partial } as RecurrenceEnd })
  }
  function toggleDay(day: number) {
    const days = value.days.includes(day) ? value.days.filter(d => d !== day) : [...value.days, day]
    patch({ days })
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-violet-100 bg-violet-50/40 p-3">
      {/* Type selector */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(RECURRENCE_LABELS) as RecurrenceType[]).map(t => (
          <button
            key={t}
            onClick={() => patch({ type: t, days: t === 'weekly' ? [new Date().getDay()] : [] })}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              value.type === t
                ? 'bg-violet-600 text-white'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:border-violet-300 hover:text-violet-600'
            }`}
          >
            {RECURRENCE_LABELS[t]}
          </button>
        ))}
      </div>

      {value.type !== 'none' && (
        <>
          {/* Interval */}
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span>Mỗi</span>
            <input
              type="number"
              min={1}
              max={99}
              value={value.interval}
              onChange={e => patch({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-14 rounded border border-zinc-200 bg-white px-2 py-1 text-center text-xs font-medium outline-none focus:border-violet-400"
            />
            <span>{value.type === 'daily' ? 'ngày' : value.type === 'weekly' ? 'tuần' : value.type === 'monthly' ? 'tháng' : 'năm'}</span>
          </div>

          {/* Day toggles for weekly */}
          {value.type === 'weekly' && (
            <div className="flex gap-1">
              {DAY_SHORT.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                    value.days.includes(i)
                      ? 'bg-violet-600 text-white'
                      : 'bg-white text-zinc-500 border border-zinc-200 hover:border-violet-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* End condition */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Kết thúc</p>
            <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="radio"
                checked={value.end.type === 'count'}
                onChange={() => patchEnd({ type: 'count', count: RECURRENCE_MAX[value.type] / 2 })}
                className="accent-violet-600"
              />
              Sau
              {value.end.type === 'count' && (
                <input
                  type="number"
                  min={1}
                  max={RECURRENCE_MAX[value.type]}
                  value={value.end.count}
                  onChange={e => patchEnd({ count: Math.min(RECURRENCE_MAX[value.type], Math.max(1, parseInt(e.target.value) || 1)) })}
                  className="w-14 rounded border border-zinc-200 bg-white px-2 py-1 text-center text-xs font-medium outline-none focus:border-violet-400"
                />
              )}
              lần
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="radio"
                checked={value.end.type === 'until'}
                onChange={() => patchEnd({ type: 'until', date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) })}
                className="accent-violet-600"
              />
              Đến ngày
              {value.end.type === 'until' && (
                <DatePicker value={value.end.date} onChange={d => patchEnd({ date: d })} />
              )}
            </label>
          </div>
        </>
      )}
    </div>
  )
}

// ─── RecurringScopeModal ──────────────────────────────────────────────────────
function RecurringScopeModal({ action, onSelect, onCancel }: {
  action: 'edit' | 'delete'
  onSelect: (scope: RecurringScope) => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-xs rounded-2xl border border-zinc-100 bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <p className="mb-4 text-sm font-semibold text-zinc-900">
          {action === 'delete' ? 'Xoá sự kiện lặp lại' : 'Chỉnh sửa sự kiện lặp lại'}
        </p>
        <div className="space-y-2">
          <button
            onClick={() => onSelect('single')}
            className="flex w-full flex-col rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-left hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
          >
            <span className="text-sm font-medium text-zinc-900">Chỉ sự kiện này</span>
            <span className="text-xs text-zinc-500">Chỉ áp dụng cho ngày đang chọn</span>
          </button>
          <button
            onClick={() => onSelect('all')}
            className="flex w-full flex-col rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-left hover:bg-rose-50 hover:border-rose-200 transition-colors"
          >
            <span className="text-sm font-medium text-zinc-900">Tất cả sự kiện trong chuỗi</span>
            <span className="text-xs text-zinc-500">Áp dụng cho toàn bộ sự kiện lặp lại</span>
          </button>
        </div>
        <button onClick={onCancel} className="mt-3 w-full rounded-lg py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100">
          Huỷ
        </button>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function CurrentTimeIndicator({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const [top, setTop] = useState<number | null>(null)

  useEffect(() => {
    function update() {
      const now = new Date()
      const min = now.getHours() * 60 + now.getMinutes()
      setTop((min / 60) * PX_PER_HOUR)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  // Scroll to current time on first render
  useEffect(() => {
    if (top === null || !scrollRef.current) return
    const offset = top - 120
    scrollRef.current.scrollTop = Math.max(0, offset)
  }, [top === null]) // eslint-disable-line react-hooks/exhaustive-deps

  if (top === null) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
      style={{ top }}
    >
      <div className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" style={{ marginLeft: -4 }} />
      <div className="h-px flex-1 bg-red-400" />
    </div>
  )
}

function EventBlock({
  event,
  col,
  totalCols,
  onClick,
}: {
  event: CalendarEvent
  col: number
  totalCols: number
  onClick: () => void
}) {
  const startMin = timeToMin(event.start_time)
  const endMin = timeToMin(event.end_time)
  const durationMin = Math.max(endMin - startMin, 15)
  const top = (startMin / 60) * PX_PER_HOUR
  const height = Math.max((durationMin / 60) * PX_PER_HOUR, 18)
  const colW = 100 / totalCols
  const left = col * colW
  const c = colorById(event.color)
  const isShort = height < 36

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="absolute z-10 overflow-hidden rounded text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
      style={{
        top,
        height,
        left: `calc(${left}% + 2px)`,
        width: `calc(${colW}% - 4px)`,
        backgroundColor: c.bg,
        borderLeft: `3px solid ${c.border}`,
      }}
    >
      <div className="px-1.5 py-0.5" style={{ color: c.text }}>
        <p className={`font-medium leading-tight ${isShort ? 'text-[10px]' : 'text-xs'} line-clamp-1`}>
          {event.title}
        </p>
        {!isShort && (
          <p className="text-[10px] opacity-75 tabular-nums leading-none mt-0.5">
            {event.start_time} – {event.end_time}
          </p>
        )}
      </div>
    </button>
  )
}

function EventModal({
  modal,
  form,
  setForm,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  modal: ModalState
  form: EventForm
  setForm: React.Dispatch<React.SetStateAction<EventForm>>
  saving: boolean
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  if (!modal) return null
  const isEdit = modal.mode === 'edit'
  const isRecurring = isEdit && (modal as { mode: 'edit'; event: CalendarEvent }).event.is_recurring

  function patch(key: keyof EventForm, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-emerald-100 bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <CalendarDays className="h-4 w-4 text-emerald-600" />
          <h3 className="flex-1 text-sm font-semibold text-zinc-900">
            {isEdit ? 'Chỉnh sửa sự kiện' : 'Thêm sự kiện'}
          </h3>
          {isRecurring && (
            <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600">
              <RefreshCw className="h-2.5 w-2.5" /> Lặp lại
            </span>
          )}
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          <div className="space-y-3 px-4 py-4">
            {/* Title */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Tiêu đề *</label>
              <Input
                autoFocus
                value={form.title}
                onChange={e => patch('title', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onSave()}
                placeholder="Tên sự kiện..."
                className="text-sm"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-zinc-600">
                <AlignLeft className="h-3 w-3" /> Ghi chú
              </label>
              <textarea
                value={form.description}
                onChange={e => patch('description', e.target.value)}
                placeholder="Thêm ghi chú..."
                rows={2}
                className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus-visible:border-emerald-400"
              />
            </div>

            {/* Date */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Ngày</label>
              <DatePicker value={form.date} onChange={v => patch('date', v)} />
            </div>

            {/* Time range */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-zinc-600">
                  <Clock className="h-3 w-3" /> Bắt đầu
                </label>
                <TimePicker value={form.start_time} onChange={v => {
                  patch('start_time', v)
                  if (timeToMin(v) >= timeToMin(form.end_time)) {
                    patch('end_time', minToTime(Math.min(timeToMin(v) + 60, 23 * 60 + 59)))
                  }
                }} />
              </div>
              <span className="mt-4 text-zinc-400">→</span>
              <div className="flex-1">
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-zinc-600">
                  <Clock className="h-3 w-3" /> Kết thúc
                </label>
                <TimePicker value={form.end_time} onChange={v => patch('end_time', v)} />
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">Màu sắc</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_COLORS.map(c => (
                  <button
                    key={c.id}
                    title={c.label}
                    onClick={() => patch('color', c.id)}
                    className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-all"
                    style={{
                      backgroundColor: c.bg,
                      color: c.text,
                      border: `1px solid ${c.border}`,
                      boxShadow: form.color === c.id ? `0 0 0 2px ${c.border}` : undefined,
                      opacity: form.color === c.id ? 1 : 0.65,
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.dot }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurring — only on create */}
            {!isEdit && (
              <div>
                <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-zinc-600">
                  <RefreshCw className="h-3 w-3" /> Lặp lại
                </label>
                <RecurrenceForm
                  value={form.recurrence}
                  onChange={v => setForm(f => ({ ...f, recurrence: v }))}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-zinc-100 px-4 py-3">
          {isEdit && (
            <button
              onClick={onDelete}
              className="mr-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xoá
            </button>
          )}
          <button onClick={onClose} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
            Huỷ
          </button>
          <Button size="sm" disabled={saving || !form.title.trim()} onClick={onSave} className="h-7 text-xs">
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : form.recurrence.type !== 'none' ? 'Tạo chuỗi' : 'Thêm'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── MonthView ────────────────────────────────────────────────────────────────
function MonthView({ year, month, todayISO, eventsByDate, onDayClick, onEventClick }: {
  year: number
  month: number
  todayISO: string
  eventsByDate: Record<string, CalendarEvent[]>
  onDayClick: (date: Date) => void
  onEventClick: (ev: CalendarEvent) => void
}) {
  const cells = useMemo(() => getMonthGrid(year, month), [year, month])

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm select-none">
      {/* Day name header */}
      <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/60">
        {DAY_SHORT.map((d, i) => (
          <div key={d} className={`py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider ${i === 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((date, idx) => {
          const iso       = toISO(date)
          const isToday   = iso === todayISO
          const inMonth   = date.getMonth() === month
          const isSunday  = date.getDay() === 0
          const dayEvents = eventsByDate[iso] ?? []
          const visible   = dayEvents.slice(0, MAX_MONTH_EVENTS)
          const hidden    = dayEvents.length - visible.length

          return (
            <div
              key={iso}
              className={`group relative min-h-32 cursor-pointer border-b border-r border-zinc-100 p-1 transition-colors ${idx % 7 === 6 ? 'border-r-0' : ''} ${
                inMonth ? 'bg-white hover:bg-emerald-50/30' : 'bg-zinc-50/40 hover:bg-zinc-50/70'
              }`}
              onClick={() => onDayClick(date)}
            >
              {/* Day number + quick add */}
              <div className="mb-1 flex items-center justify-between">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? 'bg-emerald-600 text-white' :
                  isSunday ? (inMonth ? 'text-rose-500' : 'text-rose-300') :
                  inMonth ? 'text-zinc-700' : 'text-zinc-300'
                }`}>
                  {date.getDate()}
                </span>
                <Plus className="hidden h-3.5 w-3.5 text-zinc-300 group-hover:block hover:text-emerald-500" />
              </div>

              {/* Event chips */}
              <div className="space-y-px">
                {visible.map(ev => {
                  const c = colorById(ev.color)
                  return (
                    <button
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                      className="flex w-full items-center gap-1 overflow-hidden rounded px-1 py-0.5 text-left text-[11px] font-medium leading-tight transition-opacity hover:opacity-75"
                      style={{ backgroundColor: c.bg, color: c.text, borderLeft: `2px solid ${c.border}` }}
                    >
                      <span className="tabular-nums shrink-0 opacity-70">{ev.start_time.slice(0, 5)}</span>
                      <span className="truncate">{ev.title}</span>
                      {ev.is_recurring && <RefreshCw className="ml-auto h-2.5 w-2.5 shrink-0 opacity-50" />}
                    </button>
                  )
                })}
                {hidden > 0 && (
                  <div className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-zinc-400">
                    <MoreHorizontal className="h-3 w-3" />
                    {hidden} thêm
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── WeekDayGrid (shared by week & day views) ─────────────────────────────────
function WeekDayGrid({ displayDates, todayISO, eventsByDate, onSlotClick, onEventClick }: {
  displayDates: Date[]
  todayISO: string
  eventsByDate: Record<string, CalendarEvent[]>
  onSlotClick: (date: Date, hour: number) => void
  onEventClick: (ev: CalendarEvent) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to current time on first render
  useEffect(() => {
    if (!scrollRef.current) return
    const now = new Date()
    const top = ((now.getHours() * 60 + now.getMinutes()) / 60) * PX_PER_HOUR
    scrollRef.current.scrollTop = Math.max(0, top - 120)
  }, [])

  const numCols = displayDates.length
  const gridCols = `3rem repeat(${numCols}, 1fr)`

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm">
      {/* Day headers */}
      <div className="grid border-b border-zinc-100 bg-zinc-50/60" style={{ gridTemplateColumns: gridCols }}>
        <div />
        {displayDates.map(date => {
          const iso     = toISO(date)
          const isToday = iso === todayISO
          return (
            <div key={iso} className="flex flex-col items-center gap-0.5 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {DAY_SHORT[date.getDay()]}
              </span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-emerald-600 text-white' : 'text-zinc-700'}`}>
                {date.getDate()}
              </span>
              {(eventsByDate[iso]?.length ?? 0) > 0 && (
                <span className={`h-1 w-1 rounded-full ${isToday ? 'bg-white/60' : 'bg-emerald-400'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="relative overflow-y-auto" style={{ maxHeight: '90vh' }}>
        <div className="grid" style={{ gridTemplateColumns: gridCols, height: 24 * PX_PER_HOUR }}>
          {/* Hour labels */}
          <div className="relative select-none">
            {HOURS.map(h => (
              <div key={h} className="absolute right-2 text-[10px] font-medium text-zinc-400 tabular-nums" style={{ top: h * PX_PER_HOUR - 7 }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {displayDates.map(date => {
            const iso     = toISO(date)
            const isToday = iso === todayISO
            const laid    = computeLayout(eventsByDate[iso] ?? [])

            return (
              <div key={iso} className="relative border-l border-zinc-100" style={{ height: 24 * PX_PER_HOUR }}>
                {HOURS.map(h => (
                  <div
                    key={h}
                    className={`absolute inset-x-0 cursor-pointer border-t transition-colors hover:bg-emerald-50/50 ${isToday ? 'border-emerald-50' : 'border-zinc-100'}`}
                    style={{ top: h * PX_PER_HOUR, height: PX_PER_HOUR }}
                    onClick={() => onSlotClick(date, h)}
                  />
                ))}

                {laid.map(ev => (
                  <EventBlock key={ev.id} event={ev} col={ev.col} totalCols={ev.totalCols} onClick={() => onEventClick(ev)} />
                ))}

                {isToday && <CurrentTimeIndicator scrollRef={scrollRef} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface CalendarViewProps {
  events: CalendarEvent[]
  onEventsChange: () => void
}

export function CalendarView({ events, onEventsChange }: CalendarViewProps) {
  const today    = new Date()
  const todayISO = toISO(today)

  // ── View state ──────────────────────────────────────────────────────────────
  const [viewMode,     setViewMode]     = useState<ViewMode>('month')
  const [showMiniNav,  setShowMiniNav]  = useState(false)
  const [monthYear,    setMonthYear]    = useState(today.getFullYear())
  const [monthMonth,   setMonthMonth]   = useState(today.getMonth())
  const [weekAnchor,   setWeekAnchor]   = useState(() => new Date())
  const [selectedDay,  setSelectedDay]  = useState(() => new Date())

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [modal,        setModal]        = useState<ModalState>(null)
  const [form,         setForm]         = useState<EventForm>({
    title: '', description: '', date: todayISO,
    start_time: '09:00', end_time: '10:00', color: 'emerald',
    recurrence: DEFAULT_RECURRENCE,
  })
  const [saving,       setSaving]       = useState(false)

  // ── Delete / recurring scope state ──────────────────────────────────────────
  const [deleteTarget,      setDeleteTarget]      = useState<CalendarEvent | null>(null)
  const [deleting,          setDeleting]          = useState(false)
  const [scopeAction,       setScopeAction]       = useState<'edit' | 'delete' | null>(null)
  const [pendingEditScope,  setPendingEditScope]  = useState(false) // waiting for scope selection before save

  // ── Events by date ──────────────────────────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
    }
    return map
  }, [events])

  // ── Week dates ──────────────────────────────────────────────────────────────
  const weekDates    = useMemo(() => getWeekDates(weekAnchor), [weekAnchor])
  const displayDates = viewMode === 'week' ? weekDates : [selectedDay]

  // ── Header label ────────────────────────────────────────────────────────────
  const headerLabel = useMemo(() => {
    if (viewMode === 'month')
      return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date(monthYear, monthMonth))
    if (viewMode === 'day')
      return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(selectedDay)
    return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(weekDates[3])
  }, [viewMode, monthYear, monthMonth, weekDates, selectedDay])

  // ── Navigation ──────────────────────────────────────────────────────────────
  function prevPeriod() {
    if (viewMode === 'month') {
      if (monthMonth === 0) { setMonthYear(y => y - 1); setMonthMonth(11) }
      else setMonthMonth(m => m - 1)
    } else if (viewMode === 'week') {
      setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
    } else {
      setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
    }
  }

  function nextPeriod() {
    if (viewMode === 'month') {
      if (monthMonth === 11) { setMonthYear(y => y + 1); setMonthMonth(0) }
      else setMonthMonth(m => m + 1)
    } else if (viewMode === 'week') {
      setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
    } else {
      setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
    }
  }

  function goToday() {
    setMonthYear(today.getFullYear())
    setMonthMonth(today.getMonth())
    setWeekAnchor(new Date())
    setSelectedDay(new Date())
  }

  function switchToDay(date: Date) {
    setSelectedDay(date)
    setWeekAnchor(date)
    setViewMode('day')
  }

  // ── Modal helpers ───────────────────────────────────────────────────────────
  function openCreate(date: Date, hour = today.getHours()) {
    const start = `${String(hour).padStart(2, '0')}:00`
    const end   = minToTime(Math.min((hour + 1) * 60, 23 * 60))
    setForm({ title: '', description: '', date: toISO(date), start_time: start, end_time: end, color: 'emerald', recurrence: DEFAULT_RECURRENCE })
    setModal({ mode: 'create' })
  }

  function openEdit(ev: CalendarEvent) {
    setForm({ title: ev.title, description: ev.description || '', date: ev.date, start_time: ev.start_time, end_time: ev.end_time, color: ev.color || 'emerald', recurrence: DEFAULT_RECURRENCE })
    setModal({ mode: 'edit', event: ev })
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function saveEvent(recurringScope?: RecurringScope) {
    if (!form.title.trim()) { toast.error('Vui lòng nhập tiêu đề'); return }
    if (timeToMin(form.start_time) >= timeToMin(form.end_time)) { toast.error('Giờ kết thúc phải sau giờ bắt đầu'); return }

    // If editing a recurring event and scope not yet chosen, ask first
    if (modal?.mode === 'edit' && modal.event.is_recurring && !recurringScope) {
      setPendingEditScope(true)
      setScopeAction('edit')
      return
    }

    setSaving(true)
    try {
      if (modal?.mode === 'create') {
        const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
        const isRecurring = form.recurrence.type !== 'none'

        if (isRecurring) {
          const occurrences  = generateOccurrences(form.date, form.recurrence)
          const recurrenceId = crypto.randomUUID()
          const rows = occurrences.map(date => ({
            user_id: user?.id,
            title: form.title.trim(),
            description: form.description.trim() || null,
            date, start_time: form.start_time, end_time: form.end_time,
            color: form.color,
            recurrence_id: recurrenceId,
            is_recurring: true,
          }))
          // Insert in batches of 50 to avoid request size limits
          for (let i = 0; i < rows.length; i += 50) {
            const { error } = await supabase.from('calendar_events').insert(rows.slice(i, i + 50))
            if (error) throw error
          }
          toast.success(`Đã tạo ${occurrences.length} sự kiện lặp lại`)
        } else {
          const { error } = await supabase.from('calendar_events').insert([{
            user_id: user?.id,
            title: form.title.trim(),
            description: form.description.trim() || null,
            date: form.date, start_time: form.start_time, end_time: form.end_time,
            color: form.color, is_recurring: false,
          }])
          if (error) throw error
          toast.success('Đã thêm sự kiện')
        }
      } else if (modal?.mode === 'edit') {
        const payload = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          start_time: form.start_time, end_time: form.end_time,
          color: form.color, updated_at: new Date().toISOString(),
        }
        if (recurringScope === 'all' && modal.event.recurrence_id) {
          const { error } = await supabase.from('calendar_events').update(payload).eq('recurrence_id', modal.event.recurrence_id)
          if (error) throw error
          toast.success('Đã cập nhật toàn bộ chuỗi sự kiện')
        } else {
          const { error } = await supabase.from('calendar_events').update({ ...payload, date: form.date }).eq('id', modal.event.id)
          if (error) throw error
          toast.success('Đã cập nhật sự kiện')
        }
      }
      setModal(null)
      setScopeAction(null)
      setPendingEditScope(false)
      onEventsChange()
    } catch {
      toast.error('Có lỗi xảy ra, thử lại!')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(recurringScope?: RecurringScope) {
    if (!deleteTarget) return

    // If recurring and scope not chosen, ask first
    if (deleteTarget.is_recurring && !recurringScope) {
      setScopeAction('delete')
      return
    }

    setDeleting(true)
    try {
      if (recurringScope === 'all' && deleteTarget.recurrence_id) {
        const { error } = await supabase.from('calendar_events').delete().eq('recurrence_id', deleteTarget.recurrence_id)
        if (error) throw error
        toast.success('Đã xoá toàn bộ chuỗi sự kiện')
      } else {
        const { error } = await supabase.from('calendar_events').delete().eq('id', deleteTarget.id)
        if (error) throw error
        toast.success('Đã xoá sự kiện')
      }
      setDeleteTarget(null)
      setScopeAction(null)
      setModal(null)
      onEventsChange()
    } catch {
      toast.error('Có lỗi xảy ra')
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="relative flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={prevPeriod} aria-label="Trước">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday} className="h-7 text-xs">
            Hôm nay
          </Button>
          <Button variant="outline" size="icon-sm" onClick={nextPeriod} aria-label="Tiếp">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Month/year label — click to open mini calendar picker */}
        <button
          onClick={() => setShowMiniNav(v => !v)}
          className="flex flex-1 items-center justify-center gap-1 text-sm font-semibold capitalize text-zinc-700 hover:text-emerald-700 sm:text-base"
        >
          {headerLabel}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform text-zinc-400 ${showMiniNav ? 'rotate-180' : ''}`} />
        </button>

        {/* Mini calendar navigator popover */}
        {showMiniNav && (
          <MiniCalendarNav
            anchorYear={monthYear}
            anchorMonth={monthMonth}
            todayISO={todayISO}
            activeISO={toISO(selectedDay)}
            onDateSelect={date => {
              setMonthYear(date.getFullYear())
              setMonthMonth(date.getMonth())
              switchToDay(date)
            }}
            onClose={() => setShowMiniNav(false)}
          />
        )}

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
            {(['month', 'week', 'day'] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === v ? 'bg-white text-emerald-700 shadow-sm' : 'text-zinc-400 hover:text-zinc-700'}`}
              >
                {v === 'month' ? 'Tháng' : v === 'week' ? 'Tuần' : 'Ngày'}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => openCreate(viewMode === 'day' ? selectedDay : today)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Thêm</span>
          </Button>
        </div>
      </div>

      {/* Month view */}
      {viewMode === 'month' && (
        <MonthView
          year={monthYear}
          month={monthMonth}
          todayISO={todayISO}
          eventsByDate={eventsByDate}
          onDayClick={date => {
            if (eventsByDate[toISO(date)]?.length) switchToDay(date)
            else openCreate(date)
          }}
          onEventClick={openEdit}
        />
      )}

      {/* Week / Day view */}
      {(viewMode === 'week' || viewMode === 'day') && (
        <>
          <WeekDayGrid
            displayDates={displayDates}
            todayISO={todayISO}
            eventsByDate={eventsByDate}
            onSlotClick={openCreate}
            onEventClick={openEdit}
          />
          <button
            onClick={() => setViewMode('month')}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-emerald-600"
          >
            <ChevronLeft className="h-3 w-3" /> Quay lại tháng
          </button>
        </>
      )}

      {/* Event create/edit modal */}
      <EventModal
        modal={modal}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={() => saveEvent()}
        onDelete={() => {
          if (modal?.mode === 'edit') {
            setDeleteTarget(modal.event)
            handleDelete()
          }
        }}
        onClose={() => setModal(null)}
      />

      {/* Recurring scope picker (edit) */}
      {pendingEditScope && scopeAction === 'edit' && (
        <RecurringScopeModal
          action="edit"
          onSelect={scope => { setPendingEditScope(false); setScopeAction(null); saveEvent(scope) }}
          onCancel={() => { setPendingEditScope(false); setScopeAction(null) }}
        />
      )}

      {/* Recurring scope picker (delete) */}
      {scopeAction === 'delete' && deleteTarget && (
        <RecurringScopeModal
          action="delete"
          onSelect={scope => { setScopeAction(null); handleDelete(scope) }}
          onCancel={() => { setScopeAction(null); setDeleteTarget(null) }}
        />
      )}

      {/* Non-recurring delete confirm */}
      <ConfirmModal
        open={!!deleteTarget && !deleteTarget.is_recurring && scopeAction !== 'delete'}
        itemContent={deleteTarget?.title}
        loading={deleting}
        onConfirm={() => handleDelete('single')}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
