'use client'

import type { Dispatch, SetStateAction } from 'react'

import { Check, CheckCircle2, Circle, ListTodo, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BuyPick, Todo } from '@/types'
import { BuyPicksSection } from '../todos/BuyPicksSection'

type Translate = (key: string, vars?: Record<string, string | number>) => string

type TodoFilter = 'all' | 'pending' | 'done'

type BuyPickFormState = {
  category: string
  emoji: string
  brands: string[]
  note: string
  brandInput: string
}

type TodosTabProps = {
  addingBuyPick: boolean
  addTodo: () => Promise<void>
  buyPickForm: BuyPickFormState
  buyPicks: BuyPick[]
  cancelBuyPickForm: () => void
  editingBuyPickId: string | null
  editingTodoDraft: string
  editingTodoId: string | null
  openAddBuyPick: () => void
  saveBuyPick: () => Promise<void>
  saveEditingTodo: (id: string) => Promise<void>
  savingBuyPick: boolean
  savingTodo: boolean
  setBuyPickForm: Dispatch<SetStateAction<BuyPickFormState>>
  setDeleteBuyPick: (pick: BuyPick) => void
  setDeleteTodo: (todo: Todo) => void
  setEditingTodoDraft: Dispatch<SetStateAction<string>>
  setEditingTodoId: Dispatch<SetStateAction<string | null>>
  setTodoDraft: Dispatch<SetStateAction<string>>
  setTodoFilter: Dispatch<SetStateAction<TodoFilter>>
  startEditBuyPick: (pick: BuyPick) => void
  t: Translate
  todoDraft: string
  todoFilter: TodoFilter
  todos: Todo[]
  toggleTodo: (todo: Todo) => Promise<void>
}

export function TodosTab({
  addingBuyPick,
  addTodo,
  buyPickForm,
  buyPicks,
  cancelBuyPickForm,
  editingBuyPickId,
  editingTodoDraft,
  editingTodoId,
  openAddBuyPick,
  saveBuyPick,
  saveEditingTodo,
  savingBuyPick,
  savingTodo,
  setBuyPickForm,
  setDeleteBuyPick,
  setEditingTodoDraft,
  setEditingTodoId,
  setDeleteTodo,
  setTodoDraft,
  setTodoFilter,
  startEditBuyPick,
  t,
  todoDraft,
  todoFilter,
  todos,
  toggleTodo,
}: TodosTabProps) {
  const filteredTodos = todos.filter((todo) => {
    if (todoFilter === 'pending') return !todo.is_done
    if (todoFilter === 'done') return todo.is_done
    return true
  })

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
        <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('notes.todos.heading')}</span>
          </div>
          <span className="text-xs font-medium text-emerald-600">{t('notes.todos.count', { n: todos.length })}</span>
        </div>

        <div className="px-4 py-3">
          <div className="mb-4 flex gap-2">
            {(['all', 'pending', 'done'] as const).map((filter) => {
              const isSelected = todoFilter === filter
              const pendingCount = todos.filter((todo) => !todo.is_done).length
              const doneCount = todos.filter((todo) => todo.is_done).length

              let label = ''
              let count = 0
              let bgColor = 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'

              if (filter === 'all') {
                label = t('notes.todos.filterAll')
                count = todos.length
                bgColor = isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              } else if (filter === 'pending') {
                label = t('notes.todos.filterPending')
                count = pendingCount
                bgColor = isSelected ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              } else {
                label = t('notes.todos.filterDone')
                count = doneCount
                bgColor = isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              }

              return (
                <button
                  key={filter}
                  onClick={() => setTodoFilter(filter)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${bgColor} ${
                    isSelected
                      ? filter === 'all'
                        ? 'border-emerald-300'
                        : filter === 'pending'
                          ? 'border-blue-300'
                          : 'border-emerald-300'
                      : filter === 'all'
                        ? 'border-zinc-200'
                        : filter === 'pending'
                          ? 'border-blue-100'
                          : 'border-emerald-100'
                  }`}
                >
                  {label}
                  <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                    isSelected
                      ? filter === 'all'
                        ? 'bg-emerald-200 text-emerald-900'
                        : filter === 'pending'
                          ? 'bg-blue-200 text-blue-900'
                          : 'bg-emerald-200 text-emerald-900'
                      : filter === 'all'
                        ? 'bg-zinc-200 text-zinc-700'
                        : filter === 'pending'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="space-y-2 mb-4">
            {filteredTodos.map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-white p-3 hover:bg-emerald-50 transition-colors">
                <button onClick={() => void toggleTodo(todo)} className="shrink-0 text-emerald-600 hover:text-emerald-700 transition-colors">
                  {todo.is_done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </button>
                {editingTodoId === todo.id ? (
                  <input
                    autoFocus
                    value={editingTodoDraft}
                    onChange={(e) => setEditingTodoDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveEditingTodo(todo.id)
                      if (e.key === 'Escape') setEditingTodoId(null)
                    }}
                    className="flex-1 rounded border border-emerald-300 px-2 py-0.5 text-sm text-zinc-900 outline-none focus:border-emerald-500"
                  />
                ) : (
                  <span
                    onDoubleClick={() => {
                      setEditingTodoId(todo.id)
                      setEditingTodoDraft(todo.content)
                    }}
                    className={`flex-1 cursor-text text-sm ${todo.is_done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}
                  >
                    {todo.content}
                  </span>
                )}
                {editingTodoId === todo.id ? (
                  <>
                    <Button variant="ghost" size="icon-sm" onClick={() => void saveEditingTodo(todo.id)} className="text-emerald-600 hover:bg-emerald-500/15">
                      <Check />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditingTodoId(null)} className="text-zinc-400 hover:bg-zinc-100">
                      <X />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingTodoId(todo.id)
                        setEditingTodoDraft(todo.content)
                      }}
                      className="text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
                    >
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTodo(todo)} className="text-rose-300 hover:bg-rose-500/15">
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            ))}

            {filteredTodos.length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                {todoFilter === 'all' && t('notes.todos.emptyAll')}
                {todoFilter === 'pending' && t('notes.todos.emptyPending')}
                {todoFilter === 'done' && t('notes.todos.emptyDone')}
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-emerald-100 pt-4">
            <Input
              type="text"
              placeholder={t('notes.todos.addPlaceholder')}
              value={todoDraft}
              onChange={(e) => setTodoDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addTodo()
              }}
              className="flex-1"
            />
            <Button onClick={() => void addTodo()} disabled={savingTodo || !todoDraft.trim()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" />
              {t('common.add')}
            </Button>
          </div>
        </div>
      </section>

      <BuyPicksSection
        addingBuyPick={addingBuyPick}
        buyPickForm={buyPickForm}
        buyPicks={buyPicks}
        cancelBuyPickForm={cancelBuyPickForm}
        editingBuyPickId={editingBuyPickId}
        openAddBuyPick={openAddBuyPick}
        saveBuyPick={saveBuyPick}
        savingBuyPick={savingBuyPick}
        setBuyPickForm={setBuyPickForm}
        setDeleteBuyPick={setDeleteBuyPick}
        startEditBuyPick={startEditBuyPick}
        t={t}
      />
    </>
  )
}