import type { Goal, GoalItem } from '@/types'

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

// A bare 'YYYY-MM-DD' string (from <DatePicker>/Supabase) parses as UTC
// midnight via `new Date(str)`, but `now`/"today" are always a local instant
// -- mixing the two silently shifts elapsed/overdue calculations by up to a
// day depending on the viewer's timezone offset. Appending a bare time (no
// 'Z'/offset) makes JS parse the same string as LOCAL midnight instead,
// matching what the date actually means to whoever entered it.
export function parseLocalDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00`)
}

export function formatLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type GoalProgress = {
  elapsedDays: number
  totalDays: number
  remainingDays: number
}

export function computeGoalProgress(
  startDate?: string,
  targetDate?: string,
  now: Date = new Date()
): GoalProgress | null {
  if (!startDate || !targetDate) return null
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(targetDate)
  return {
    totalDays: Math.ceil((end.getTime() - start.getTime()) / 86400000),
    elapsedDays: Math.ceil((now.getTime() - start.getTime()) / 86400000),
    remainingDays: Math.ceil((end.getTime() - now.getTime()) / 86400000),
  }
}

export type GoalDisplayStatus = Goal['status'] | 'overdue'

export function computeGoalDisplayStatus(
  status: Goal['status'],
  targetDate?: string,
  today: string = formatLocalDateString(new Date())
): GoalDisplayStatus {
  if (status === 'active' && targetDate && targetDate < today) return 'overdue'
  return status
}
