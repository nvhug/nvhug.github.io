import { describe, expect, it } from 'vitest'

import type { GoalItem } from '@/types'
import { isValidGoalDateRange, patchGoalItemCompletion, reorderGoalItemsLocal } from './goalsUtils'

function item(id: string, order: number): GoalItem {
  return {
    id,
    goal_id: 'goal-1',
    content: id,
    item_type: 'routine',
    is_completed: false,
    order,
    created_at: '2026-08-03T00:00:00.000Z',
  }
}

describe('goals utils', () => {
  it('reorders items by index', () => {
    const source = [item('a', 1), item('b', 2), item('c', 3)]
    const reordered = reorderGoalItemsLocal(source, 0, 2)

    expect(reordered.map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(source.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('patches completion for a single goal item', () => {
    const source = [item('a', 1), item('b', 2)]
    const patched = patchGoalItemCompletion(source, 'b', true)

    expect(patched[0].is_completed).toBe(false)
    expect(patched[1].is_completed).toBe(true)
  })

  it('rejects a start date after the target date', () => {
    expect(isValidGoalDateRange('2026-06-01', '2026-05-01')).toBe(false)
  })

  it('accepts a start date before the target date', () => {
    expect(isValidGoalDateRange('2026-05-01', '2026-06-01')).toBe(true)
  })

  it('accepts equal start and target dates', () => {
    expect(isValidGoalDateRange('2026-05-01', '2026-05-01')).toBe(true)
  })

  it('accepts when either date is empty', () => {
    expect(isValidGoalDateRange('', '2026-05-01')).toBe(true)
    expect(isValidGoalDateRange('2026-05-01', '')).toBe(true)
    expect(isValidGoalDateRange('', '')).toBe(true)
  })
})
