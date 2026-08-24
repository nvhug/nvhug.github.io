// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GoalItem } from '@/types'
import { useGoalsActions } from './useGoalsActions'

const mockSupabaseFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function item(id: string, order: number | undefined, overrides: Partial<GoalItem> = {}): GoalItem {
  return {
    id,
    goal_id: 'goal-1',
    content: id,
    item_type: 'routine',
    is_completed: false,
    order,
    created_at: '2026-08-03T00:00:00.000Z',
    ...overrides,
  }
}

function setup(items: GoalItem[], overrides: Partial<Parameters<typeof useGoalsActions>[0]> = {}) {
  const setGoalItems = vi.fn()
  const { result } = renderHook(() =>
    useGoalsActions({
      deleteGoal: null,
      deleteGoalItem: null,
      editingGoalDraft: null,
      editingGoalItemDraft: null,
      expandedGoal: null,
      fetchGoalItems: vi.fn().mockResolvedValue(items),
      goalDraft: null,
      goalItemDraft: {},
      goalItems: { 'goal-1': items },
      setCollapsedGoalIds: vi.fn(),
      setDeleteGoal: vi.fn(),
      setDeleteGoalItem: vi.fn(),
      setDeletingGoal: vi.fn(),
      setDeletingGoalItem: vi.fn(),
      setEditingGoalDraft: vi.fn(),
      setEditingGoalId: vi.fn(),
      setEditingGoalItemDraft: vi.fn(),
      setEditingGoalItemId: vi.fn(),
      setExpandedGoal: vi.fn(),
      setGoalDraft: vi.fn(),
      setGoalItemDraft: vi.fn(),
      setGoalItems,
      setGoals: vi.fn(),
      setSavingGoal: vi.fn(),
      setSavingGoalItem: vi.fn(),
      t: (key: string) => key,
      ...overrides,
    })
  )
  return { result, setGoalItems }
}

describe('useGoalsActions reorderGoalItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an out-of-range reorder as a true no-op, even when order is unset', async () => {
    // Items that have never been dragged have no order value set (the
    // GoalItem type declares it optional; Supabase itself may return null
    // for the same nullable column) -- a rejected reorder must not fall
    // through to a "corrective" Supabase write just because an unset order
    // doesn't equal the recomputed sequential order.
    const items = [item('a', undefined), item('b', undefined), item('c', undefined)]
    const { result, setGoalItems } = setup(items)

    await act(async () => {
      await result.current.reorderGoalItems('goal-1', 0, 5)
    })

    expect(setGoalItems).not.toHaveBeenCalled()
    expect(mockSupabaseFrom).not.toHaveBeenCalled()
  })

  it('still writes the recomputed order for a genuine in-range reorder', async () => {
    // Orders intentionally non-sequential (not idx+1) so this exercises the
    // reorder path without depending on a separate, pre-existing quirk in
    // the update-diff below (it compares old/new order BY POSITION, not by
    // item id, so already-sequential 1..N orders coincidentally look
    // unchanged after any pure reshuffle -- out of scope for this fix).
    const items = [item('a', 5), item('b', 10), item('c', 15)]
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockSupabaseFrom.mockReturnValue({ update })
    const { result, setGoalItems } = setup(items)

    await act(async () => {
      await result.current.reorderGoalItems('goal-1', 0, 2)
    })

    expect(setGoalItems).toHaveBeenCalled()
    expect(mockSupabaseFrom).toHaveBeenCalledWith('goal_items')
    expect(update).toHaveBeenCalled()
  })
})

describe('useGoalsActions toggleGoalItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets completed_at when completing a not-yet-completed item', async () => {
    const target = item('a', 1, { is_completed: false, completed_at: null })
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockSupabaseFrom.mockReturnValue({ update })
    const { result, setGoalItems } = setup([target])

    await act(async () => {
      await result.current.toggleGoalItem(target)
    })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_completed: true, completed_at: expect.any(String) }))
    const patcher = setGoalItems.mock.calls[0][0]
    const patched = patcher({ 'goal-1': [target] })['goal-1'][0]
    expect(patched.completed_at).toEqual(expect.any(String))
  })

  it('clears completed_at when un-completing a completed item', async () => {
    const target = item('a', 1, { is_completed: true, completed_at: '2026-08-01T00:00:00.000Z' })
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockSupabaseFrom.mockReturnValue({ update })
    const { result, setGoalItems } = setup([target])

    await act(async () => {
      await result.current.toggleGoalItem(target)
    })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_completed: false, completed_at: null }))
    const patcher = setGoalItems.mock.calls[0][0]
    const patched = patcher({ 'goal-1': [target] })['goal-1'][0]
    expect(patched.completed_at).toBeNull()
  })

  it('rolls back completed_at (not just is_completed) on a failed write', async () => {
    const target = item('a', 1, { is_completed: false, completed_at: null })
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: new Error('boom') }) })
    mockSupabaseFrom.mockReturnValue({ update })
    const { result, setGoalItems } = setup([target])

    await act(async () => {
      await result.current.toggleGoalItem(target)
    })

    // Second call is the rollback (first is the optimistic update).
    const rollback = setGoalItems.mock.calls[1][0]
    const rolledBack = rollback({ 'goal-1': [target] })['goal-1'][0]
    expect(rolledBack.is_completed).toBe(false)
    expect(rolledBack.completed_at).toBeNull()
  })
})

describe('useGoalsActions saveEditingGoalItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets completed_at when the edit form transitions the item to completed', async () => {
    const target = item('a', 1, { is_completed: false, completed_at: null })
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockSupabaseFrom.mockReturnValue({ update })
    const { result } = setup([target], {
      editingGoalItemDraft: { content: 'a', item_type: 'routine', is_completed: true, order: 1 },
    })

    await act(async () => {
      await result.current.saveEditingGoalItem(target)
    })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_completed: true, completed_at: expect.any(String) }))
  })

  it('clears completed_at when the edit form transitions the item to not-completed', async () => {
    const target = item('a', 1, { is_completed: true, completed_at: '2026-08-01T00:00:00.000Z' })
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockSupabaseFrom.mockReturnValue({ update })
    const { result } = setup([target], {
      editingGoalItemDraft: { content: 'a', item_type: 'routine', is_completed: false, order: 1 },
    })

    await act(async () => {
      await result.current.saveEditingGoalItem(target)
    })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_completed: false, completed_at: null }))
  })

  it('leaves completed_at untouched when re-saving with completed state unchanged', async () => {
    const target = item('a', 1, { is_completed: true, completed_at: '2026-08-01T00:00:00.000Z' })
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockSupabaseFrom.mockReturnValue({ update })
    const { result } = setup([target], {
      // Only content changed; is_completed stays true -- must not re-stamp completed_at.
      editingGoalItemDraft: { content: 'edited', item_type: 'routine', is_completed: true, order: 1 },
    })

    await act(async () => {
      await result.current.saveEditingGoalItem(target)
    })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ completed_at: '2026-08-01T00:00:00.000Z' }))
  })
})
