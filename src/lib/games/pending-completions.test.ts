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

  it('accepts a score-only entry with no time', () => {
    const entry = enqueue({ gameId: 'lost-dog', levelKey: 'endless', score: 4200 })
    expect(entry.timeMs).toBeUndefined()
    expect(entry.score).toBe(4200)
    expect(list()).toEqual([entry])
  })

  it('accepts a time-only entry with no score (existing block-puzzle shape)', () => {
    const entry = enqueue({ gameId: 'block-puzzle', levelKey: '1', timeMs: 5000 })
    expect(entry.score).toBeUndefined()
    expect(entry.timeMs).toBe(5000)
  })

  it('accepts an entry carrying both time and score', () => {
    const entry = enqueue({ gameId: 'lost-dog', levelKey: 'endless', timeMs: 90000, score: 4200 })
    expect(entry.timeMs).toBe(90000)
    expect(entry.score).toBe(4200)
  })
})
