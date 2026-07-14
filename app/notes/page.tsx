'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  Check,
  CheckCircle2,
  Circle,
  ListTodo,
  NotebookPen,
  Pencil,
  Pin,
  Plus,
  Sparkles,
  Star,
  ThumbsDown,
  Trash2,
  X,
} from 'lucide-react'

import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { Note, Todo } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { TagInput } from '@/components/ui/tag-input'

type TypeFilter = 'all' | 'good' | 'bad'

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatNoteDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

type Draft = {
  note_date: string
  content: string
  type: 'good' | 'bad'
  priority: number
  completion_percentage: number
  tags: string[]
  hide_meta: boolean
}

type EditDraft = Omit<Draft, 'note_date'> & { hide_meta: boolean }

const NOTIFY_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

const WORK_HOURLY_NOTIFY_OPTION = '__work-hourly__'

const WORK_HOURLY_NOTIFY_TIMES = Array.from({ length: 10 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`).filter(
  (time) => time !== '12:00' && time !== '17:00'
)

function hasWorkHourlySchedule(times: string[]) {
  return WORK_HOURLY_NOTIFY_TIMES.every((t) => times.includes(t))
}

function stripWorkHourlyTimes(times: string[]) {
  return times.filter((t) => !WORK_HOURLY_NOTIFY_TIMES.includes(t))
}

const textareaClass =
  'w-full resize-y rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400'

const autoTextareaClass =
  'w-full min-h-24 resize-none overflow-y-hidden rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400'

type TabType = 'notes' | 'todos'

export default function NotesPage() {
  const [currentTab, setCurrentTab] = useState<TabType>('notes')

  const [notes, setNotes] = useState<Note[]>([])
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([])
  const [pinnedDraft, setPinnedDraft] = useState('')
  const [savingPinned, setSavingPinned] = useState(false)
  const [deletingPinnedId, setDeletingPinnedId] = useState<string | null>(null)
  const [notifyEditId, setNotifyEditId] = useState<string | null>(null)
  const [notifyDraftTime, setNotifyDraftTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const [todos, setTodos] = useState<Todo[]>([])
  const [todoDraft, setTodoDraft] = useState('')
  const [savingTodo, setSavingTodo] = useState(false)
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'done'>('all')
  const [deleteTodo, setDeleteTodo] = useState<Todo | null>(null)
  const [deletingTodo, setDeletingTodo] = useState(false)

  const [editingHabitId, setEditingHabitId] = useState<string | null>(null)
  const [editingHabitDraft, setEditingHabitDraft] = useState('')
  const [savingHabit, setSavingHabit] = useState(false)
  const habitInputRef = useRef<HTMLInputElement | null>(null)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<EditDraft | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [percentEditId, setPercentEditId] = useState<string | null>(null)
  const [percentEditValue, setPercentEditValue] = useState('')
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const el = editTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editingId, editingDraft?.content])

  async function fetchNotes(withLoading = true) {
    if (withLoading) {
      setLoading(true)
    }
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('note_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      const all = (data || []) as Note[]
      setPinnedNotes(all.filter((n) => n.pinned))
      setNotes(all.filter((n) => !n.pinned))
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchTodos() {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTodos((data || []) as Todo[])
    } catch (error) {
      console.error('Error fetching todos:', error)
    }
  }

  async function addTodo() {
    const content = todoDraft.trim()
    if (!content) return

    setSavingTodo(true)
    try {
      const { error } = await supabase.from('todos').insert([{
        content,
        is_done: false,
        priority: 3,
      }])
      if (error) throw error
      setTodoDraft('')
      await fetchTodos()
      toast.success('Thêm việc cần làm thành công.')
    } catch {
      toast.error('Không thể thêm việc cần làm.')
    } finally {
      setSavingTodo(false)
    }
  }

  async function toggleTodo(todo: Todo) {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ is_done: !todo.is_done })
        .eq('id', todo.id)

      if (error) throw error
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !t.is_done } : t)))
    } catch {
      toast.error('Không thể cập nhật.')
    }
  }

  async function confirmDeleteTodo() {
    if (!deleteTodo) return
    setDeletingTodo(true)
    try {
      const { error } = await supabase.from('todos').delete().eq('id', deleteTodo.id)
      if (error) throw error
      setTodos((prev) => prev.filter((t) => t.id !== deleteTodo.id))
      setDeleteTodo(null)
      toast.success('Đã xoá việc cần làm.')
    } catch {
      toast.error('Không thể xoá.')
    } finally {
      setDeletingTodo(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchNotes(false)
      void fetchTodos()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  function openDraft() {
    setDraft({
      note_date: todayDate(),
      content: '',
      type: 'good',
      priority: 3,
      completion_percentage: 0,
      tags: [],
      hide_meta: true,
    })
  }

  function cancelDraft() {
    setDraft(null)
  }

  async function addHabit() {
    const content = pinnedDraft.trim()
    if (!content) return
    setSavingPinned(true)
    try {
      const { error } = await supabase.from('notes').insert([{
        note_date: todayDate(),
        content,
        type: 'good',
        status: 'in_progress',
        priority: 5,
        completion_percentage: 0,
        tags: [],
        hide_meta: true,
        pinned: true,
      }])
      if (error) throw error
      setPinnedDraft('')
      await fetchNotes(false)
    } catch {
      toast.error('Không thể thêm thói quen.')
    } finally {
      setSavingPinned(false)
    }
  }

  async function deleteHabit(id: string) {
    setDeletingPinnedId(id)
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
      setPinnedNotes((prev) => prev.filter((n) => n.id !== id))
    } catch {
      toast.error('Không thể xoá thói quen.')
    } finally {
      setDeletingPinnedId(null)
    }
  }

  function startEditingHabit(habit: Note) {
    setEditingHabitId(habit.id)
    setEditingHabitDraft(habit.content)
  }

  function cancelEditingHabit() {
    setEditingHabitId(null)
    setEditingHabitDraft('')
  }

  async function saveEditingHabit(habit: Note) {
    const content = editingHabitDraft.trim()
    if (!content) {
      toast.error('Nội dung không được để trống.')
      return
    }

    setSavingHabit(true)
    try {
      const { error } = await supabase.from('notes').update({ content }).eq('id', habit.id)
      if (error) throw error
      setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, content } : n)))
      setEditingHabitId(null)
      setEditingHabitDraft('')
      toast.success('Cập nhật thói quen thành công.')
    } catch {
      toast.error('Không thể cập nhật thói quen.')
    } finally {
      setSavingHabit(false)
    }
  }

  async function addNotifyTime(habit: Note) {
    if (!notifyDraftTime) return
    const currentTimes = habit.notify_times || []
    const nextTimes =
      notifyDraftTime === WORK_HOURLY_NOTIFY_OPTION
        ? [...currentTimes, ...WORK_HOURLY_NOTIFY_TIMES]
        : [...currentTimes, notifyDraftTime]

    const updated = [...new Set(nextTimes)].sort()

    if (updated.length === currentTimes.length) {
      setNotifyEditId(null)
      setNotifyDraftTime('')
      toast.error('Khung giờ này đã được thêm trước đó.')
      return
    }

    setNotifyEditId(null)
    setNotifyDraftTime('')
    setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: updated } : n)))
    try {
      const { error } = await supabase.from('notes').update({ notify_times: updated }).eq('id', habit.id)
      if (error) throw error
    } catch {
      toast.error('Không thể cập nhật giờ thông báo.')
      setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: habit.notify_times } : n)))
    }
  }

  async function removeNotifyTime(habit: Note, time: string) {
    const updated = (habit.notify_times || []).filter((t) => t !== time)
    setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: updated } : n)))
    try {
      const { error } = await supabase.from('notes').update({ notify_times: updated }).eq('id', habit.id)
      if (error) throw error
    } catch {
      toast.error('Không thể cập nhật.')
      setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: habit.notify_times } : n)))
    }
  }

  async function removeWorkHourlyNotify(habit: Note) {
    const updated = stripWorkHourlyTimes(habit.notify_times || [])
    setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: updated } : n)))
    try {
      const { error } = await supabase.from('notes').update({ notify_times: updated }).eq('id', habit.id)
      if (error) throw error
    } catch {
      toast.error('Không thể cập nhật.')
      setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: habit.notify_times } : n)))
    }
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  async function saveDraft() {
    if (!draft) return
    const content = draft.content.trim()
    if (!content) return

    setSavingDraft(true)
    try {
      const { error } = await supabase.from('notes').insert([
        {
          note_date: draft.note_date,
          content,
          type: draft.type,
          status: 'in_progress',
          priority: draft.priority,
          completion_percentage: draft.completion_percentage,
          tags: draft.tags,
          hide_meta: draft.hide_meta,
        },
      ])
      if (error) throw error
      setDraft(null)
      await fetchNotes()
    } catch (error) {
      console.error('Error creating note:', error)
      toast.error('Không thể thêm note.')
    } finally {
      setSavingDraft(false)
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id)
    setEditingDraft({
      content: note.content,
      type: note.type,
      priority: note.priority ?? 3,
      completion_percentage: note.completion_percentage ?? 0,
      tags: note.tags ?? [],
      hide_meta: note.hide_meta ?? false,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingDraft(null)
  }

  function updateEditingDraft(patch: Partial<EditDraft>) {
    setEditingDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  async function saveEdit(note: Note) {
    if (!editingDraft) return
    const content = editingDraft.content.trim()
    if (!content) return

    const update = {
      content,
      type: editingDraft.type,
      priority: editingDraft.priority,
      completion_percentage: editingDraft.completion_percentage,
      tags: editingDraft.tags,
      hide_meta: editingDraft.hide_meta,
    }

    setBusyId(note.id)
    try {
      const { error } = await supabase.from('notes').update(update).eq('id', note.id)
      if (error) throw error
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, ...update } : n)))
      cancelEdit()
    } catch (error) {
      console.error('Error updating note:', error)
      toast.error('Không thể cập nhật note.')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('notes').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('Đã xoá note.')
    } catch (error) {
      console.error('Error deleting note:', error)
      toast.error('Không thể xoá note.')
    } finally {
      setDeleting(false)
    }
  }

  async function updatePriority(note: Note, priority: number) {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, priority } : n)))
    try {
      const { error } = await supabase.from('notes').update({ priority }).eq('id', note.id)
      if (error) throw error
    } catch {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, priority: note.priority } : n)))
      toast.error('Không thể cập nhật.')
    }
  }

  async function savePercentage(note: Note) {
    const pct = Math.min(100, Math.max(0, Number(percentEditValue) || 0))
    setPercentEditId(null)
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, completion_percentage: pct } : n)))
    try {
      const { error } = await supabase.from('notes').update({ completion_percentage: pct }).eq('id', note.id)
      if (error) throw error
    } catch {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, completion_percentage: note.completion_percentage } : n)))
      toast.error('Không thể cập nhật.')
    }
  }

  const counts = useMemo(
    () => ({
      all: notes.length,
      good: notes.filter((n) => n.type === 'good').length,
      bad: notes.filter((n) => n.type === 'bad').length,
      todos: todos.length,
      pendingTodos: todos.filter((t) => !t.is_done).length,
    }),
    [notes, todos]
  )

  const filteredNotes = notes.filter((note) => {
    if (typeFilter !== 'all' && note.type !== typeFilter) return false
    return true
  })

  const groups = useMemo(() => {
    const map = new Map<string, Note[]>()
    filteredNotes.forEach((note) => {
      const list = map.get(note.note_date) ?? []
      list.push(note)
      map.set(note.note_date, list)
    })
    return Array.from(map, ([date, items]) => {
      const sorted = [...items].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      return { date, items: sorted, maxPriority: sorted[0]?.priority ?? 0 }
    }).sort((a, b) => b.maxPriority - a.maxPriority)
  }, [filteredNotes])

  const allTags = useMemo(
    () => [...new Set(notes.flatMap((n) => n.tags ?? []))].sort(),
    [notes]
  )

  const typeTabs: { key: TypeFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tất cả', count: counts.all },
    { key: 'good', label: 'Việc tốt', count: counts.good },
    { key: 'bad', label: 'Chưa tốt', count: counts.bad },
  ]

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_35%),radial-gradient(circle_at_80%_18%,rgba(52,211,153,0.16),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f6fef9_100%)] px-4 pb-10 pt-24 text-zinc-900 sm:px-6 sm:pt-28">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#ffffff_0%,#f7fef9_45%,#ecfdf5_100%)] p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.45)]">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_16px_28px_-16px_rgba(16,185,129,0.9)]">
              <NotebookPen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Nhật ký</p>
              <h2 className="mt-1 font-poppins text-2xl font-semibold leading-tight text-zinc-900">Notes cá nhân</h2>
              <p className="mt-1 text-sm text-zinc-600">Ghi lại thói quen tốt/xấu mỗi ngày và theo dõi tiến độ cải thiện.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <article className="rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_1px_0_0_rgba(16,185,129,0.15)]">
              <p className="text-xs font-medium text-zinc-600">Tổng số</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-zinc-900">{counts.all}</p>
            </article>
            <article className="rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_1px_0_0_rgba(16,185,129,0.15)]">
              <p className="text-xs font-medium text-zinc-600">Việc tốt</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-emerald-600">{counts.good}</p>
            </article>
            <article className="rounded-xl border border-amber-100 bg-white p-3 shadow-[0_1px_0_0_rgba(217,119,6,0.15)]">
              <p className="text-xs font-medium text-zinc-600">Chưa tốt</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-amber-600">{counts.bad}</p>
            </article>
            <article className="rounded-xl border border-blue-100 bg-white p-3 shadow-[0_1px_0_0_rgba(59,130,246,0.15)]">
              <p className="text-xs font-medium text-zinc-600">Cần làm</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-blue-600">{counts.pendingTodos}</p>
            </article>
          </div>
        </section>

        <div className="flex gap-2 border-b border-emerald-200">
          <button
            onClick={() => setCurrentTab('notes')}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              currentTab === 'notes'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <NotebookPen className="h-4 w-4" />
              Notes
            </span>
          </button>
          <button
            onClick={() => setCurrentTab('todos')}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              currentTab === 'todos'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Todos
            </span>
          </button>
        </div>

        {currentTab === 'notes' && (
        <>
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
          <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3">
            <Pin className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Thói quen hằng ngày</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {pinnedNotes.length === 0 && !savingPinned && (
              <p className="text-xs text-zinc-400 italic">Chưa có thói quen nào. Thêm bên dưới.</p>
            )}
            {pinnedNotes.map((habit) => (
              <div key={habit.id} className="group flex flex-col gap-2 rounded-xl border border-emerald-100 border-l-2 border-l-emerald-300 bg-white px-3 py-2.5 shadow-[0_1px_4px_0_rgba(16,185,129,0.06)] transition-shadow hover:shadow-[0_3px_10px_0_rgba(16,185,129,0.12)] sm:flex-row sm:items-start">
                {editingHabitId === habit.id ? (
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <input
                      ref={habitInputRef}
                      type="text"
                      autoFocus
                      value={editingHabitDraft}
                      onChange={(e) => setEditingHabitDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void saveEditingHabit(habit)
                        } else if (e.key === 'Escape') {
                          cancelEditingHabit()
                        }
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500"
                      placeholder="Thói quen..."
                    />
                    <div className="flex items-center gap-1 sm:ml-auto">
                      <button
                        type="button"
                        onClick={() => void saveEditingHabit(habit)}
                        disabled={savingHabit || !editingHabitDraft.trim()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Lưu"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingHabit}
                        disabled={savingHabit}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white hover:text-zinc-700 disabled:opacity-40"
                        aria-label="Huỷ"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    onDoubleClick={() => startEditingHabit(habit)}
                    className="min-w-0 cursor-pointer text-sm font-medium leading-6 text-zinc-700 wrap-break-word transition-colors hover:text-zinc-900 sm:flex-1 sm:pr-2"
                  >
                    {habit.content}
                  </p>
                )}
                <div className="flex items-start gap-2 sm:ml-auto sm:max-w-[70%]">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:justify-end sm:overflow-x-auto sm:pb-0.5">
                  {hasWorkHourlySchedule(habit.notify_times || []) && (
                    <span className="group/chip inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] whitespace-nowrap">
                      <Bell className="h-2.5 w-2.5" />
                      Mỗi 1 giờ (08:00-17:00)
                      <button
                        type="button"
                        onClick={() => removeWorkHourlyNotify(habit)}
                        className="ml-0.5 rounded-full text-emerald-300 opacity-0 transition-opacity group-hover/chip:opacity-100 hover:text-rose-400"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  )}
                  {stripWorkHourlyTimes(habit.notify_times || []).map((time) => (
                    <span key={time} className="group/chip inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] whitespace-nowrap">
                      <Bell className="h-2.5 w-2.5" />
                      {time}
                      <button
                        type="button"
                        onClick={() => removeNotifyTime(habit, time)}
                        className="ml-0.5 rounded-full text-emerald-300 opacity-0 transition-opacity group-hover/chip:opacity-100 hover:text-rose-400"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  {notifyEditId === habit.id ? (
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      <select
                        autoFocus
                        value={notifyDraftTime}
                        onChange={(e) => setNotifyDraftTime(e.target.value)}
                        className="h-8 min-w-28 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
                      >
                        <option value="">Chọn giờ...</option>
                        <option
                          value={WORK_HOURLY_NOTIFY_OPTION}
                          disabled={hasWorkHourlySchedule(habit.notify_times || [])}
                        >
                          Mỗi 1 giờ (08:00-17:00, trừ 12:00 & 17:00)
                        </option>
                        {NOTIFY_TIME_OPTIONS.map((t) => (
                          <option key={t} value={t} disabled={(habit.notify_times || []).includes(t)}>
                            {t}{(habit.notify_times || []).includes(t) ? ' (đã có)' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => addNotifyTime(habit)}
                        disabled={
                          !notifyDraftTime ||
                          (notifyDraftTime !== WORK_HOURLY_NOTIFY_OPTION && (habit.notify_times || []).includes(notifyDraftTime))
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Lưu giờ thông báo"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifyEditId(null)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white hover:text-zinc-700"
                        aria-label="Huỷ chọn giờ thông báo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setNotifyEditId(habit.id); setNotifyDraftTime('') }}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-emerald-200 px-2.5 py-0.5 text-xs text-emerald-400 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 whitespace-nowrap"
                    >
                      <Bell className="h-2.5 w-2.5" />
                      Thêm giờ
                    </button>
                  )}
                  </div>
                  <button
                    type="button"
                    disabled={deletingPinnedId === habit.id}
                    onClick={() => deleteHabit(habit.id)}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-300 opacity-20 transition-opacity group-hover:opacity-100 hover:text-rose-400 disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <form
              onSubmit={(e) => { e.preventDefault(); addHabit() }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={pinnedDraft}
                onChange={(e) => setPinnedDraft(e.target.value)}
                placeholder="Thêm thói quen mới..."
                className="flex-1 rounded-lg border border-dashed border-emerald-200 bg-transparent px-3 py-1.5 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white"
              />
              <button
                type="submit"
                disabled={savingPinned || !pinnedDraft.trim()}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm
              </button>
            </form>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
          <div className="border-b border-emerald-100 px-4 py-3.5">
            {draft ? (
              <div className="flex flex-col gap-2 rounded-xl border-l-4 border-dashed border-emerald-300 bg-emerald-50/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    value={draft.note_date}
                    onChange={(e) => updateDraft({ note_date: e.target.value })}
                    className="h-8 w-auto border-emerald-200 bg-white text-zinc-900"
                  />
                  <div className="inline-flex overflow-hidden rounded-lg border border-emerald-200">
                    <button
                      type="button"
                      onClick={() => updateDraft({ type: 'good' })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                        draft.type === 'good' ? 'bg-emerald-500 text-white' : 'bg-white text-zinc-600 hover:bg-emerald-50'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Tốt
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDraft({ type: 'bad' })}
                      className={`inline-flex items-center gap-1.5 border-l border-emerald-200 px-3 py-1.5 text-sm font-medium transition-colors ${
                        draft.type === 'bad' ? 'bg-amber-500 text-white' : 'bg-white text-zinc-600 hover:bg-amber-50'
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      Chưa tốt
                    </button>
                  </div>
                  <div className="inline-flex items-center gap-0.5">
                    {([1, 2, 3, 4, 5] as const).map((star) => (
                      <button key={star} type="button" onClick={() => updateDraft({ priority: star })}>
                        <Star
                          className={`h-3.5 w-3.5 ${
                            star <= draft.priority ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={draft.completion_percentage}
                      onChange={(e) => updateDraft({ completion_percentage: Number(e.target.value) })}
                      className="w-48"
                    />
                    <span className="w-9 text-right text-xs font-medium text-zinc-600">{draft.completion_percentage}%</span>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 select-none">
                      <input
                        type="checkbox"
                        checked={draft.hide_meta}
                        onChange={(e) => updateDraft({ hide_meta: e.target.checked })}
                        className="h-3.5 w-3.5 accent-emerald-500"
                      />
                      Ẩn tiến độ
                    </label>
                  </div>
                </div>
                <textarea
                  autoFocus
                  rows={3}
                  value={draft.content}
                  onChange={(e) => updateDraft({ content: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') cancelDraft()
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      saveDraft()
                    }
                  }}
                  placeholder="Hôm nay bạn đã làm gì..."
                  className={textareaClass}
                />
                <TagInput
                  value={draft.tags}
                  onChange={(tags) => updateDraft({ tags })}
                  suggestions={allTags}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelDraft} className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
                    Huỷ
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingDraft || !draft.content.trim()}
                    onClick={saveDraft}
                    className="bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500"
                  >
                    <Check />
                    Lưu note
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={openDraft}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-300 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                <Plus className="h-4 w-4" />
                Thêm note mới
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100 px-4 py-3.5">
            {typeTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTypeFilter(tab.key)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  typeFilter === tab.key
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-emerald-100 text-zinc-600 hover:bg-emerald-50 hover:text-zinc-900'
                }`}
              >
                {tab.label}
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${
                    typeFilter === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-zinc-500">Đang tải...</div>
          ) : groups.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-500">Chưa có note nào.</div>
          ) : (
            <div className="divide-y divide-emerald-50">
              {groups.map((group) => (
                <div key={group.date} className="px-4 py-3.5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {formatNoteDate(group.date)}
                  </p>
                  <div className="space-y-2">
                    {group.items.map((note) => (
                      <div
                        key={note.id}
                        className={`flex items-start gap-3 rounded-xl border-l-4 px-3 py-2.5 ${
                          note.type === 'good' ? 'border-emerald-400' : 'border-amber-400'
                        } ${
                          note.priority === 5
                            ? 'bg-amber-50 shadow-[0_2px_10px_-3px_rgba(217,119,6,0.3)] ring-1 ring-amber-200'
                            : 'bg-white shadow-[0_1px_0_0_rgba(16,185,129,0.1)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1" onDoubleClick={() => editingId !== note.id && startEdit(note)}>
                          {editingId === note.id && editingDraft ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex overflow-hidden rounded-lg border border-emerald-200">
                                  <button
                                    type="button"
                                    onClick={() => updateEditingDraft({ type: 'good' })}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                                      editingDraft.type === 'good' ? 'bg-emerald-500 text-white' : 'bg-white text-zinc-600 hover:bg-emerald-50'
                                    }`}
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Tốt
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateEditingDraft({ type: 'bad' })}
                                    className={`inline-flex items-center gap-1.5 border-l border-emerald-200 px-3 py-1.5 text-sm font-medium transition-colors ${
                                      editingDraft.type === 'bad' ? 'bg-amber-500 text-white' : 'bg-white text-zinc-600 hover:bg-amber-50'
                                    }`}
                                  >
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                    Chưa tốt
                                  </button>
                                </div>
                                <div className="inline-flex items-center gap-0.5">
                                  {([1, 2, 3, 4, 5] as const).map((star) => (
                                    <button key={star} type="button" onClick={() => updateEditingDraft({ priority: star })}>
                                      <Star
                                        className={`h-3.5 w-3.5 ${
                                          star <= editingDraft.priority ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'
                                        }`}
                                      />
                                    </button>
                                  ))}
                                </div>
                                <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="10"
                                    value={editingDraft.completion_percentage}
                                    onChange={(e) => updateEditingDraft({ completion_percentage: Number(e.target.value) })}
                                    className="w-48"
                                  />
                                  <span className="w-9 text-right text-xs font-medium text-zinc-600">
                                    {editingDraft.completion_percentage}%
                                  </span>
                                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 select-none">
                                    <input
                                      type="checkbox"
                                      checked={editingDraft.hide_meta}
                                      onChange={(e) => updateEditingDraft({ hide_meta: e.target.checked })}
                                      className="h-3.5 w-3.5 accent-emerald-500"
                                    />
                                    Ẩn tiến độ
                                  </label>
                                </div>
                              </div>
                              <textarea
                                ref={editTextareaRef}
                                autoFocus
                                value={editingDraft.content}
                                onChange={(e) => updateEditingDraft({ content: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') cancelEdit()
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault()
                                    saveEdit(note)
                                  }
                                }}
                                className={autoTextareaClass}
                              />
                              <TagInput
                                value={editingDraft.tags}
                                onChange={(tags) => updateEditingDraft({ tags })}
                                suggestions={allTags}
                              />
                            </div>
                          ) : (
                            <>
                              <p className="whitespace-pre-wrap text-sm text-zinc-800">{note.content}</p>
                              {!note.hide_meta && <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-0.5">
                                  {([1, 2, 3, 4, 5] as const).map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() => updatePriority(note, star)}
                                      className="rounded hover:scale-110 transition-transform"
                                    >
                                      <Star
                                        className={`h-3.5 w-3.5 transition-colors ${
                                          star <= (note.priority ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 hover:text-amber-300'
                                        }`}
                                      />
                                    </button>
                                  ))}
                                </span>
                                {percentEditId === note.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      autoFocus
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={percentEditValue}
                                      onChange={(e) => setPercentEditValue(e.target.value)}
                                      onBlur={() => savePercentage(note)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') savePercentage(note)
                                        if (e.key === 'Escape') setPercentEditId(null)
                                      }}
                                      className="w-14 rounded-md border border-emerald-300 bg-white px-1.5 py-0.5 text-xs text-zinc-900 outline-none focus:border-emerald-500"
                                    />
                                    <span className="text-xs text-zinc-500">%</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => { setPercentEditId(note.id); setPercentEditValue(String(note.completion_percentage ?? 0)) }}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-emerald-300 hover:bg-emerald-50 ${
                                      note.completion_percentage
                                        ? 'border-zinc-200 bg-zinc-50 text-zinc-700'
                                        : 'border-dashed border-zinc-200 text-zinc-400'
                                    }`}
                                  >
                                    {note.completion_percentage ? `${note.completion_percentage}%` : '—'}
                                  </button>
                                )}
                              </div>}
                              {note.tags && note.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {(Array.isArray(note.tags) ? note.tags : []).map((tag: string, idx: number) => (
                                    <span key={idx} className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-700">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {editingId === note.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busyId === note.id || !editingDraft?.content.trim()}
                                onClick={() => saveEdit(note)}
                                className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
                              >
                                <Check />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={cancelEdit} className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
                                <X />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busyId === note.id}
                                onClick={() => startEdit(note)}
                                className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busyId === note.id}
                                onClick={() => setDeleteTarget(note)}
                                className="text-rose-300 hover:bg-rose-500/15"
                              >
                                <Trash2 />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </>
        )}

        {currentTab === 'todos' && (
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
          <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <ListTodo className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Việc cần làm</span>
            </div>
            <span className="text-xs font-medium text-emerald-600">{todos.length} việc</span>
          </div>

          <div className="px-4 py-3">
            <div className="mb-4 flex gap-2">
              {(['all', 'pending', 'done'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTodoFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    todoFilter === filter
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {filter === 'all' && 'Tất cả'}
                  {filter === 'pending' && 'Chưa làm'}
                  {filter === 'done' && 'Đã làm'}
                </button>
              ))}
            </div>

            <div className="space-y-2 mb-4">
              {todos
                .filter((t) => {
                  if (todoFilter === 'pending') return !t.is_done
                  if (todoFilter === 'done') return t.is_done
                  return true
                })
                .map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-white p-3 hover:bg-emerald-50 transition-colors"
                  >
                    <button
                      onClick={() => toggleTodo(todo)}
                      className="shrink-0 text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      {todo.is_done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-sm ${
                        todo.is_done ? 'line-through text-zinc-400' : 'text-zinc-900'
                      }`}
                    >
                      {todo.content}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTodo(todo)}
                      className="text-rose-300 hover:bg-rose-500/15"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}

              {todos.filter((t) => {
                if (todoFilter === 'pending') return !t.is_done
                if (todoFilter === 'done') return t.is_done
                return true
              }).length === 0 && (
                <div className="text-center py-8 text-zinc-500">
                  {todoFilter === 'all' && 'Chưa có việc cần làm nào.'}
                  {todoFilter === 'pending' && 'Tất cả việc đã xong!'}
                  {todoFilter === 'done' && 'Chưa có việc nào hoàn thành.'}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-emerald-100 pt-4">
              <Input
                type="text"
                placeholder="Thêm việc cần làm..."
                value={todoDraft}
                onChange={(e) => setTodoDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void addTodo()
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={() => void addTodo()}
                disabled={savingTodo || !todoDraft.trim()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Thêm
              </Button>
            </div>
          </div>
        </section>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        itemContent={deleteTarget?.content}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={!!deleteTodo}
        itemContent={deleteTodo?.content}
        loading={deletingTodo}
        onConfirm={confirmDeleteTodo}
        onCancel={() => setDeleteTodo(null)}
      />
    </main>
  )
}
