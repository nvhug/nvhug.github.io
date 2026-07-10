'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CircleCheck,
  Clock,
  NotebookPen,
  Pencil,
  Plus,
  Sparkles,
  ThumbsDown,
  Trash2,
  X,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { Note } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

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
  status: 'done' | 'in_progress'
}

const textareaClass =
  'w-full resize-y rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400'

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [onlyInProgress, setOnlyInProgress] = useState(false)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

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
      setNotes((data || []) as Note[])
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
    setDraft({ note_date: todayDate(), content: '', type: 'good', status: 'in_progress' })
  }

  function cancelDraft() {
    setDraft(null)
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
      const { error } = await supabase.from('notes').insert([{ ...draft, content }])
      if (error) throw error
      setDraft(null)
      await fetchNotes()
    } catch (error) {
      console.error('Error creating note:', error)
      alert('Không thể thêm note.')
    } finally {
      setSavingDraft(false)
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id)
    setEditingContent(note.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingContent('')
  }

  async function saveEdit(note: Note) {
    const content = editingContent.trim()
    if (!content || content === note.content) {
      cancelEdit()
      return
    }

    setBusyId(note.id)
    try {
      const { error } = await supabase.from('notes').update({ content }).eq('id', note.id)
      if (error) throw error
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, content } : n)))
      cancelEdit()
    } catch (error) {
      console.error('Error updating note:', error)
      alert('Không thể cập nhật note.')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleStatus(note: Note) {
    const status = note.status === 'done' ? 'in_progress' : 'done'
    setBusyId(note.id)
    try {
      const { error } = await supabase.from('notes').update({ status }).eq('id', note.id)
      if (error) throw error
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, status } : n)))
    } catch (error) {
      console.error('Error updating note status:', error)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(note: Note) {
    if (!confirm('Xoá note này?')) return

    setBusyId(note.id)
    try {
      const { error } = await supabase.from('notes').delete().eq('id', note.id)
      if (error) throw error
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
    } catch (error) {
      console.error('Error deleting note:', error)
    } finally {
      setBusyId(null)
    }
  }

  const counts = useMemo(
    () => ({
      all: notes.length,
      good: notes.filter((n) => n.type === 'good').length,
      bad: notes.filter((n) => n.type === 'bad').length,
      inProgress: notes.filter((n) => n.status === 'in_progress').length,
    }),
    [notes]
  )

  const filteredNotes = notes.filter((note) => {
    if (typeFilter !== 'all' && note.type !== typeFilter) return false
    if (onlyInProgress && note.status !== 'in_progress') return false
    return true
  })

  const groups = useMemo(() => {
    const map = new Map<string, Note[]>()
    filteredNotes.forEach((note) => {
      const list = map.get(note.note_date) ?? []
      list.push(note)
      map.set(note.note_date, list)
    })
    return Array.from(map, ([date, items]) => ({ date, items }))
  }, [filteredNotes])

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
            <article className="rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_1px_0_0_rgba(16,185,129,0.15)]">
              <p className="text-xs font-medium text-zinc-600">Đang cải thiện</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-zinc-900">{counts.inProgress}</p>
            </article>
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
                  <div className="inline-flex overflow-hidden rounded-lg border border-emerald-200">
                    <button
                      type="button"
                      onClick={() => updateDraft({ status: 'done' })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                        draft.status === 'done' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      <CircleCheck className="h-3.5 w-3.5" />
                      Đã làm
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDraft({ status: 'in_progress' })}
                      className={`inline-flex items-center gap-1.5 border-l border-emerald-200 px-3 py-1.5 text-sm font-medium transition-colors ${
                        draft.status === 'in_progress' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Dang dở
                    </button>
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
            <button
              onClick={() => setOnlyInProgress((v) => !v)}
              className={`ml-auto inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                onlyInProgress
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-emerald-100 text-zinc-600 hover:bg-emerald-50 hover:text-zinc-900'
              }`}
            >
              Chỉ hiện đang cải thiện
            </button>
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
                        className={`flex items-start gap-3 rounded-xl border-l-4 bg-white px-3 py-2.5 shadow-[0_1px_0_0_rgba(16,185,129,0.1)] ${
                          note.type === 'good' ? 'border-emerald-400' : 'border-amber-400'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          {editingId === note.id ? (
                            <textarea
                              autoFocus
                              rows={2}
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') cancelEdit()
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                  e.preventDefault()
                                  saveEdit(note)
                                }
                              }}
                              className={textareaClass}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm text-zinc-800">{note.content}</p>
                          )}
                          <button
                            onClick={() => toggleStatus(note)}
                            disabled={busyId === note.id}
                            className="mt-1.5 inline-block"
                          >
                            {note.status === 'done' ? (
                              <Badge className="border border-emerald-300 bg-emerald-50 text-emerald-700">Đã làm</Badge>
                            ) : (
                              <Badge variant="outline" className="border-dashed border-zinc-300 text-zinc-600">
                                Đang cải thiện
                              </Badge>
                            )}
                          </button>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {editingId === note.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busyId === note.id}
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
                                onClick={() => handleDelete(note)}
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
    </main>
  )
}
