import { describe, expect, it } from 'vitest'

import type { Note, Todo } from '@/types'
import { buildNotesViewModel } from './notesViewModel'

const t = (key: string) => key

function note(params: Partial<Note> & { id: string; content: string; note_date: string }): Note {
  return {
    id: params.id,
    note_date: params.note_date,
    content: params.content,
    type: params.type ?? 'good',
    status: 'in_progress',
    created_at: params.created_at ?? '2026-08-03T10:00:00.000Z',
    priority: params.priority,
    tags: params.tags,
    hide_meta: params.hide_meta,
  }
}

function todo(id: string, is_done: boolean): Todo {
  return {
    id,
    content: id,
    is_done,
    created_at: '2026-08-03T00:00:00.000Z',
    updated_at: '2026-08-03T00:00:00.000Z',
  }
}

describe('buildNotesViewModel', () => {
  it('computes counts and tabs from notes + todos', () => {
    const model = buildNotesViewModel({
      notes: [
        note({ id: 'n1', content: 'a', note_date: '2026-08-03', type: 'good' }),
        note({ id: 'n2', content: 'b', note_date: '2026-08-02', type: 'bad' }),
      ],
      todos: [todo('t1', false), todo('t2', true)],
      searchQuery: '',
      t,
      typeFilter: 'all',
    })

    expect(model.counts).toEqual({ all: 2, good: 1, bad: 1, todos: 2, pendingTodos: 1 })
    expect(model.typeTabs.map((x) => x.key)).toEqual(['all', 'good', 'bad'])
  })

  it('filters notes by type and normalized query', () => {
    const model = buildNotesViewModel({
      notes: [
        note({ id: 'n1', content: 'Đi ăn sáng', note_date: '2026-08-03', type: 'good' }),
        note({ id: 'n2', content: 'Đọc sách', note_date: '2026-08-03', type: 'bad' }),
      ],
      todos: [],
      searchQuery: 'an',
      t,
      typeFilter: 'good',
    })

    expect(model.noteGroups).toHaveLength(1)
    expect(model.noteGroups[0].items).toHaveLength(1)
    expect(model.noteGroups[0].items[0].id).toBe('n1')
  })

  it('sorts by priority first then created_at desc', () => {
    const model = buildNotesViewModel({
      notes: [
        note({ id: 'n1', content: 'one', note_date: '2026-08-03', priority: 1, created_at: '2026-08-03T08:00:00.000Z' }),
        note({ id: 'n2', content: 'two', note_date: '2026-08-03', priority: 3, created_at: '2026-08-03T07:00:00.000Z' }),
        note({ id: 'n3', content: 'three', note_date: '2026-08-03', priority: 3, created_at: '2026-08-03T09:00:00.000Z' }),
      ],
      todos: [],
      searchQuery: '',
      t,
      typeFilter: 'all',
    })

    expect(model.noteGroups[0].items.map((x) => x.id)).toEqual(['n3', 'n2', 'n1'])
  })
})
