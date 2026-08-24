'use client'

import { useCallback } from 'react'

import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import type { Goal, GoalItem } from '@/types'
import type { GoalDraft, GoalItemDraft, SetState, Translate } from '../_components/tabs/types'
import { isValidGoalDateRange, nextCompletedAt, patchGoalItemCompletion, reorderGoalItemsLocal } from '../_lib/goalsUtils'

type UseGoalsActionsParams = {
  deleteGoal: Goal | null
  deleteGoalItem: GoalItem | null
  editingGoalDraft: GoalDraft | null
  editingGoalItemDraft: GoalItemDraft | null
  expandedGoal: string | null
  fetchGoalItems: (goalId: string) => Promise<GoalItem[]>
  goalDraft: GoalDraft | null
  goalItemDraft: { [goalId: string]: GoalItemDraft }
  goalItems: { [goalId: string]: GoalItem[] }
  setCollapsedGoalIds: SetState<string[]>
  setDeleteGoal: SetState<Goal | null>
  setDeleteGoalItem: SetState<GoalItem | null>
  setDeletingGoal: SetState<boolean>
  setDeletingGoalItem: SetState<boolean>
  setEditingGoalDraft: SetState<GoalDraft | null>
  setEditingGoalId: SetState<string | null>
  setEditingGoalItemDraft: SetState<GoalItemDraft | null>
  setEditingGoalItemId: SetState<string | null>
  setExpandedGoal: SetState<string | null>
  setGoalDraft: SetState<GoalDraft | null>
  setGoalItemDraft: SetState<{ [goalId: string]: GoalItemDraft }>
  setGoalItems: SetState<{ [goalId: string]: GoalItem[] }>
  setGoals: SetState<Goal[]>
  setSavingGoal: SetState<boolean>
  setSavingGoalItem: SetState<boolean>
  t: Translate
}

