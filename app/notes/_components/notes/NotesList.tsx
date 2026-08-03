'use client'

import type { Dispatch, RefObject, SetStateAction } from 'react'

import { Check, Pencil, Sparkles, Star, ThumbsDown, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TagInput } from '@/components/ui/tag-input'
import { getIntlLocale } from '@/lib/i18n/locale'
import type { Lang } from '@/lib/i18n/language-context'
import type { Note } from '@/types'

type Translate = (key: string, vars?: Record<string, string | number>) => string
type TypeFilter = 'all' | 'good' | 'bad'

type EditDraft = {
  content: string
  type: 'good' | 'bad'
  priority: number
  completion_percentage: number
  tags: string[]
  hide_meta: boolean
}

type NotesListProps = {
  allTags: string[]
  autoTextareaClass: string
  busyId: string | null
  cancelEdit: () => void
  editTextareaRef: RefObject<HTMLTextAreaElement | null>
  editingDraft: EditDraft | null
  editingId: string | null
  lang: Lang
  loading: boolean
  noteGroups: { date: string; items: Note[] }[]
  percentEditId: string | null
  percentEditValue: string
  saveEdit: (note: Note) => void
  savePercentage: (note: Note) => Promise<void>
  searchQuery: string
  setDeleteTarget: Dispatch<SetStateAction<Note | null>>
  setPercentEditId: Dispatch<SetStateAction<string | null>>
  setPercentEditValue: Dispatch<SetStateAction<string>>
  setSearchQuery: Dispatch<SetStateAction<string>>
  setTypeFilter: Dispatch<SetStateAction<TypeFilter>>
  startEdit: (note: Note) => void
  t: Translate
  typeFilter: TypeFilter
  typeTabs: { key: TypeFilter; label: string; count: number }[]
  updateEditingDraft: (patch: Partial<EditDraft>) => void
  updatePriority: (note: Note, priority: number) => Promise<void>
}

