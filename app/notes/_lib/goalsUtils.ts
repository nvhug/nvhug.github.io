import type { GoalItem } from '@/types'

export function reorderGoalItemsLocal(items: GoalItem[], fromIndex: number, toIndex: number): GoalItem[] {
  if (fromIndex === toIndex) return [...items]
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return [...items]
  const next = [...items]
  const [movedItem] = next.splice(fromIndex, 1)
  if (!movedItem) return [...items]
  next.splice(toIndex, 0, movedItem)
  return next
}

export function patchGoalItemCompletion(items: GoalItem[], itemId: string, isCompleted: boolean): GoalItem[] {
  return items.map((item) => (item.id === itemId ? { ...item, is_completed: isCompleted } : item))
}

export function isValidGoalDateRange(startDate?: string, targetDate?: string): boolean {
  if (!startDate || !targetDate) return true
  return startDate <= targetDate
}
