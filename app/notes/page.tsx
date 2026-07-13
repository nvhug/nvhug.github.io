'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  Check,
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
import { Note } from '@/types'
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

const textareaClass =
  'w-full resize-y rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400'

const autoTextareaClass =
  'w-full min-h-24 resize-none overflow-y-hidden rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400'

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([])
  const [pinnedDraft, setPinnedDraft] = useState('')
  const [savingPinned, setSavingPinned] = useState(false)
  const [deletingPinnedId, setDeletingPinnedId] = useState<string | null>(null)
  const [notifyEditId, setNotifyEditId] = useState<string | null>(null)
  const [notifyDraftTime, setNotifyDraftTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchNotes(false)
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

  async function addNotifyTime(habit: Note) {
    if (!notifyDraftTime) return
    const updated = [...new Set([...(habit.notify_times || []), notifyDraftTime])].sort()
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
    }),
    [notes]
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

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
          </div>
        </section>

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
              <div key={habit.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 shadow-[0_1px_0_0_rgba(16,185,129,0.08)]">
                <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <span className="min-w-0 flex-1 text-sm text-zinc-700">{habit.content}</span>
                <div className="flex flex-wrap items-center gap-1">
                  {(habit.notify_times || []).map((time) => (
                    <span key={time} className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <Bell className="h-2.5 w-2.5" />
                      {time}
                      <button
                        type="button"
                        onClick={() => removeNotifyTime(habit, time)}
                        className="ml-0.5 rounded-full hover:text-rose-500 transition-colors"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  {notifyEditId === habit.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        type="time"
                        value={notifyDraftTime}
                        onChange={(e) => setNotifyDraftTime(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); addNotifyTime(habit) }
                          if (e.key === 'Escape') setNotifyEditId(null)
                        }}
                        className="w-24 rounded-md border border-emerald-300 bg-white px-1.5 py-0.5 text-xs text-zinc-800 outline-none focus:border-emerald-500"
                      />
                      <button type="button" onClick={() => addNotifyTime(habit)} className="text-emerald-600 hover:text-emerald-700">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setNotifyEditId(null)} className="text-zinc-400 hover:text-zinc-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setNotifyEditId(habit.id); setNotifyDraftTime('') }}
                      className="rounded-full border border-dashed border-emerald-200 p-1 text-emerald-400 transition-colors hover:border-emerald-400 hover:text-emerald-600"
                      title="Thêm giờ thông báo"
                    >
                      <Bell className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  disabled={deletingPinnedId === habit.id}
                  onClick={() => deleteHabit(habit.id)}
                  className="rounded p-0.5 text-zinc-300 transition-colors hover:text-rose-400 disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
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
      </div>
      <ConfirmModal
        open={!!deleteTarget}
        itemContent={deleteTarget?.content}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  )
}
