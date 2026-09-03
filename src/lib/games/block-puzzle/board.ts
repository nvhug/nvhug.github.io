/**
 * Board state for one attempt at a level: which piece sits where, whether a
 * drop is legal, whether the cavity is full. Pure and immutable — the drag
 * engine and the tests both drive it.
 */

/** [x, y] — column, row. */
export type Cell = readonly [number, number]

export interface Piece {
  id: string
  /** Cells relative to the piece's top-left bounding corner (min dx = min dy = 0). */
  cells: readonly Cell[]
  /** Where the generator placed it — the level's solution. Never shown. */
  solution: Cell
}

export interface Level {
  level: number
  tier: number
  cols: number
  rows: number
  /** cavity[y][x] — true where a piece belongs. */
  cavity: readonly (readonly boolean[])[]
  pieces: readonly Piece[]
  /** Pre-seated pieces the player cannot move. */
  fixedIds: readonly string[]
  /** Loose piece ids in tray order. */
  trayOrder: readonly string[]
  parMs: number
  /** True when the generator fell back to the rectangular layout. */
  fallback: boolean
}

export interface BoardState {
  /** pieceId → top-left cell on the board. Includes fixed pieces. */
  placed: ReadonlyMap<string, Cell>
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

export function initialState(level: Level): BoardState {
  const placed = new Map<string, Cell>()
  for (const piece of level.pieces) {
    if (level.fixedIds.includes(piece.id)) placed.set(piece.id, piece.solution)
  }
  return { placed }
}

/** The piece's bounding box in cells; never smaller than one cell. */
export function pieceBounds(piece: Piece): { w: number; h: number } {
  let w = 1
  let h = 1
  for (const [dx, dy] of piece.cells) {
    w = Math.max(w, dx + 1)
    h = Math.max(h, dy + 1)
  }
  return { w, h }
}

export function landingCells(piece: Piece, [ax, ay]: Cell): Cell[] {
  return piece.cells.map(([dx, dy]) => [ax + dx, ay + dy] as const)
}

/** Every occupied board cell → the id of the piece on it. */
export function occupancy(level: Level, state: BoardState): Map<string, string> {
  const occ = new Map<string, string>()
  for (const [id, at] of state.placed) {
    const piece = level.pieces.find((p) => p.id === id)
    if (!piece) continue
    for (const [x, y] of landingCells(piece, at)) occ.set(cellKey(x, y), id)
  }
  return occ
}

/**
 * Legality against an occupancy map built elsewhere. The drag engine tests one
 * piece against one unchanging board on every pointer move, so it builds the
 * map once at pointerdown and calls this.
 */
export function canPlaceWith(
  occ: ReadonlyMap<string, string>,
  level: Level,
  piece: Piece,
  at: Cell,
): boolean {
  for (const [x, y] of landingCells(piece, at)) {
    if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) return false
    if (!level.cavity[y][x]) return false
    const holder = occ.get(cellKey(x, y))
    if (holder !== undefined && holder !== piece.id) return false
  }
  return true
}

export function canPlace(level: Level, state: BoardState, piece: Piece, at: Cell): boolean {
  return canPlaceWith(occupancy(level, state), level, piece, at)
}

export function place(state: BoardState, pieceId: string, at: Cell): BoardState {
  const placed = new Map(state.placed)
  placed.set(pieceId, at)
  return { placed }
}

/** Lifts a player-placed piece back to the tray. A fixed piece stays; the same state is returned. */
export function lift(level: Level, state: BoardState, pieceId: string): BoardState {
  if (level.fixedIds.includes(pieceId) || !state.placed.has(pieceId)) return state
  const placed = new Map(state.placed)
  placed.delete(pieceId)
  return { placed }
}

export function placedCount(state: BoardState): number {
  return state.placed.size
}

export function isSolved(level: Level, state: BoardState): boolean {
  const occ = occupancy(level, state)
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.cavity[y][x] && !occ.has(cellKey(x, y))) return false
    }
  }
  return true
}
