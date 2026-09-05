/**
 * The play page's layout arithmetic (spec 013 FR-042, FR-047; plan R6).
 *
 * One cell size drives everything: the board, the tray slots and the drag layer
 * all size from it, which is what makes a piece the same size in the tray as on
 * the board. Kept pure and separate from the ResizeObserver so the rules —
 * cell floor, tray placement, reserved tray height — are testable.
 */

import { clamp } from '@/lib/utils'

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
const TRAY_MAX_WIDTH_PX = 460
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
  /** Tray column width when it sits beside the board; 0 when it sits below. */
  trayWidthPx: number
  trayColumns: number
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

  const rows = placement === 'below'
    ? Math.ceil(looseCount / TRAY_COLUMNS_BELOW)
    : Math.ceil(looseCount / (looseCount > 5 ? 2 : 1))

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
  const trayWidthPx = placement === 'beside'
    ? clamp(availableWidth - boardPx - TRAY_GAP_PX * 2, TRAY_MIN_WIDTH_PX, TRAY_MAX_WIDTH_PX)
    : 0

  // Beside the board, a fixed 1-or-2 columns left a short piece list stacked in
  // one tall column that ran past the bottom of the screen. Instead, use as many
  // columns as the reserved tray width and the vertical budget both allow, so the
  // whole tray fits in the one visible frame beside the board (no scrolling to
  // find the rest of the pieces).
  const trayColumns = placement === 'below'
    ? TRAY_COLUMNS_BELOW
    : (() => {
        const colsByWidth = Math.max(
          1,
          Math.floor((trayWidthPx + TRAY_GAP_PX) / (slotCells.w * cellPx + TRAY_GAP_PX)),
        )
        const rowsByHeight = Math.max(
          1,
          Math.floor((availableHeight + TRAY_GAP_PX) / (slotCells.h * cellPx + TRAY_GAP_PX)),
        )
        const minColumnsForHeight = Math.ceil(looseCount / rowsByHeight)
        return Math.max(1, Math.min(colsByWidth, minColumnsForHeight))
      })()

  return { cellPx, boardPx, trayPlacement: placement, trayMinHeightPx, trayWidthPx, trayColumns }
}
