import { describe, expect, it } from 'vitest'
import {
  canPlace,
  canPlaceWith,
  initialState,
  isSolved,
  landingCells,
  lift,
  occupancy,
  pieceBounds,
  place,
  placedCount,
  type Level,
} from './board'

// A 4×4 board whose cavity is the 3×2 block at x 0..2, y 0..1, tiled by an
// L-tromino (fixed) and a straight tromino (loose):
//   ■ ■ ■ .        F F L .
//   ■ ■ ■ .   →    F L L .
//   . . . .
//   . . . .
const level: Level = {
  level: 1,
  tier: 1,
  cols: 4,
  rows: 4,
  cavity: [
    [true, true, true, false],
    [true, true, true, false],
    [false, false, false, false],
    [false, false, false, false],
  ],
  pieces: [
    { id: 'F', cells: [[0, 0], [1, 0], [0, 1]], solution: [0, 0] },
    { id: 'L', cells: [[1, 0], [0, 1], [1, 1]], solution: [1, 0] },
  ],
  fixedIds: ['F'],
  trayOrder: ['L'],
  parMs: 30_000,
  fallback: false,
}

describe('initialState', () => {
  it('pre-seats the fixed pieces and nothing else', () => {
    const state = initialState(level)
    expect(state.placed.get('F')).toEqual([0, 0])
    expect(state.placed.has('L')).toBe(false)
    expect(placedCount(state)).toBe(1)
  })
})

describe('landingCells', () => {
  it('translates the piece cells to absolute board cells', () => {
    expect(landingCells(level.pieces[1], [1, 0])).toEqual([[2, 0], [1, 1], [2, 1]])
  })
})

describe('canPlace', () => {
  const state = initialState(level)
  const L = level.pieces[1]

  it('accepts the one legal spot', () => {
    expect(canPlace(level, state, L, [1, 0])).toBe(true)
  })

  it('rejects a cell outside the grid', () => {
    expect(canPlace(level, state, L, [3, 0])).toBe(false)
    expect(canPlace(level, state, L, [-1, 0])).toBe(false)
  })

  it('rejects a cell outside the cavity', () => {
    expect(canPlace(level, state, L, [1, 2])).toBe(false)
  })

  it('rejects a cell occupied by a fixed piece', () => {
    expect(canPlace(level, state, L, [0, 0])).toBe(false)
  })

  it('rejects a cell occupied by a player-placed piece', () => {
    const twoLoose: Level = {
      ...level,
      pieces: [level.pieces[1], { ...level.pieces[1], id: 'M' }],
      fixedIds: [],
      trayOrder: ['L', 'M'],
    }
    const withL = place(initialState(twoLoose), 'L', [1, 0])
    expect(canPlace(twoLoose, withL, twoLoose.pieces[1], [1, 0])).toBe(false)
  })
})

describe('place / lift', () => {
  it('place returns a new state and leaves the old one alone', () => {
    const before = initialState(level)
    const after = place(before, 'L', [1, 0])
    expect(after.placed.get('L')).toEqual([1, 0])
    expect(before.placed.has('L')).toBe(false)
  })

  it('lift removes a player piece', () => {
    const placed = place(initialState(level), 'L', [1, 0])
    const lifted = lift(level, placed, 'L')
    expect(lifted.placed.has('L')).toBe(false)
  })

  it('lift refuses a fixed piece and returns the same state', () => {
    const state = initialState(level)
    expect(lift(level, state, 'F')).toBe(state)
  })
})

describe('occupancy', () => {
  it('maps every occupied cell to its piece', () => {
    const state = place(initialState(level), 'L', [1, 0])
    const occ = occupancy(level, state)
    expect(occ.get('0,0')).toBe('F')
    expect(occ.get('2,1')).toBe('L')
    expect(occ.has('3,0')).toBe(false)
  })
})

describe('isSolved', () => {
  it('is false while a cavity cell is empty', () => {
    expect(isSolved(level, initialState(level))).toBe(false)
  })

  it('is true when every cavity cell is filled', () => {
    expect(isSolved(level, place(initialState(level), 'L', [1, 0]))).toBe(true)
  })
})

describe('pieceBounds', () => {
  it('measures the bounding box of the piece cells', () => {
    expect(pieceBounds(level.pieces[0])).toEqual({ w: 2, h: 2 })
  })

  it('is never smaller than one cell', () => {
    expect(pieceBounds({ id: 'S', cells: [[0, 0]], solution: [0, 0] })).toEqual({ w: 1, h: 1 })
  })

  it('measures a straight piece along its long axis', () => {
    expect(pieceBounds({ id: 'I', cells: [[0, 0], [1, 0], [2, 0]], solution: [0, 0] })).toEqual({ w: 3, h: 1 })
  })
})

describe('canPlaceWith', () => {
  const state = initialState(level)
  const occ = occupancy(level, state)
  const L = level.pieces[1]

  it('answers exactly as canPlace does from a precomputed occupancy map', () => {
    for (const at of [[1, 0], [0, 0], [2, 0], [0, 2]] as const) {
      expect(canPlaceWith(occ, level, L, at)).toBe(canPlace(level, state, L, at))
    }
  })

  it('lets a piece land back on the cells it already holds', () => {
    const placedL = place(state, 'L', [1, 0])
    expect(canPlaceWith(occupancy(level, placedL), level, L, [1, 0])).toBe(true)
  })
})