function formatNoteDate(isoDate: string, lang: Lang): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(getIntlLocale(lang), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function NotesList({
  allTags,
  autoTextareaClass,
  busyId,
  cancelEdit,
  editTextareaRef,
  editingDraft,
  editingId,
  lang,
  loading,
  noteGroups,
  percentEditId,
  percentEditValue,
  saveEdit,
  savePercentage,
  searchQuery,
  setDeleteTarget,
  setPercentEditId,
  setPercentEditValue,
  setSearchQuery,
  setTypeFilter,
  startEdit,
  t,
  typeFilter,
  typeTabs,
  updateEditingDraft,
  updatePriority,
}: NotesListProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
      <div className="border-b border-emerald-100 px-4 py-2.5">
        <input
          type="search"
          placeholder={t('notes.list.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-400"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100 px-4 py-3.5">
        {typeTabs.map((tab) => {
          const isSelected = typeFilter === tab.key
          let bgColor = 'border-emerald-100 text-zinc-600 hover:bg-emerald-50 hover:text-zinc-900'
          let badgeBg = 'bg-zinc-100 text-zinc-600'

          if (isSelected) {
            if (tab.key === 'good') {
              bgColor = 'border-emerald-300 bg-emerald-50 text-emerald-700'
              badgeBg = 'bg-emerald-100 text-emerald-700'
            } else if (tab.key === 'bad') {
              bgColor = 'border-amber-300 bg-amber-50 text-amber-700'
              badgeBg = 'bg-amber-100 text-amber-700'
            } else {
              bgColor = 'border-emerald-300 bg-emerald-50 text-emerald-700'
              badgeBg = 'bg-emerald-100 text-emerald-700'
            }
          } else {
            if (tab.key === 'good') {
              bgColor = 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'
            } else if (tab.key === 'bad') {
              bgColor = 'border-amber-100 text-amber-600 hover:bg-amber-50'
            }
          }

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTypeFilter(tab.key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${bgColor}`}
            >
              {tab.label}
              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${badgeBg}`}>{tab.count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-500">{t('common.loading')}</div>
      ) : noteGroups.length === 0 ? (
        <div className="py-16 text-center text-sm text-zinc-500">
          {searchQuery.trim() ? t('notes.list.noResults', { q: searchQuery }) : t('notes.list.empty')}
        </div>
      ) : (
        <div className="divide-y divide-emerald-50">
          {noteGroups.map((group, groupIndex) => (
            <div key={`${group.date}-${groupIndex}`} className="px-4 py-3.5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{formatNoteDate(group.date, lang)}</p>
              <div className="space-y-2">
                {group.items.map((note) => (
                  <div
                    key={note.id}
                    className={`flex items-start gap-3 rounded-xl border-l-4 px-3 py-2.5 ${note.type === 'good' ? 'border-emerald-400' : 'border-amber-400'} ${
                      note.priority === 5 ? 'bg-amber-50 shadow-[0_2px_10px_-3px_rgba(217,119,6,0.3)] ring-1 ring-amber-200' : 'bg-white shadow-[0_1px_0_0_rgba(16,185,129,0.1)]'
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
                                {t('notes.composer.good')}
                              </button>
                              <button
                                type="button"
                                onClick={() => updateEditingDraft({ type: 'bad' })}
                                className={`inline-flex items-center gap-1.5 border-l border-emerald-200 px-3 py-1.5 text-sm font-medium transition-colors ${
                                  editingDraft.type === 'bad' ? 'bg-amber-500 text-white' : 'bg-white text-zinc-600 hover:bg-amber-50'
                                }`}
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                                {t('notes.composer.bad')}
                              </button>
                            </div>
                            <div className="inline-flex items-center gap-0.5">
                              {([1, 2, 3, 4, 5] as const).map((star) => (
                                <button key={star} type="button" onClick={() => updateEditingDraft({ priority: star })}>
                                  <Star className={`h-3.5 w-3.5 ${star <= editingDraft.priority ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}`} />
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="10"
                                value={editingDraft.completion_percentage}
                                onChange={(e) => updateEditingDraft({ completion_percentage: Number(e.target.value) })}
                                className="w-32 sm:w-48"
                              />
                              <span className="w-8 text-right text-xs font-medium text-zinc-600">{editingDraft.completion_percentage}%</span>
                              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 select-none">
                                <input
                                  type="checkbox"
                                  checked={editingDraft.hide_meta}
                                  onChange={(e) => updateEditingDraft({ hide_meta: e.target.checked })}
                                  className="h-3.5 w-3.5 accent-emerald-500"
                                />
                                <span className="hidden sm:inline">{t('notes.composer.hideProgress')}</span>
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
                          <TagInput value={editingDraft.tags} onChange={(tags) => updateEditingDraft({ tags })} suggestions={allTags} />
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-sm text-zinc-800">{note.content}</p>
                          {!note.hide_meta && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-0.5">
                                {([1, 2, 3, 4, 5] as const).map((star) => (
                                  <button key={star} type="button" onClick={() => void updatePriority(note, star)} className="rounded hover:scale-110 transition-transform">
                                    <Star className={`h-3.5 w-3.5 transition-colors ${star <= (note.priority ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 hover:text-amber-300'}`} />
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
                                    onBlur={() => void savePercentage(note)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') void savePercentage(note)
                                      if (e.key === 'Escape') setPercentEditId(null)
                                    }}
                                    className="w-14 rounded-md border border-emerald-300 bg-white px-1.5 py-0.5 text-xs text-zinc-900 outline-none focus:border-emerald-500"
                                  />
                                  <span className="text-xs text-zinc-500">%</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPercentEditId(note.id)
                                    setPercentEditValue(String(note.completion_percentage ?? 0))
                                  }}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-emerald-300 hover:bg-emerald-50 ${
                                    note.completion_percentage ? 'border-zinc-200 bg-zinc-50 text-zinc-700' : 'border-dashed border-zinc-200 text-zinc-400'
                                  }`}
                                >
                                  {note.completion_percentage ? `${note.completion_percentage}%` : '—'}
                                </button>
                              )}
                            </div>
                          )}
                          {note.tags && note.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(Array.isArray(note.tags) ? note.tags : []).map((tag: string, index: number) => (
                                <span key={index} className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-700">
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
  )
}