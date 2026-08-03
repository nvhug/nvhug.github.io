import type { Dispatch, RefObject, SetStateAction } from 'react'

import type { Goal, GoalItem, Note } from '@/types'

export type Translate = (key: string, vars?: Record<string, string | number>) => string

export type TypeFilter = 'all' | 'good' | 'bad'
export type TabType = 'notes' | 'todos' | 'goals' | 'calo' | 'health' | 'stats' | 'tracker' | 'calendar'
export type TrackerSubTab = 'logs' | 'videos'

export type NotesDraft = {
  note_date: string
  content: string
  type: 'good' | 'bad'
  priority: number
  completion_percentage: number
  tags: string[]
  hide_meta: boolean
}

export type NoteEditDraft = Omit<NotesDraft, 'note_date'>

export type GoalDraft = Omit<Goal, 'id' | 'created_at'>
export type GoalItemDraft = Omit<GoalItem, 'id' | 'goal_id' | 'created_at' | 'updated_at'>

export type TypeTabCount = { key: TypeFilter; label: string; count: number }

export type GroupedTabProps<TState, TActions, TRefs = Record<string, never>, TUi = Record<string, never>> = {
  state: TState
  actions: TActions
  refs: TRefs
  ui: TUi
}

export type SetState<T> = Dispatch<SetStateAction<T>>
export type InputRef = RefObject<HTMLInputElement | null>
export type TextareaRef = RefObject<HTMLTextAreaElement | null>
export type NotesGroup = { date: string; items: Note[] }