'use client'

/**
 * One wooden polyomino, drawn as one absolutely-positioned oak block per cell
 * (DESIGN § Piece states). Every state's face, elevation, cursor and duration
 * live in the `.games-piece[data-piece-state]` rules in globals.css, so hover
 * can be bound to `(hover: hover) and (pointer: fine)` and reduced motion can
 * zero the durations — neither of which a Tailwind class can express here.
 *
 * Pieces are pointer-only and carry no accessible name: the declared keyboard
 * gap (spec Assumptions). The board announces progress instead.
 */

import { pieceBounds, type Piece as PieceModel } from '@/lib/games/block-puzzle/board'

export type PieceVisualState = 'idle' | 'dragging' | 'valid' | 'invalid' | 'placed' | 'fixed'

export function Piece({
  piece,
  cellPx,
  state,
  style,
  onPointerDown,
}: {
  piece: PieceModel
  cellPx: number
  state: PieceVisualState
  style?: React.CSSProperties
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void
}) {
  const bounds = pieceBounds(piece)
  return (
    <div
      aria-hidden
      data-piece-state={state}
      data-piece-id={piece.id}
      onPointerDown={onPointerDown}
      className="games-piece"
      style={{ width: bounds.w * cellPx, height: bounds.h * cellPx, ...style }}
    >
      {piece.cells.map(([dx, dy]) => (
        <div
          key={`${dx},${dy}`}
          className="games-piece-cell games-oak-grain"
          style={{ left: dx * cellPx, top: dy * cellPx, width: cellPx, height: cellPx }}
        />
      ))}
    </div>
  )
}
