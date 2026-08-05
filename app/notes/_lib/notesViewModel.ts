import type { Note, Todo } from '@/types'
import { toLocalISODate } from '@/lib/date'
import type { Translate, TypeFilter, TypeTabCount } from '../_components/tabs/types'

export type NotesViewModel = {
  allTags: string[]
  counts: {
    all: number
    bad: number
    good: number
    pendingTodos: number
    todos: number
  }
  noteGroups: { date: string; items: Note[] }[]
  notesStreak: number
  typeTabs: TypeTabCount[]
}

function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase()
}

function buildNotesStreak(notes: Note[]): number {
  const dates = new Set(notes.map((n) => n.note_date))
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  const todayStr = toLocalISODate(cursor)

  if (!dates.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  while (true) {
    const d = toLocalISODate(cursor)
    if (!dates.has(d)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function buildFilteredNotes(notes: Note[], typeFilter: TypeFilter, searchQuery: string): Note[] {
  const trimmed = searchQuery.trim()
  const normalizedQuery = trimmed ? normalizeForSearch(trimmed) : ''

  return notes.filter((note) => {
    if (typeFilter !== 'all' && note.type !== typeFilter) return false
    if (!normalizedQuery) return true

    const contentMatch = normalizeForSearch(note.content).includes(normalizedQuery)
    const tagMatch = (note.tags ?? []).some((tag) => normalizeForSearch(tag).includes(normalizedQuery))
    return contentMatch || tagMatch
  })
}

function buildSortedNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const priorityA = a.hide_meta ? 0 : (a.priority ?? 0)
    const priorityB = b.hide_meta ? 0 : (b.priority ?? 0)
    if (priorityB !== priorityA) return priorityB - priorityA
    return b.created_at.localeCompare(a.created_at)
  })
}

function buildNoteGroups(notes: Note[]): { date: string; items: Note[] }[] {
  const result: { date: string; items: Note[] }[] = []

  for (const note of notes) {
    const last = result[result.length - 1]
    if (last && last.date === note.note_date) {
      last.items.push(note)
    } else {
      result.push({ date: note.note_date, items: [note] })
    }
  }

  return result
}

function buildCounts(notes: Note[], todos: Todo[]) {
  return {
    all: notes.length,
    bad: notes.filter((n) => n.type === 'bad').length,
    good: notes.filter((n) => n.type === 'good').length,
    pendingTodos: todos.filter((todo) => !todo.is_done).length,
    todos: todos.length,
  }
}

export function buildNotesViewModel(params: {
  notes: Note[]
  searchQuery: string
  t: Translate
  todos: Todo[]
  typeFilter: TypeFilter
}): NotesViewModel {
  const counts = buildCounts(params.notes, params.todos)
  const filteredNotes = buildFilteredNotes(params.notes, params.typeFilter, params.searchQuery)
  const sortedNotes = buildSortedNotes(filteredNotes)

  return {
    allTags: [...new Set(params.notes.flatMap((n) => n.tags ?? []))].sort(),
    counts,
    noteGroups: buildNoteGroups(sortedNotes),
    notesStreak: buildNotesStreak(params.notes),
    typeTabs: [
      { key: 'all', label: params.t('notes.typeFilters.all'), count: counts.all },
      { key: 'good', label: params.t('notes.typeFilters.good'), count: counts.good },
      { key: 'bad', label: params.t('notes.typeFilters.bad'), count: counts.bad },
    ],
  }
}
