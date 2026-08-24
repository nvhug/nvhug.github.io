import { describe, expect, it } from 'vitest'

import type { GoalItem } from '@/types'
import {
  computeGoalDisplayStatus,
  computeGoalProgress,
  isValidGoalDateRange,
  nextCompletedAt,
  patchGoalItemCompletion,
  reorderGoalItemsLocal,
} from './goalsUtils'

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

  it('rejects a reorder with a negative fromIndex', () => {
    const source = [item('a', 1), item('b', 2), item('c', 3)]
    const reordered = reorderGoalItemsLocal(source, -1, 1)

    expect(reordered.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('rejects a reorder with a negative toIndex', () => {
    const source = [item('a', 1), item('b', 2), item('c', 3)]
    const reordered = reorderGoalItemsLocal(source, 1, -1)

    expect(reordered.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('rejects a reorder with fromIndex out of range', () => {
    const source = [item('a', 1), item('b', 2), item('c', 3)]
    const reordered = reorderGoalItemsLocal(source, 3, 1)

    expect(reordered.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('rejects a reorder with toIndex out of range', () => {
    const source = [item('a', 1), item('b', 2), item('c', 3)]
    const reordered = reorderGoalItemsLocal(source, 1, 3)

    expect(reordered.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('patches completion and completed_at for a single goal item', () => {
    const source = [item('a', 1), item('b', 2)]
    const patched = patchGoalItemCompletion(source, 'b', true, '2026-08-24T00:00:00.000Z')

    expect(patched[0].is_completed).toBe(false)
    expect(patched[0].completed_at).toBeUndefined()
    expect(patched[1].is_completed).toBe(true)
    expect(patched[1].completed_at).toBe('2026-08-24T00:00:00.000Z')
  })

  it('patches completed_at back to null when un-completing', () => {
    const source = [item('a', 1)]
    const patched = patchGoalItemCompletion(source, 'a', false, null)

    expect(patched[0].is_completed).toBe(false)
    expect(patched[0].completed_at).toBeNull()
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

  it('computes elapsed/total/remaining days when both dates are present', () => {
    // No 'Z'/offset -- parsed as LOCAL midnight, matching how computeGoalProgress
    // parses startDate/targetDate. Mixing a UTC `now` with locally-parsed dates
    // would reintroduce the exact timezone bug this function fixes.
    const now = new Date('2026-05-11T00:00:00')
    const progress = computeGoalProgress('2026-05-01', '2026-05-21', now)

    expect(progress).toEqual({ elapsedDays: 10, totalDays: 20, remainingDays: 10 })
  })

  it('returns a negative elapsedDays for a goal that has not started yet', () => {
    const now = new Date('2026-04-25T00:00:00')
    const progress = computeGoalProgress('2026-05-01', '2026-05-21', now)

    expect(progress).not.toBeNull()
    expect(progress?.elapsedDays).toBeLessThan(0)
  })

  it('returns null progress when either date is missing', () => {
    expect(computeGoalProgress(undefined, '2026-05-21')).toBeNull()
    expect(computeGoalProgress('2026-05-01', undefined)).toBeNull()
    expect(computeGoalProgress(undefined, undefined)).toBeNull()
  })

  it('marks an active goal overdue once the target date has passed', () => {
    expect(computeGoalDisplayStatus('active', '2026-05-01', '2026-05-02')).toBe('overdue')
  })

  it('does not mark an active goal overdue before the target date', () => {
    expect(computeGoalDisplayStatus('active', '2026-05-21', '2026-05-02')).toBe('active')
  })

  it('does not mark an active goal overdue on the target date itself', () => {
    expect(computeGoalDisplayStatus('active', '2026-05-02', '2026-05-02')).toBe('active')
  })

  it('never marks a completed or archived goal overdue', () => {
    expect(computeGoalDisplayStatus('completed', '2026-05-01', '2026-05-02')).toBe('completed')
    expect(computeGoalDisplayStatus('archived', '2026-05-01', '2026-05-02')).toBe('archived')
  })

  it('shows the plain status when there is no target date', () => {
    expect(computeGoalDisplayStatus('active', undefined, '2026-05-02')).toBe('active')
  })

  it('nextCompletedAt sets the timestamp when transitioning to completed', () => {
    const now = new Date('2026-08-24T10:00:00.000Z')
    expect(nextCompletedAt(false, true, undefined, now)).toBe('2026-08-24T10:00:00.000Z')
  })

  it('nextCompletedAt clears the timestamp when transitioning to not-completed', () => {
    const now = new Date('2026-08-24T10:00:00.000Z')
    expect(nextCompletedAt(true, false, '2026-08-01T00:00:00.000Z', now)).toBeNull()
  })

  it('nextCompletedAt leaves an existing timestamp untouched when completed state does not change', () => {
    const now = new Date('2026-08-24T10:00:00.000Z')
    expect(nextCompletedAt(true, true, '2026-08-01T00:00:00.000Z', now)).toBe('2026-08-01T00:00:00.000Z')
    expect(nextCompletedAt(false, false, null, now)).toBeNull()
  })
})