export function useGoalsActions(params: UseGoalsActionsParams) {
  const {
    deleteGoal,
    deleteGoalItem,
    editingGoalDraft,
    editingGoalItemDraft,
    expandedGoal,
    fetchGoalItems,
    goalDraft,
    goalItemDraft,
    goalItems,
    setCollapsedGoalIds,
    setDeleteGoal,
    setDeleteGoalItem,
    setDeletingGoal,
    setDeletingGoalItem,
    setEditingGoalDraft,
    setEditingGoalId,
    setEditingGoalItemDraft,
    setEditingGoalItemId,
    setExpandedGoal,
    setGoalDraft,
    setGoalItemDraft,
    setGoalItems,
    setGoals,
    setSavingGoal,
    setSavingGoalItem,
    t,
  } = params

  const openGoalDraft = useCallback(() => {
    setGoalDraft({
      title: '',
      type: 'health',
      description: '',
      target_date: '',
      status: 'active',
      completion_percentage: 0,
    })
  }, [setGoalDraft])

  const cancelGoalDraft = useCallback(() => {
    setGoalDraft(null)
  }, [setGoalDraft])

  const addGoal = useCallback(async () => {
    if (!goalDraft || !goalDraft.title.trim()) return
    setSavingGoal(true)
    try {
      const { error } = await supabase.from('goals').insert([goalDraft])
      if (error) throw error
      setGoalDraft(null)
      const { data, error: fetchError } = await supabase.from('goals').select('*').order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      setGoals((data || []) as Goal[])
      toast.success(t('notes.goals.addSuccess'))
    } catch {
      toast.error(t('notes.goals.addError'))
    } finally {
      setSavingGoal(false)
    }
  }, [goalDraft, setGoalDraft, setGoals, setSavingGoal, t])

  const confirmDeleteGoal = useCallback(async () => {
    if (!deleteGoal) return
    setDeletingGoal(true)
    try {
      const { error } = await supabase.from('goals').delete().eq('id', deleteGoal.id)
      if (error) throw error
      setGoals((prev) => prev.filter((goal) => goal.id !== deleteGoal.id))
      setCollapsedGoalIds((prev) => prev.filter((id) => id !== deleteGoal.id))
      if (expandedGoal === deleteGoal.id) {
        setExpandedGoal(null)
      }
      setDeleteGoal(null)
      toast.success(t('notes.goals.deleteSuccess'))
    } catch {
      toast.error(t('notes.toasts.deleteError'))
    } finally {
      setDeletingGoal(false)
    }
  }, [deleteGoal, expandedGoal, setCollapsedGoalIds, setDeleteGoal, setDeletingGoal, setExpandedGoal, setGoals, t])

  const updateGoalStatus = useCallback(async (goal: Goal, newStatus: Goal['status']) => {
    try {
      const { error } = await supabase.from('goals').update({ status: newStatus }).eq('id', goal.id)
      if (error) throw error
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status: newStatus } : g)))
      toast.success(t('notes.goals.statusUpdateSuccess'))
    } catch {
      toast.error(t('notes.goals.statusUpdateError'))
    }
  }, [setGoals, t])

  const addGoalItem = useCallback(async (goal: Goal) => {
    const draft = goalItemDraft[goal.id]
    if (!draft || !draft.content?.trim()) return

    setSavingGoalItem(true)
    try {
      const { error } = await supabase.from('goal_items').insert([{
        goal_id: goal.id,
        content: draft.content,
        item_type: draft.item_type,
        metadata: draft.metadata || {},
        is_completed: false,
      }])
      if (error) throw error
      const items = await fetchGoalItems(goal.id)
      setGoalItems((prev) => ({ ...prev, [goal.id]: items }))
      setGoalItemDraft((prev) => ({ ...prev, [goal.id]: { content: '', item_type: draft.item_type, metadata: {} } }))
      toast.success(t('notes.goals.itemAddSuccess'))
    } catch {
      toast.error(t('notes.goals.itemAddError'))
    } finally {
      setSavingGoalItem(false)
    }
  }, [fetchGoalItems, goalItemDraft, setGoalItemDraft, setGoalItems, setSavingGoalItem, t])

  const confirmDeleteGoalItem = useCallback(async () => {
    if (!deleteGoalItem) return
    setDeletingGoalItem(true)
    try {
      const { error } = await supabase.from('goal_items').delete().eq('id', deleteGoalItem.id)
      if (error) throw error
      setGoalItems((prev) => ({
        ...prev,
        [deleteGoalItem.goal_id]: prev[deleteGoalItem.goal_id]?.filter((i) => i.id !== deleteGoalItem.id) || [],
      }))
      setDeleteGoalItem(null)
      toast.success(t('notes.toasts.deleteSuccess'))
    } catch {
      toast.error(t('notes.toasts.deleteError'))
    } finally {
      setDeletingGoalItem(false)
    }
  }, [deleteGoalItem, setDeleteGoalItem, setDeletingGoalItem, setGoalItems, t])

  const toggleGoalItem = useCallback(async (item: GoalItem) => {
    const previousIsCompleted = !!item.is_completed
    const previousCompletedAt = item.completed_at ?? null
    const nextIsCompleted = !previousIsCompleted
    const nextCompletedAtValue = nextCompletedAt(previousIsCompleted, nextIsCompleted, previousCompletedAt)

    setGoalItems((prev) => ({
      ...prev,
      [item.goal_id]: patchGoalItemCompletion(prev[item.goal_id] || [], item.id, nextIsCompleted, nextCompletedAtValue),
    }))

    try {
      const { error } = await supabase.from('goal_items')
        .update({ is_completed: nextIsCompleted, completed_at: nextCompletedAtValue })
        .eq('id', item.id)
      if (error) throw error
    } catch {
      setGoalItems((prev) => ({
        ...prev,
        [item.goal_id]: patchGoalItemCompletion(prev[item.goal_id] || [], item.id, previousIsCompleted, previousCompletedAt),
      }))
      toast.error(t('notes.toasts.updateError'))
    }
  }, [setGoalItems, t])

  const reorderGoalItems = useCallback(async (goalId: string, fromIndex: number, toIndex: number) => {
    const items = goalItems[goalId]
    if (!items || fromIndex === toIndex) return

    const newItems = reorderGoalItemsLocal(items, fromIndex, toIndex)
    // reorderGoalItemsLocal rejects an out-of-range index by returning the
    // items unchanged (same order, new array) — detect that here instead of
    // re-validating the indices, so a rejected reorder is a true no-op and
    // never falls through to the order-diff below (which compares against
    // `order`, nullable for items never yet dragged, and would otherwise
    // still push a "corrective" write to Supabase for those items).
    if (newItems.every((item, idx) => item.id === items[idx]?.id)) return

    setGoalItems((prev) => ({ ...prev, [goalId]: newItems }))

    try {
      const updates = newItems
        .map((goalItem, idx) => ({ id: goalItem.id, order: idx + 1 }))
        .filter((update, idx) => items[idx]?.order !== update.order)

      if (updates.length === 0) return

      const results = await Promise.all(
        updates.map((update) =>
          supabase
            .from('goal_items')
            .update({ order: update.order })
            .eq('id', update.id)
        )
      )

      const firstError = results.find((result) => result.error)?.error
      if (firstError) throw firstError
    } catch {
      toast.error(t('notes.goals.reorderError'))
      const refreshedItems = await fetchGoalItems(goalId)
      setGoalItems((prev) => ({ ...prev, [goalId]: refreshedItems }))
    }
  }, [fetchGoalItems, goalItems, setGoalItems, t])

  const startEditingGoalItem = useCallback((item: GoalItem) => {
    setEditingGoalItemId(item.id)
    setEditingGoalItemDraft({
      content: item.content,
      item_type: item.item_type,
      metadata: item.metadata || {},
      result: item.result || '',
      is_completed: !!item.is_completed,
    })
  }, [setEditingGoalItemDraft, setEditingGoalItemId])

  const cancelEditingGoalItem = useCallback(() => {
    setEditingGoalItemId(null)
    setEditingGoalItemDraft(null)
  }, [setEditingGoalItemDraft, setEditingGoalItemId])

  const saveEditingGoalItem = useCallback(async (item: GoalItem) => {
    if (!editingGoalItemDraft || !editingGoalItemDraft.content.trim()) {
      toast.error(t('notes.toasts.contentEmptyError'))
      return
    }

    try {
      if (editingGoalItemDraft.metadata && typeof editingGoalItemDraft.metadata === 'object') {
        JSON.stringify(editingGoalItemDraft.metadata)
      }
    } catch {
      toast.error(t('notes.goals.itemMetadataInvalid'))
      return
    }

    const wasCompleted = !!item.is_completed
    const isCompleted = editingGoalItemDraft.is_completed || false
    const completedAt = nextCompletedAt(wasCompleted, isCompleted, item.completed_at)

    setSavingGoalItem(true)
    try {
      const { error } = await supabase.from('goal_items').update({
        content: editingGoalItemDraft.content,
        item_type: editingGoalItemDraft.item_type,
        result: editingGoalItemDraft.result || null,
        metadata: editingGoalItemDraft.metadata || {},
        is_completed: isCompleted,
        completed_at: completedAt,
      }).eq('id', item.id)
      if (error) throw error

      setGoalItems((prev) => ({
        ...prev,
        [item.goal_id]: prev[item.goal_id]?.map((i) =>
          i.id === item.id
            ? {
                ...i,
                content: editingGoalItemDraft.content,
                item_type: editingGoalItemDraft.item_type,
                result: editingGoalItemDraft.result,
                metadata: editingGoalItemDraft.metadata,
                is_completed: isCompleted,
                completed_at: completedAt,
              }
            : i
        ) || [],
      }))

      setEditingGoalItemId(null)
      setEditingGoalItemDraft(null)
      toast.success(t('notes.toasts.updateSuccess'))
    } catch {
      toast.error(t('notes.toasts.updateError'))
    } finally {
      setSavingGoalItem(false)
    }
  }, [editingGoalItemDraft, setEditingGoalItemDraft, setEditingGoalItemId, setGoalItems, setSavingGoalItem, t])

  const startEditingGoal = useCallback((goal: Goal) => {
    setCollapsedGoalIds((prev) => prev.filter((id) => id !== goal.id))
    setEditingGoalId(goal.id)
    setEditingGoalDraft({
      title: goal.title,
      type: goal.type,
      description: goal.description || '',
      start_date: goal.start_date || '',
      target_date: goal.target_date || '',
      status: goal.status,
      completion_percentage: goal.completion_percentage || 0,
    })
  }, [setCollapsedGoalIds, setEditingGoalDraft, setEditingGoalId])

  const cancelEditingGoal = useCallback(() => {
    setEditingGoalId(null)
    setEditingGoalDraft(null)
  }, [setEditingGoalDraft, setEditingGoalId])

  const saveEditingGoal = useCallback(async (goal: Goal) => {
    if (!editingGoalDraft || !editingGoalDraft.title.trim()) {
      toast.error(t('notes.goals.nameEmptyError'))
      return
    }

    if (!isValidGoalDateRange(editingGoalDraft.start_date, editingGoalDraft.target_date)) {
      toast.error(t('notes.goals.dateRangeError'))
      return
    }

    setSavingGoal(true)
    try {
      const { error } = await supabase.from('goals').update({
        title: editingGoalDraft.title,
        type: editingGoalDraft.type,
        description: editingGoalDraft.description,
        start_date: editingGoalDraft.start_date,
        target_date: editingGoalDraft.target_date,
        completion_percentage: editingGoalDraft.completion_percentage,
      }).eq('id', goal.id)
      if (error) throw error

      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, ...editingGoalDraft } : g)))

      setEditingGoalId(null)
      setEditingGoalDraft(null)
      toast.success(t('notes.goals.updateSuccess'))
    } catch {
      toast.error(t('notes.goals.updateError'))
    } finally {
      setSavingGoal(false)
    }
  }, [editingGoalDraft, setEditingGoalDraft, setEditingGoalId, setGoals, setSavingGoal, t])

  return {
    addGoal,
    addGoalItem,
    cancelEditingGoal,
    cancelEditingGoalItem,
    cancelGoalDraft,
    confirmDeleteGoal,
    confirmDeleteGoalItem,
    openGoalDraft,
    reorderGoalItems,
    saveEditingGoal,
    saveEditingGoalItem,
    startEditingGoal,
    startEditingGoalItem,
    toggleGoalItem,
    updateGoalStatus,
  }
}
