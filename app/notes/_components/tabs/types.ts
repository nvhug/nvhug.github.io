import type { Dispatch, RefObject, SetStateAction } from 'react'

import type { BuyPick, Goal, GoalItem, Note, Todo } from '@/types'

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

export type TodoFilter = 'all' | 'pending' | 'done'

export type BuyPickFormState = {
  category: string
  emoji: string
  brands: string[]
  note: string
  brandInput: string
}

export type TodosTabState = {
  addingBuyPick: boolean
  buyPickForm: BuyPickFormState
  buyPicks: BuyPick[]
  editingBuyPickId: string | null
  editingTodoDraft: string
  editingTodoId: string | null
  savingBuyPick: boolean
  savingTodo: boolean
  todoDraft: string
  todoFilter: TodoFilter
  todos: Todo[]
}

export type TodosTabActions = {
  addTodo: () => Promise<void>
  cancelBuyPickForm: () => void
  openAddBuyPick: () => void
  saveBuyPick: () => Promise<void>
  saveEditingTodo: (id: string) => Promise<void>
  setBuyPickForm: SetState<BuyPickFormState>
  setDeleteBuyPick: (pick: BuyPick) => void
  setDeleteTodo: (todo: Todo) => void
  setEditingTodoDraft: SetState<string>
  setEditingTodoId: SetState<string | null>
  setTodoDraft: SetState<string>
  setTodoFilter: SetState<TodoFilter>
  startEditBuyPick: (pick: BuyPick) => void
  toggleBuyPickPurchased: (pick: BuyPick) => Promise<void>
  toggleTodo: (todo: Todo) => Promise<void>
}