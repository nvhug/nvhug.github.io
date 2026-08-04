'use client'

import { Check, CheckCircle2, Circle, ListTodo, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BuyPicksSection } from '../todos/BuyPicksSection'
import type { GroupedTabProps, TodosTabActions, TodosTabState, Translate } from './types'

type TodosTabUi = { t: Translate }
type TodosTabProps = GroupedTabProps<TodosTabState, TodosTabActions, Record<string, never>, TodosTabUi>

export function TodosTab({
  actions,
  state,
  ui,
}: TodosTabProps) {
  const filteredTodos = state.todos.filter((todo) => {
    if (state.todoFilter === 'pending') return !todo.is_done
    if (state.todoFilter === 'done') return todo.is_done
    return true
  })

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
        <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{ui.t('notes.todos.heading')}</span>
          </div>
          <span className="text-xs font-medium text-emerald-600">{ui.t('notes.todos.count', { n: state.todos.length })}</span>
        </div>

        <div className="px-4 py-3">
          <div className="mb-4 flex gap-2">
            {(['all', 'pending', 'done'] as const).map((filter) => {
              const isSelected = state.todoFilter === filter
              const pendingCount = state.todos.filter((todo) => !todo.is_done).length
              const doneCount = state.todos.filter((todo) => todo.is_done).length

              let label = ''
              let count = 0
              let bgColor = 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'

              if (filter === 'all') {
                label = ui.t('notes.todos.filterAll')
                count = state.todos.length
                bgColor = isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              } else if (filter === 'pending') {
                label = ui.t('notes.todos.filterPending')
                count = pendingCount
                bgColor = isSelected ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              } else {
                label = ui.t('notes.todos.filterDone')
                count = doneCount
                bgColor = isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              }

              return (
                <button
                  key={filter}
                  onClick={() => actions.setTodoFilter(filter)}
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
                <button onClick={() => void actions.toggleTodo(todo)} className="shrink-0 text-emerald-600 hover:text-emerald-700 transition-colors">
                  {todo.is_done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </button>
                {state.editingTodoId === todo.id ? (
                  <input
                    autoFocus
                    value={state.editingTodoDraft}
                    onChange={(e) => actions.setEditingTodoDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void actions.saveEditingTodo(todo.id)
                      if (e.key === 'Escape') actions.setEditingTodoId(null)
                    }}
                    className="flex-1 rounded border border-emerald-300 px-2 py-0.5 text-sm text-zinc-900 outline-none focus:border-emerald-500"
                  />
                ) : (
                  <span
                    onDoubleClick={() => {
                      actions.setEditingTodoId(todo.id)
                      actions.setEditingTodoDraft(todo.content)
                    }}
                    className={`flex-1 cursor-text text-sm ${todo.is_done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}
                  >
                    {todo.content}
                  </span>
                )}
                {state.editingTodoId === todo.id ? (
                  <>
                    <Button variant="ghost" size="icon-sm" onClick={() => void actions.saveEditingTodo(todo.id)} className="text-emerald-600 hover:bg-emerald-500/15">
                      <Check />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => actions.setEditingTodoId(null)} className="text-zinc-400 hover:bg-zinc-100">
                      <X />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        actions.setEditingTodoId(todo.id)
                        actions.setEditingTodoDraft(todo.content)
                      }}
                      className="text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
                    >
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => actions.setDeleteTodo(todo)} className="text-rose-300 hover:bg-rose-500/15">
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            ))}

            {filteredTodos.length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                {state.todoFilter === 'all' && ui.t('notes.todos.emptyAll')}
                {state.todoFilter === 'pending' && ui.t('notes.todos.emptyPending')}
                {state.todoFilter === 'done' && ui.t('notes.todos.emptyDone')}
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-emerald-100 pt-4">
            <Input
              type="text"
              placeholder={ui.t('notes.todos.addPlaceholder')}
              value={state.todoDraft}
              onChange={(e) => actions.setTodoDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void actions.addTodo()
              }}
              className="flex-1"
            />
            <Button onClick={() => void actions.addTodo()} disabled={state.savingTodo || !state.todoDraft.trim()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" />
              {ui.t('common.add')}
            </Button>
          </div>
        </div>
      </section>

      <BuyPicksSection
        addingBuyPick={state.addingBuyPick}
        buyPickForm={state.buyPickForm}
        buyPicks={state.buyPicks}
        cancelBuyPickForm={actions.cancelBuyPickForm}
        editingBuyPickId={state.editingBuyPickId}
        openAddBuyPick={actions.openAddBuyPick}
        saveBuyPick={actions.saveBuyPick}
        savingBuyPick={state.savingBuyPick}
        setBuyPickForm={actions.setBuyPickForm}
        setDeleteBuyPick={actions.setDeleteBuyPick}
        startEditBuyPick={actions.startEditBuyPick}
        updateBuyPickDetails={actions.updateBuyPickDetails}
        toggleBuyPickPurchased={actions.toggleBuyPickPurchased}
        t={ui.t}
      />
    </>
  )
}