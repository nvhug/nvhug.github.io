'use client'

import { useState } from 'react'

import { Check, CheckCircle2, ChevronDown, ChevronUp, Circle, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { getIntlLocale } from '@/lib/i18n/locale'
import type { Lang } from '@/lib/i18n/language-context'
import type { Goal, GoalItem } from '@/types'
import { computeGoalProgress } from '../../_lib/goalsUtils'
import { GoalDetailPreviewModal } from './GoalDetailPreviewModal'
import type { GoalDraft, GoalItemDraft, GroupedTabProps, SetState, TextareaRef, Translate } from './types'

type GoalFilter = 'active' | 'completed' | 'all'

type GoalsTabState = {
  collapsedGoalIds: string[]
  deleteGoalItem: GoalItem | null
  draggedItemId: string | null
  dragOverItemId: string | null
  editingGoalDraft: GoalDraft | null
  editingGoalId: string | null
  editingGoalItemDraft: GoalItemDraft | null
  editingGoalItemId: string | null
  expandedGoal: string | null
  goalDraft: GoalDraft | null
  goalFilter: GoalFilter
  goalItemDraft: { [goalId: string]: GoalItemDraft }
  goalItems: { [goalId: string]: GoalItem[] }
  goals: Goal[]
  lang: Lang
  savingGoal: boolean
  savingGoalItem: boolean
}

type GoalsTabActions = {
  addGoal: () => Promise<void>
  addGoalItem: (goal: Goal) => Promise<void>
  cancelEditingGoal: () => void
  cancelEditingGoalItem: () => void
  cancelGoalDraft: () => void
  openGoalDraft: () => void
  reorderGoalItems: (goalId: string, fromIndex: number, toIndex: number) => Promise<void>
  saveEditingGoal: (goal: Goal) => Promise<void>
  saveEditingGoalItem: (item: GoalItem) => Promise<void>
  setCollapsedGoalIds: SetState<string[]>
  setDeleteGoal: SetState<Goal | null>
  setDeleteGoalItem: SetState<GoalItem | null>
  setDraggedItemId: SetState<string | null>
  setDragOverItemId: SetState<string | null>
  setEditingGoalDraft: SetState<GoalDraft | null>
  setEditingGoalItemDraft: SetState<GoalItemDraft | null>
  setExpandedGoal: SetState<string | null>
  setGoalDraft: SetState<GoalDraft | null>
  setGoalFilter: SetState<GoalFilter>
  setGoalItemDraft: SetState<{ [goalId: string]: GoalItemDraft }>
  startEditingGoal: (goal: Goal) => void
  startEditingGoalItem: (item: GoalItem) => void
  toggleGoalItem: (item: GoalItem) => Promise<void>
  updateGoalStatus: (goal: Goal, newStatus: Goal['status']) => Promise<void>
}

type GoalsTabRefs = {
  editingGoalDescriptionRef: TextareaRef
  goalDescriptionRef: TextareaRef
}

type GoalsTabUi = {
  autoTextareaClass: string
  t: Translate
}

type GoalsTabProps = GroupedTabProps<GoalsTabState, GoalsTabActions, GoalsTabRefs, GoalsTabUi>

function getGoalItemTypeLabel(itemType: string, t: Translate) {
  const key = `notes.goals.itemTypeOptions.${itemType}`
  const label = t(key)
  return label === key ? itemType : label
}

function getGoalTypeLabel(type: string, t: Translate) {
  const key = `notes.goals.typeOptions.${type}`
  const label = t(key)
  return label === key ? type : label
}

export function GoalsTab({ actions, refs, state, ui }: GoalsTabProps) {
  const {
    collapsedGoalIds,
    draggedItemId,
    dragOverItemId,
    editingGoalDraft,
    editingGoalId,
    editingGoalItemDraft,
    editingGoalItemId,
    expandedGoal,
    goalDraft,
    goalFilter,
    goalItemDraft,
    goalItems,
    goals,
    lang,
    savingGoal,
    savingGoalItem,
  } = state
  const {
    addGoalItem,
    cancelEditingGoal,
    cancelEditingGoalItem,
    reorderGoalItems,
    saveEditingGoal,
    saveEditingGoalItem,
    setCollapsedGoalIds,
    setDeleteGoal,
    setDeleteGoalItem,
    setDraggedItemId,
    setDragOverItemId,
    setEditingGoalDraft,
    setEditingGoalItemDraft,
    setExpandedGoal,
    setGoalDraft,
    setGoalFilter,
    setGoalItemDraft,
    startEditingGoal,
    startEditingGoalItem,
    toggleGoalItem,
    updateGoalStatus,
  } = actions
  const { editingGoalDescriptionRef, goalDescriptionRef } = refs
  const { autoTextareaClass, t } = ui
  const [previewGoal, setPreviewGoal] = useState<Goal | null>(null)
  const now = new Date()
  const activeGoalsCount = goals.filter((goal) => goal.status === 'active').length
  const completedGoalsCount = goals.filter((goal) => goal.status === 'completed').length
  const filteredGoals = goals.filter((goal) => goalFilter === 'all' || goal.status === goalFilter)

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
      <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3">
        <span className="text-sm">🎯</span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{ui.t('notes.goals.heading')}</span>
      </div>

      <div className="px-4 py-3">
        <div className="mb-4 flex gap-2">
          {(['all', 'active', 'completed'] as const).map((filter) => {
            const isSelected = goalFilter === filter

            let label = ''
            let count = 0
            let bgColor = 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'

            if (filter === 'all') {
              label = ui.t('notes.goals.filterAll')
              count = goals.length
              bgColor = isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            } else if (filter === 'active') {
              label = ui.t('notes.goals.filterActive')
              count = activeGoalsCount
              bgColor = isSelected ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            } else {
              label = ui.t('notes.goals.filterCompleted')
              count = completedGoalsCount
              bgColor = isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }

            return (
              <button
                key={filter}
                onClick={() => setGoalFilter(filter)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${bgColor} ${
                  isSelected
                    ? filter === 'active'
                      ? 'border-blue-300'
                      : 'border-emerald-300'
                    : filter === 'active'
                      ? 'border-blue-100'
                      : 'border-emerald-100'
                }`}
              >
                {label}
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  isSelected
                    ? filter === 'active'
                      ? 'bg-blue-200 text-blue-900'
                      : 'bg-emerald-200 text-emerald-900'
                    : filter === 'active'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {goalDraft ? (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border-l-4 border-dashed border-emerald-300 bg-emerald-50/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                value={goalDraft.title}
                onChange={(e) => setGoalDraft((prev) => prev ? { ...prev, title: e.target.value } : null)}
                placeholder={ui.t('notes.goals.namePlaceholder')}
                className="flex-1 h-8 border-emerald-200 bg-white text-zinc-900"
              />
              <select
                value={goalDraft.type}
                onChange={(e) => setGoalDraft((prev) => prev ? { ...prev, type: e.target.value } : null)}
                className="h-8 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
              >
                <option value="health">{ui.t('notes.goals.typeOptions.health')}</option>
                <option value="learning">{ui.t('notes.goals.typeOptions.learning')}</option>
                <option value="fitness">{ui.t('notes.goals.typeOptions.fitness')}</option>
                <option value="work">{ui.t('notes.goals.typeOptions.work')}</option>
                <option value="personal">{ui.t('notes.goals.typeOptions.personal')}</option>
                <option value="other">{ui.t('notes.goals.typeOptions.other')}</option>
              </select>
            </div>
            <textarea
              ref={goalDescriptionRef}
              value={goalDraft.description || ''}
              onChange={(e) => setGoalDraft((prev) => prev ? { ...prev, description: e.target.value } : null)}
              placeholder={ui.t('notes.goals.descPlaceholder')}
              rows={2}
              className={autoTextareaClass}
            />
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker value={goalDraft.target_date || ''} onChange={(v) => setGoalDraft((prev) => prev ? { ...prev, target_date: v } : null)} />
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={goalDraft.completion_percentage || 0}
                onChange={(e) => setGoalDraft((prev) => prev ? { ...prev, completion_percentage: Number(e.target.value) } : null)}
                className="flex-1 min-w-48"
              />
              <span className="w-9 text-right text-xs font-medium text-zinc-600">{goalDraft.completion_percentage || 0}%</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={actions.cancelGoalDraft} className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
                {ui.t('common.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={savingGoal || !goalDraft.title.trim()}
                onClick={() => void actions.addGoal()}
                className="bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500"
              >
                <Check />
                {ui.t('common.add')}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={actions.openGoalDraft}
            className="mb-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-300 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <Plus className="h-4 w-4" />
            {ui.t('notes.goals.addNew')}
          </button>
        )}

        <div className="space-y-2">
          {filteredGoals.map((goal) => {
            const isGoalCollapsed = collapsedGoalIds.includes(goal.id)
            return (
              <div key={goal.id} className="rounded-xl border border-emerald-100 bg-white p-3 sm:p-4 shadow-[0_1px_4px_0_rgba(16,185,129,0.06)] hover:shadow-[0_3px_10px_0_rgba(16,185,129,0.12)] transition-shadow group">
                <div className="flex flex-col gap-3">
                  <div className="w-full">
                    {editingGoalId === goal.id && editingGoalDraft ? (
                      <div className="flex flex-col gap-2 mb-3">
                        <input
                          autoFocus
                          type="text"
                          value={editingGoalDraft.title}
                          onChange={(e) => setEditingGoalDraft((prev) => prev ? { ...prev, title: e.target.value } : null)}
                          placeholder={t('notes.goals.namePlaceholder')}
                          className="w-full rounded-md border border-emerald-300 bg-white px-2 py-1.5 text-sm font-medium text-zinc-900 outline-none focus:border-emerald-500"
                        />
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={editingGoalDraft.type}
                            onChange={(e) => setEditingGoalDraft((prev) => prev ? { ...prev, type: e.target.value } : null)}
                            className="h-8 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
                          >
                            <option value="health">{t('notes.goals.typeOptions.health')}</option>
                            <option value="learning">{t('notes.goals.typeOptions.learning')}</option>
                            <option value="fitness">{t('notes.goals.typeOptions.fitness')}</option>
                            <option value="work">{t('notes.goals.typeOptions.work')}</option>
                            <option value="personal">{t('notes.goals.typeOptions.personal')}</option>
                            <option value="other">{t('notes.goals.typeOptions.other')}</option>
                          </select>
                          <DatePicker value={editingGoalDraft.start_date || ''} onChange={(v) => setEditingGoalDraft((prev) => prev ? { ...prev, start_date: v } : null)} />
                          <DatePicker value={editingGoalDraft.target_date || ''} onChange={(v) => setEditingGoalDraft((prev) => prev ? { ...prev, target_date: v } : null)} />
                        </div>
                        <textarea
                          ref={editingGoalDescriptionRef}
                          value={editingGoalDraft.description || ''}
                          onChange={(e) => setEditingGoalDraft((prev) => prev ? { ...prev, description: e.target.value } : null)}
                          placeholder={t('notes.goals.descPlaceholder')}
                          rows={2}
                          className={autoTextareaClass}
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="10"
                            value={editingGoalDraft.completion_percentage || 0}
                            onChange={(e) => setEditingGoalDraft((prev) => prev ? { ...prev, completion_percentage: Number(e.target.value) } : null)}
                            className="flex-1"
                          />
                          <span className="w-12 text-right text-xs font-medium text-zinc-600">{editingGoalDraft.completion_percentage || 0}%</span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon-sm" disabled={savingGoal || !editingGoalDraft.title.trim()} onClick={() => void saveEditingGoal(goal)} className="text-emerald-600 hover:bg-emerald-100">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" disabled={savingGoal} onClick={cancelEditingGoal} className="text-zinc-500 hover:bg-zinc-200">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className="cursor-pointer font-medium text-base text-zinc-900 hover:text-emerald-700"
                            onClick={() => setPreviewGoal(goal)}
                          >
                            {goal.title}
                          </h3>
                          <span className="text-sm px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">{getGoalTypeLabel(goal.type, t)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setCollapsedGoalIds((prev) => {
                                if (prev.includes(goal.id)) return prev.filter((id) => id !== goal.id)
                                return [...prev, goal.id]
                              })
                              if (!isGoalCollapsed && expandedGoal === goal.id) {
                                setExpandedGoal(null)
                              }
                            }}
                            aria-label={isGoalCollapsed ? t('notes.goals.showDetails') : t('notes.goals.hideDetails')}
                            title={isGoalCollapsed ? t('notes.goals.showDetails') : t('notes.goals.hideDetails')}
                            className="ml-auto rounded p-1.5 sm:p-1 text-emerald-600 hover:bg-emerald-100"
                          >
                            {isGoalCollapsed ? <ChevronDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <ChevronUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
                          </button>
                        </div>

                        {!isGoalCollapsed && (
                          <>
                            {(goal.start_date || goal.target_date) && (
                              <div className="text-sm text-zinc-600 space-y-1">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                  {goal.start_date && <span>📅 <span className="text-zinc-700 font-medium">{new Date(goal.start_date).toLocaleDateString(getIntlLocale(lang))}</span></span>}
                                  {goal.target_date && <span>🎯 <span className="text-zinc-700 font-medium">{new Date(goal.target_date).toLocaleDateString(getIntlLocale(lang))}</span></span>}
                                </div>
                                {(() => {
                                  const progress = computeGoalProgress(goal.start_date, goal.target_date, now)
                                  if (!progress) return null
                                  return <div className="text-sm text-zinc-600">⏱️ <span className="font-medium text-zinc-700">{Math.max(0, progress.elapsedDays)}/{progress.totalDays}</span> {t('notes.goals.daysRemainingPrefix')} <span className="font-medium text-zinc-700">{Math.max(0, progress.remainingDays)}</span></div>
                                })()}
                              </div>
                            )}

                            {goal.description && <p className="text-sm text-zinc-600 whitespace-pre-wrap">{goal.description}</p>}

                            {goal.completion_percentage !== undefined && (
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-sm font-medium text-zinc-700">{t('notes.goals.progress')}</span>
                                  <span className="text-sm font-semibold text-emerald-600">{goal.completion_percentage}%</span>
                                </div>
                                <div className="w-full bg-emerald-100 rounded-full h-2 overflow-hidden shadow-inner">
                                  <div className="bg-linear-to-r from-emerald-500 to-emerald-600 h-full transition-all duration-300" style={{ width: `${goal.completion_percentage}%` }} />
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {editingGoalId !== goal.id && !isGoalCollapsed && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-50">
                      <select value={goal.status} onChange={(e) => void updateGoalStatus(goal, e.target.value as Goal['status'])} className="h-8 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400">
                        <option value="active">{t('notes.goals.statusOptions.active')}</option>
                        <option value="completed">{t('notes.goals.statusOptions.completed')}</option>
                        <option value="archived">{t('notes.goals.statusOptions.archived')}</option>
                      </select>
                      <div className="flex items-center gap-1 ml-auto">
                        <Button variant="ghost" size="icon-sm" onClick={() => startEditingGoal(goal)} className="text-emerald-400 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100 hover:bg-emerald-100 hover:text-emerald-600">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteGoal(goal)} className="text-rose-300 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100 hover:bg-rose-500/15">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {!isGoalCollapsed && (
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                      aria-label={expandedGoal === goal.id ? t('notes.goals.hideDetails') : t('notes.goals.showDetails')}
                      title={expandedGoal === goal.id ? t('notes.goals.hideDetails') : t('notes.goals.showDetails')}
                      className="rounded p-1.5 sm:p-1 text-emerald-600 hover:bg-emerald-100"
                    >
                      {expandedGoal === goal.id ? <ChevronUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <ChevronDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
                    </button>
                  </div>
                )}

                {!isGoalCollapsed && expandedGoal === goal.id && (
                  <div className="mt-3 border-t border-emerald-100 pt-3">
                    <div className="space-y-2 mb-3">
                      {(goalItems[goal.id] || []).map((item, itemIndex) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggedItemId(item.id)}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragOverItemId(item.id)
                          }}
                          onDragLeave={() => setDragOverItemId(null)}
                          onDrop={() => {
                            if (draggedItemId && draggedItemId !== item.id) {
                              const draggedIndex = (goalItems[goal.id] || []).findIndex((goalItem) => goalItem.id === draggedItemId)
                              void reorderGoalItems(goal.id, draggedIndex, itemIndex)
                            }
                            setDraggedItemId(null)
                            setDragOverItemId(null)
                          }}
                          onDragEnd={() => {
                            setDraggedItemId(null)
                            setDragOverItemId(null)
                          }}
                          onDoubleClick={() => {
                            if (editingGoalItemId !== item.id) {
                              startEditingGoalItem(item)
                            }
                          }}
                          className={`flex flex-col sm:flex-row sm:items-start gap-2 rounded-lg border p-2 transition-all cursor-move group ${draggedItemId === item.id ? 'opacity-50 border-emerald-400 bg-emerald-100' : 'border-emerald-50 bg-emerald-50/50'} ${dragOverItemId === item.id && draggedItemId !== item.id ? 'border-emerald-400 bg-emerald-100/50' : ''} hover:bg-emerald-100/30`}
                        >
                          <button
                            onClick={() => void toggleGoalItem(item)}
                            disabled={editingGoalItemId === item.id}
                            className="shrink-0 mt-0.5 text-emerald-600 hover:text-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {item.is_completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                          </button>
                          <div className="flex-1 w-full">
                            {editingGoalItemId === item.id && editingGoalItemDraft ? (
                              <div className="flex flex-col gap-2 w-full">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingGoalItemDraft.content}
                                  onChange={(e) => setEditingGoalItemDraft((prev) => prev ? { ...prev, content: e.target.value } : null)}
                                  placeholder={t('notes.goals.itemContentPlaceholder')}
                                  className="w-full rounded-md border border-emerald-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-emerald-500"
                                />
                                <div className="flex gap-2">
                                  <select
                                    value={editingGoalItemDraft.item_type}
                                    onChange={(e) => setEditingGoalItemDraft((prev) => prev ? { ...prev, item_type: e.target.value } : null)}
                                    className="h-7 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
                                  >
                                    <option value="routine">{t('notes.goals.itemTypeOptions.routine')}</option>
                                    <option value="meal">{t('notes.goals.itemTypeOptions.meal')}</option>
                                    <option value="lesson">{t('notes.goals.itemTypeOptions.lesson')}</option>
                                    <option value="exercise">{t('notes.goals.itemTypeOptions.exercise')}</option>
                                    <option value="other">{t('notes.goals.itemTypeOptions.other')}</option>
                                  </select>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingGoalItemDraft.is_completed || false}
                                      onChange={(e) => setEditingGoalItemDraft((prev) => prev ? { ...prev, is_completed: e.target.checked } : null)}
                                      className="h-4 w-4 accent-emerald-500"
                                    />
                                    <span className="text-xs font-medium text-zinc-600">{t('notes.goals.itemDoneLabel')}</span>
                                  </label>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-zinc-700 block mb-1">{t('notes.goals.itemResultLabel')}</label>
                                  <textarea
                                    value={editingGoalItemDraft.result || ''}
                                    onChange={(e) => setEditingGoalItemDraft((prev) => prev ? { ...prev, result: e.target.value } : null)}
                                    placeholder={t('notes.goals.itemResultPlaceholder')}
                                    rows={3}
                                    className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-emerald-500 resize-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-zinc-700 block mb-1">{t('notes.goals.itemMetadataLabel')}</label>
                                  <textarea
                                    value={JSON.stringify(editingGoalItemDraft.metadata || {}, null, 2)}
                                    onChange={(e) => {
                                      try {
                                        const parsed = JSON.parse(e.target.value) as Record<string, unknown>
                                        setEditingGoalItemDraft((prev) => prev ? { ...prev, metadata: parsed } : null)
                                      } catch {
                                        // Allow user to type, validation on save
                                      }
                                    }}
                                    placeholder='{"key": "value"}'
                                    rows={6}
                                    className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs font-mono text-zinc-900 outline-none focus:border-emerald-500 resize-none"
                                  />
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon-sm" disabled={savingGoalItem || !editingGoalItemDraft.content.trim()} onClick={() => void saveEditingGoalItem(item)} className="text-emerald-600 hover:bg-emerald-100">
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon-sm" disabled={savingGoalItem} onClick={cancelEditingGoalItem} className="text-zinc-500 hover:bg-zinc-200">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className={`text-sm px-1 py-0.5 rounded ${item.is_completed ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{item.content}</p>
                                <div className="flex gap-1.5 flex-wrap items-center mt-1">
                                  <span className="text-sm px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-block">{getGoalItemTypeLabel(item.item_type, t)}</span>
                                  {item.is_completed && <span className="text-sm px-1.5 py-0.5 rounded bg-emerald-500 text-white inline-block">{t('notes.goals.itemDoneBadge')}</span>}
                                </div>
                                {item.result && (
                                  <div className="mt-1.5 p-1.5 rounded-md bg-blue-50 border border-blue-100">
                                    <p className="text-sm font-medium text-blue-900">{t('notes.goals.itemResultLabel')}</p>
                                    <p className="text-sm text-blue-800 whitespace-pre-wrap mt-0.5">{item.result}</p>
                                  </div>
                                )}
                                {item.metadata && Object.keys(item.metadata).length > 0 && (
                                  <p className="text-sm text-zinc-600 mt-1">{Object.entries(item.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(', ')}</p>
                                )}
                              </>
                            )}
                          </div>
                          {editingGoalItemId !== item.id && (
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon-sm" onClick={() => startEditingGoalItem(item)} className="text-emerald-400 hover:bg-emerald-100 hover:text-emerald-600">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => setDeleteGoalItem(item)} className="text-rose-300 hover:bg-rose-500/15">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                      {(goalItems[goal.id] || []).length === 0 && <p className="text-sm text-zinc-400 italic">{t('notes.goals.itemsEmpty')}</p>}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        void addGoalItem(goal)
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={goalItemDraft[goal.id]?.content || ''}
                        onChange={(e) => setGoalItemDraft((prev) => ({
                          ...prev,
                          [goal.id]: { ...prev[goal.id], content: e.target.value, item_type: prev[goal.id]?.item_type || 'routine' },
                        }))}
                        placeholder={t('notes.goals.itemAddPlaceholder')}
                        className="flex-1 rounded-lg border border-dashed border-emerald-200 bg-transparent px-2 py-1.5 text-xs text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white"
                      />
                      <select
                        value={goalItemDraft[goal.id]?.item_type || 'routine'}
                        onChange={(e) => setGoalItemDraft((prev) => ({
                          ...prev,
                          [goal.id]: {
                            content: prev[goal.id]?.content || '',
                            item_type: e.target.value,
                            metadata: prev[goal.id]?.metadata || {},
                          },
                        }))}
                        className="h-8 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
                      >
                        <option value="routine">{t('notes.goals.itemTypeOptions.routine')}</option>
                        <option value="meal">{t('notes.goals.itemTypeOptions.meal')}</option>
                        <option value="lesson">{t('notes.goals.itemTypeOptions.lesson')}</option>
                        <option value="exercise">{t('notes.goals.itemTypeOptions.exercise')}</option>
                        <option value="other">{t('notes.goals.itemTypeOptions.other')}</option>
                      </select>
                      <button
                        type="submit"
                        disabled={savingGoalItem || !goalItemDraft[goal.id]?.content?.trim()}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t('common.add')}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )
          })}

          {filteredGoals.length === 0 && (
            <div className="text-center py-8 text-zinc-500">{t('notes.goals.empty')}</div>
          )}
        </div>
      </div>

      {previewGoal && (
        <GoalDetailPreviewModal
          goal={previewGoal}
          items={goalItems[previewGoal.id] || []}
          lang={lang}
          onClose={() => setPreviewGoal(null)}
          onEdit={(goal) => {
            setPreviewGoal(null)
            startEditingGoal(goal)
          }}
          t={t}
        />
      )}
    </section>
  )
}