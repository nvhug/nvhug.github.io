/**
 * Deterministic level generator (spec 013 FR-009, FR-010; plan R3).
 *
 * Solvability is by construction: the cavity is the union of the pieces, so the
 * puzzle is never searched for — it is cut. Steps, all seeded from the level
 * number:
 *   1. pick piece sizes from the tier's range;
 *   2. grow one connected cavity of that many cells on the grid;
 *   3. partition the cavity into connected polyominoes of those sizes;
 *   4. pre-seat the tier's fixed pieces; shuffle the rest into the tray.
 * If step 3 keeps failing, a snake-ordered rectangle is used instead — always
 * valid, flagged `fallback: true` so a test can keep it rare.
 */

import { cellKey, type Cell, type Level, type Piece } from './board'
import { createRng, randInt, seedFor, shuffle, type Rng } from '../rng'
import { CAMPAIGN_LEVELS, gridFor, looseCountFor, parTimeMs, tierOf } from './tiers'

/** Bumping this is a deliberate, visible reset of every puzzle for every player. */
export const GENERATOR_VERSION = 1

const CAVITY_ATTEMPTS = 40
const PARTITION_ATTEMPTS = 25

const NEIGHBOURS: readonly Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

export function generateLevel(level: number): Level {
  if (!Number.isInteger(level) || level < 1 || level > CAMPAIGN_LEVELS) {
    throw new RangeError(`level ${level} is outside the campaign (1..${CAMPAIGN_LEVELS})`)
  }
  const tier = tierOf(level)
  const size = gridFor(level)
  const pieceCount = looseCountFor(level) + tier.fixed
  const rng = createRng(seedFor(level, GENERATOR_VERSION))

  let groups: Cell[][] | null = null
  let fallback = false
  for (let attempt = 0; attempt < CAVITY_ATTEMPTS && !groups; attempt++) {
    const sizes = Array.from({ length: pieceCount }, () => randInt(rng, tier.sizes[0], tier.sizes[1]))
    const total = sizes.reduce((a, b) => a + b, 0)
    const cavity = growCavity(rng, size, total)
    for (let p = 0; p < PARTITION_ATTEMPTS && !groups; p++) {
      groups = partition(rng, cavity, sizes, tier.sizes[0])
    }
  }
  if (!groups) {
    const sizes = Array.from({ length: pieceCount }, () => randInt(rng, tier.sizes[0], tier.sizes[1]))
    groups = snakeRectangle(size, sizes)
    fallback = true
  }

  const pieces: Piece[] = groups.map((cells, i) => normalise(`p${i + 1}`, cells))
  const cavity = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  for (const piece of pieces) {
    for (const [dx, dy] of piece.cells) cavity[piece.solution[1] + dy][piece.solution[0] + dx] = true
  }

  // Fixed pieces: the largest ones, ties broken by the seeded order.
  const byWeight = shuffle(rng, pieces).sort((a, b) => b.cells.length - a.cells.length)
  const fixedIds = byWeight.slice(0, tier.fixed).map((p) => p.id)
  const looseIds = pieces.map((p) => p.id).filter((id) => !fixedIds.includes(id))
  const trayOrder = shuffle(rng, looseIds)

  return {
    level,
    tier: tier.index,
    cols: size,
    rows: size,
    cavity,
    pieces,
    fixedIds,
    trayOrder,
    parMs: parTimeMs(level, pieceCount),
    fallback,
  }
}

/** Grows one connected blob of `total` cells by random frontier expansion. */
function growCavity(rng: Rng, size: number, total: number): Set<string> {
  const inside = new Set<string>()
  const frontier: Cell[] = []
  const frontierKeys = new Set<string>()
  const mid = Math.floor(size / 2)
  const start: Cell = [randInt(rng, mid - 1, mid), randInt(rng, mid - 1, mid)]
  const add = ([x, y]: Cell) => {
    inside.add(cellKey(x, y))
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx
      const ny = y + dy
      const k = cellKey(nx, ny)
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || inside.has(k) || frontierKeys.has(k)) continue
      frontier.push([nx, ny])
      frontierKeys.add(k)
    }
  }
  add(start)
  while (inside.size < total && frontier.length) {
    // Prefer frontier cells that touch more of the blob: keeps the cavity compact
    // and irregular rather than stringy, which is what the reference looks like.
    const i = pickWeighted(rng, frontier, ([x, y]) => 1 + 2 * countInside(inside, x, y))
    const [cell] = frontier.splice(i, 1)
    frontierKeys.delete(cellKey(cell[0], cell[1]))
    add(cell)
  }
  return inside
}

