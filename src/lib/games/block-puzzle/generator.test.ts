import { describe, expect, it } from 'vitest'
import { canPlace, initialState, isSolved, place, type Level, type Piece } from './board'
import { generateLevel } from './generator'
import { CAMPAIGN_LEVELS, gridFor, looseCountFor, tierOf } from './tiers'

const ALL_LEVELS = Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => i + 1)

function isConnected(cells: readonly (readonly [number, number])[]): boolean {
  if (cells.length === 0) return false
  const set = new Set(cells.map(([x, y]) => `${x},${y}`))
  const seen = new Set<string>()
  const stack = [cells[0]]
  while (stack.length) {
    const [x, y] = stack.pop()!
    const key = `${x},${y}`
    if (seen.has(key)) continue
    seen.add(key)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = `${x + dx},${y + dy}`
      if (set.has(n) && !seen.has(n)) stack.push([x + dx, y + dy])
    }
  }
  return seen.size === set.size
}

function cavityCells(level: Level): [number, number][] {
  const out: [number, number][] = []
  level.cavity.forEach((row, y) => row.forEach((v, x) => { if (v) out.push([x, y]) }))
  return out
}

function solve(level: Level) {
  let state = initialState(level)
  for (const piece of level.pieces) {
    if (level.fixedIds.includes(piece.id)) continue
    expect(canPlace(level, state, piece, piece.solution)).toBe(true)
    state = place(state, piece.id, piece.solution)
  }
  return state
}

describe('generateLevel — every campaign level', () => {
  const levels = ALL_LEVELS.map((n) => generateLevel(n))

  it('uses the tier grid and holds one connected cavity', () => {
    for (const lv of levels) {
      expect(lv.cols).toBe(gridFor(lv.level))
      expect(lv.rows).toBe(gridFor(lv.level))
      expect(lv.tier).toBe(tierOf(lv.level).index)
      expect(isConnected(cavityCells(lv))).toBe(true)
    }
  })

  it('has pieces that are connected, sized for the tier, and normalised', () => {
    for (const lv of levels) {
      const [min, max] = tierOf(lv.level).sizes
      for (const piece of lv.pieces) {
        expect(isConnected(piece.cells)).toBe(true)
        expect(piece.cells.length).toBeGreaterThanOrEqual(min)
        expect(piece.cells.length).toBeLessThanOrEqual(max)
        expect(Math.min(...piece.cells.map((c) => c[0]))).toBe(0)
        expect(Math.min(...piece.cells.map((c) => c[1]))).toBe(0)
      }
    }
  })

  it('tiles the cavity exactly when every piece is at its solution', () => {
    for (const lv of levels) {
      const total = lv.pieces.reduce((n, p) => n + p.cells.length, 0)
      expect(cavityCells(lv)).toHaveLength(total)
      expect(isSolved(lv, solve(lv))).toBe(true)
    }
  })

  it('pre-seats the tier fixed count and trays the rest in a permutation', () => {
    for (const lv of levels) {
      const tier = tierOf(lv.level)
      expect(lv.fixedIds).toHaveLength(tier.fixed)
      const loose = lv.pieces.filter((p: Piece) => !lv.fixedIds.includes(p.id)).map((p) => p.id)
      expect(loose).toHaveLength(looseCountFor(lv.level))
      expect([...lv.trayOrder].sort()).toEqual([...loose].sort())
      for (const id of lv.fixedIds) expect(lv.pieces.some((p) => p.id === id)).toBe(true)
    }
  })

  it('carries a positive par', () => {
    for (const lv of levels) expect(lv.parMs).toBeGreaterThan(0)
  })

  it('is byte-identical across two generations', () => {
    for (const n of ALL_LEVELS) {
      expect(JSON.stringify(generateLevel(n))).toBe(JSON.stringify(generateLevel(n)))
    }
  })

  it('rarely needs the rectangular fallback', () => {
    const fallbacks = levels.filter((lv) => lv.fallback)
    expect(fallbacks.length).toBeLessThan(CAMPAIGN_LEVELS * 0.1)
    const tier5 = levels.filter((lv) => lv.tier === 5)
    expect(tier5.filter((lv) => lv.fallback).length).toBeLessThan(tier5.length * 0.25)
  })

  it('generates fast enough to run on first paint', () => {
    const start = performance.now()
    for (const n of ALL_LEVELS) generateLevel(n)
    const perLevel = (performance.now() - start) / CAMPAIGN_LEVELS
    expect(perLevel).toBeLessThan(5)
  })
})

describe('generateLevel — input guard', () => {
  it('rejects a level outside the campaign', () => {
    expect(() => generateLevel(0)).toThrow()
    expect(() => generateLevel(CAMPAIGN_LEVELS + 1)).toThrow()
  })
})
