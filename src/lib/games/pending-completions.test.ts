import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPendingCompletions,
  enqueue,
  list,
  pendingFor,
  remove,
} from './pending-completions'

describe('pending completions', () => {
  beforeEach(clearPendingCompletions)

  it('lists what was enqueued, in the order it happened', () => {
    enqueue({ gameId: 'block-puzzle', levelKey: '1', timeMs: 5000 })
    enqueue({ gameId: 'block-puzzle', levelKey: '2', timeMs: 6000 })
    expect(list().map((e) => e.levelKey)).toEqual(['1', '2'])
  })

  it('gives every entry its own id, so two solves of one level both queue', () => {
    const first = enqueue({ gameId: 'block-puzzle', levelKey: '1', timeMs: 5000 })
    const second = enqueue({ gameId: 'block-puzzle', levelKey: '1', timeMs: 4000 })
    expect(first.id).not.toBe(second.id)
    expect(list()).toHaveLength(2)
  })

  it('removes only the entry named', () => {
    const first = enqueue({ gameId: 'block-puzzle', levelKey: '1', timeMs: 5000 })
    enqueue({ gameId: 'block-puzzle', levelKey: '2', timeMs: 6000 })
    remove(first.id)
    expect(list().map((e) => e.levelKey)).toEqual(['2'])
  })

  it('ignores a removal for an entry that is already gone', () => {
    const entry = enqueue({ gameId: 'block-puzzle', levelKey: '1', timeMs: 5000 })
    remove(entry.id)
    remove(entry.id)
    expect(list()).toEqual([])
  })

  it('filters by game', () => {
    enqueue({ gameId: 'block-puzzle', levelKey: '1', timeMs: 5000 })
    enqueue({ gameId: '2048', levelKey: 'classic', timeMs: 7000 })
    expect(pendingFor('block-puzzle').map((e) => e.levelKey)).toEqual(['1'])
    expect(pendingFor('memory')).toEqual([])
  })

  it('survives being read twice without handing out the live array', () => {
    enqueue({ gameId: 'block-puzzle', levelKey: '1', timeMs: 5000 })
    const snapshot = list()
    clearPendingCompletions()
    expect(snapshot).toHaveLength(1)
    expect(list()).toEqual([])
  })
})
