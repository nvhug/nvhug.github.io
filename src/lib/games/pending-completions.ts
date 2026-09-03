/**
 * Completions that failed to save, waiting for the next attempt.
 *
 * The queue lives here, at module level, and not in the play page: the page
 * unmounts the moment the player moves to the next level, and a queue that died
 * with it took the unsaved completion with it — and with it the record that
 * unlocks the level now on screen (spec 013 FR-012, FR-028).
 *
 * In memory only. Nothing here reaches browser storage, in whole or in part
 * (FR-027), so the queue is gone on a reload — which is the same outcome as
 * before, minus the mid-session loss.
 */

export interface PendingCompletion {
  /** Identity for removal: two solves of one level are two entries. */
  id: number
  gameId: string
  levelKey: string
  timeMs: number
}

let queue: PendingCompletion[] = []
let nextId = 1

export function enqueue(input: Omit<PendingCompletion, 'id'>): PendingCompletion {
  const entry: PendingCompletion = { id: nextId++, ...input }
  queue.push(entry)
  return entry
}

/** A snapshot — callers iterate it while removing the entries that succeeded. */
export function list(): readonly PendingCompletion[] {
  return [...queue]
}

export function remove(id: number): void {
  queue = queue.filter((entry) => entry.id !== id)
}

export function pendingFor(gameId: string): PendingCompletion[] {
  return queue.filter((entry) => entry.gameId === gameId)
}

export function clearPendingCompletions(): void {
  queue = []
}