function countInside(inside: Set<string>, x: number, y: number): number {
  let n = 0
  for (const [dx, dy] of NEIGHBOURS) if (inside.has(cellKey(x + dx, y + dy))) n++
  return n
}

function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): number {
  const weights = items.map(weight)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return i
  }
  return weights.length - 1
}

/**
 * Cuts the cavity into connected pieces of the given sizes. Most-constrained
 * first: each piece starts at the remaining cell with the fewest free
 * neighbours and grows along the boundary, which is what keeps it from
 * stranding one- or two-cell fragments. Returns null when it does.
 */
function partition(rng: Rng, cavity: Set<string>, sizes: readonly number[], minSize: number): Cell[][] | null {
  const remaining = new Set(cavity)
  const groups: Cell[][] = []
  const order = [...sizes].sort((a, b) => b - a)
  for (const target of order) {
    const seed = mostConstrained(rng, remaining)
    if (!seed) return null
    const piece: Cell[] = [seed]
    const pieceKeys = new Set([cellKey(seed[0], seed[1])])
    remaining.delete(cellKey(seed[0], seed[1]))
    while (piece.length < target) {
      const candidates: Cell[] = []
      const seen = new Set<string>()
      for (const [x, y] of piece) {
        for (const [dx, dy] of NEIGHBOURS) {
          const k = cellKey(x + dx, y + dy)
          if (remaining.has(k) && !seen.has(k)) {
            seen.add(k)
            candidates.push([x + dx, y + dy])
          }
        }
      }
      if (!candidates.length) return null
      const i = pickWeighted(rng, candidates, ([x, y]) => 1 + 3 * (4 - freeNeighbours(remaining, x, y)))
      const next = candidates[i]
      piece.push(next)
      pieceKeys.add(cellKey(next[0], next[1]))
      remaining.delete(cellKey(next[0], next[1]))
    }
    groups.push(piece)
    if (!fragmentsAreViable(remaining, minSize)) return null
  }
  return remaining.size === 0 ? groups : null
}

function freeNeighbours(remaining: Set<string>, x: number, y: number): number {
  let n = 0
  for (const [dx, dy] of NEIGHBOURS) if (remaining.has(cellKey(x + dx, y + dy))) n++
  return n
}

function parse(key: string): Cell {
  const [x, y] = key.split(',').map(Number)
  return [x, y]
}

function mostConstrained(rng: Rng, remaining: Set<string>): Cell | null {
  if (!remaining.size) return null
  let best: Cell[] = []
  let bestFree = Infinity
  for (const key of remaining) {
    const [x, y] = parse(key)
    const free = freeNeighbours(remaining, x, y)
    if (free < bestFree) {
      bestFree = free
      best = [[x, y]]
    } else if (free === bestFree) {
      best.push([x, y])
    }
  }
  return best[randInt(rng, 0, best.length - 1)]
}

/** Every connected fragment of what is left must be able to hold at least one piece. */
function fragmentsAreViable(remaining: Set<string>, minSize: number): boolean {
  const seen = new Set<string>()
  for (const key of remaining) {
    if (seen.has(key)) continue
    let count = 0
    const stack = [key]
    while (stack.length) {
      const k = stack.pop()!
      if (seen.has(k)) continue
      seen.add(k)
      count++
      const [x, y] = parse(k)
      for (const [dx, dy] of NEIGHBOURS) {
        const nk = cellKey(x + dx, y + dy)
        if (remaining.has(nk) && !seen.has(nk)) stack.push(nk)
      }
    }
    if (count < minSize) return false
  }
  return true
}

/**
 * Always-valid fallback: the first `total` cells of a boustrophedon walk over a
 * `size`-wide rectangle, cut into runs. Consecutive cells in snake order are
 * always adjacent, so every run is connected and the union is connected.
 */
function snakeRectangle(size: number, sizes: readonly number[]): Cell[][] {
  const total = sizes.reduce((a, b) => a + b, 0)
  const walk: Cell[] = []
  for (let y = 0; walk.length < total; y++) {
    for (let i = 0; i < size && walk.length < total; i++) {
      walk.push([y % 2 === 0 ? i : size - 1 - i, y])
    }
  }
  const groups: Cell[][] = []
  let cursor = 0
  for (const k of sizes) {
    groups.push(walk.slice(cursor, cursor + k))
    cursor += k
  }
  return groups
}

function normalise(id: string, cells: readonly Cell[]): Piece {
  const minX = Math.min(...cells.map((c) => c[0]))
  const minY = Math.min(...cells.map((c) => c[1]))
  const rel = cells
    .map(([x, y]) => [x - minX, y - minY] as const)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
  return { id, cells: rel, solution: [minX, minY] }
}
