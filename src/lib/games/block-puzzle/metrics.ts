/**
 * The play page's layout arithmetic (spec 013 FR-042, FR-047; plan R6).
 *
 * One cell size drives everything: the board, the tray slots and the drag layer
 * all size from it, which is what makes a piece the same size in the tray as on
 * the board. Kept pure and separate from the ResizeObserver so the rules —
 * cell floor, tray placement, reserved tray height — are testable.
 */

/** DESIGN's floor: below this a 5-cell piece stops being a comfortable target. */
export const MIN_CELL_PX = 34

/** Page padding either side of the board. */
const GUTTER_PX = 32
/**
 * The walnut frame around the grid, both sides together. It is part of what has
 * to fit the viewport, so the cell maths subtracts it — otherwise a 320px phone
 * gains a horizontal scrollbar exactly the width of the frame (FR-022).
 * `Board.tsx` pads by half of this on each side.
 */
export const BOARD_FRAME_PX = 16
const TRAY_GAP_PX = 8
const TRAY_COLUMNS_BELOW = 2
const TRAY_MIN_WIDTH_PX = 160
/**
 * Rows of tray the vertical budget insists on fitting. A tier-5 tray of ten
 * pieces cannot share a 568px-tall phone with an 8x8 board at 36px cells, so
 * the budget guarantees the board plus the first two tray rows and lets the
 * rest of the tray extend below the fold rather than crushing the board.
 */
const TRAY_BUDGET_ROWS = 2

/** The widest the board may get on a landscape screen, as a share of the width. */
const DESKTOP_BOARD_WIDTH_SHARE = 0.6
const DESKTOP_BOARD_MAX_PX = 480

export interface MetricsInput {
  viewportWidth: number
  /** Small-viewport height (`100svh`), so a mobile toolbar cannot hide the tray. */
  viewportHeight: number
  /** Measured height of the fixed site header. */
  headerPx: number
  /** Badge plus HUD strip reserved above the board. */
  chromePx: number
  /** Board grid size; the board is square. */
  grid: number
  /** Loose pieces needing a tray slot. */
  looseCount: number
  /** Largest loose-piece bounding box, in cells. */
  slotCells: { w: number; h: number }
}

export interface BoardMetrics {
  cellPx: number
  boardPx: number
  trayPlacement: 'below' | 'beside'
  /** Reserved before first paint so pieces leaving the tray never collapse it. */
  trayMinHeightPx: number
  /**
   * Width the tray wraps within: the board's own width when it sits below, the
   * leftover width when it sits beside. The tray itself flex-wraps its slots
   * inside this width, so it always lays pieces out left to right and only
   * drops to a new row once the current one is full, rather than a JS-guessed
   * column count that could get too small a share of the row.
   */
  trayWidthPx: number
}

export function computeBoardMetrics(input: MetricsInput): BoardMetrics {
  const { grid, looseCount, slotCells } = input
  const placement: 'below' | 'beside' =
    input.viewportWidth > input.viewportHeight ? 'beside' : 'below'

  const availableWidth = Math.max(0, input.viewportWidth - GUTTER_PX - BOARD_FRAME_PX)
  const availableHeight = Math.max(
    0,
    input.viewportHeight - input.headerPx - input.chromePx - GUTTER_PX - BOARD_FRAME_PX,
  )
  const cellByWidth = availableWidth / grid
  const rows = placement === 'below' ? Math.ceil(looseCount / TRAY_COLUMNS_BELOW) : 0

  let ideal: number
  if (placement === 'below') {
    const budgetRows = Math.min(rows, TRAY_BUDGET_ROWS)
    const heightForCells = availableHeight - budgetRows * TRAY_GAP_PX
    ideal = Math.min(cellByWidth, heightForCells / (grid + budgetRows * slotCells.h))
  } else {
    const boardCap = Math.min(
      availableHeight,
      input.viewportWidth * DESKTOP_BOARD_WIDTH_SHARE,
      DESKTOP_BOARD_MAX_PX,
    )
    ideal = Math.min(boardCap / grid, (availableWidth - TRAY_MIN_WIDTH_PX) / grid)
  }

  // The floor may not push the board wider than the viewport — a horizontal
  // scrollbar is the one thing FR-022 rules out outright.
  const floored = Math.max(MIN_CELL_PX, Math.floor(ideal))
  const cellPx = Math.max(1, Math.min(Math.floor(cellByWidth), floored))
  const boardPx = cellPx * grid

  const trayMinHeightPx = placement === 'below'
    ? rows * slotCells.h * cellPx + Math.max(0, rows - 1) * TRAY_GAP_PX
    : 0
  // The board stays a fixed, comfortable size (DESKTOP_BOARD_MAX_PX) so cells
  // don't balloon on a big monitor. The tray beside it used to be capped at a
  // flat 460px, which forced every piece into one narrow column on any screen
  // wider than that. Instead, size the tray to what the pieces actually need
  // for a roughly square cluster (so it wraps into a few columns rather than
  // one tall strip), capped by whatever width is actually left beside the
  // board — on a wide screen that's a much larger, but still content-sized,
  // allowance, not an empty stretch of leftover space.
  const trayLeftoverPx = Math.max(0, availableWidth - boardPx - TRAY_GAP_PX * 2)
  const trayColumnsWanted = Math.max(1, Math.ceil(Math.sqrt(looseCount)))
  const trayIdealWidthPx =
    trayColumnsWanted * slotCells.w * cellPx + (trayColumnsWanted - 1) * TRAY_GAP_PX
  const trayWidthPx = placement === 'beside'
    ? Math.max(TRAY_MIN_WIDTH_PX, Math.min(trayIdealWidthPx, trayLeftoverPx))
    : boardPx

  return { cellPx, boardPx, trayPlacement: placement, trayMinHeightPx, trayWidthPx }
}
