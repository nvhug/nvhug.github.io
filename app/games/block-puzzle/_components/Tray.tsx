'use client'

/**
 * The loose pieces waiting to be placed, at exactly the board's cell scale so a
 * piece never changes size between tray and board.
 *
 * Every slot keeps its space while its piece is elsewhere (FR-047), and each
 * slot holds an anchor sized to its piece that is registered here even while
 * the piece is on the board or in the air — that anchor's rect is where a
 * rejected drop animates back to.
 *
 * Memoised: nothing here changes while a piece is being dragged across the
 * board, so the slots should not be reconciled on every cell it crosses.
 */

import { memo } from 'react'
import { pieceBounds, type BoardState, type Level } from '@/lib/games/block-puzzle/board'
import { Piece } from './Piece'

export const Tray = memo(function Tray({
  level,
  state,
  cellPx,
  slotCells,
  minHeightPx,
  widthPx,
  placement,
  draggingId,
  slotRefs,
  onPiecePointerDown,
}: {
  level: Level
  state: BoardState
  cellPx: number
  slotCells: { w: number; h: number }
  minHeightPx: number
  widthPx: number
  placement: 'below' | 'beside'
  draggingId: string | null
  slotRefs: React.RefObject<Map<string, HTMLElement>>
  onPiecePointerDown: (event: React.PointerEvent<HTMLDivElement>, pieceId: string) => void
}) {
  const slotW = slotCells.w * cellPx
  const slotH = slotCells.h * cellPx

  return (
    <div
      className="flex shrink-0 flex-wrap content-start justify-center gap-2"
      style={{
        minHeight: placement === 'below' ? minHeightPx : undefined,
        width: widthPx,
      }}
    >
      {level.trayOrder.map((pieceId) => {
        const piece = level.pieces.find((p) => p.id === pieceId)
        if (!piece) return null
        const bounds = pieceBounds(piece)
        const hidden = state.placed.has(pieceId) || pieceId === draggingId
        return (
          <div key={pieceId} className="relative" style={{ width: slotW, height: slotH }}>
            <div
              ref={(el) => {
                const map = slotRefs.current
                if (!map) return
                if (el) map.set(pieceId, el)
                else map.delete(pieceId)
              }}
              className="absolute"
              style={{
                left: Math.round((slotW - bounds.w * cellPx) / 2),
                top: Math.round((slotH - bounds.h * cellPx) / 2),
                width: bounds.w * cellPx,
                height: bounds.h * cellPx,
              }}
            >
              {!hidden && (
                <Piece
                  piece={piece}
                  cellPx={cellPx}
                  state="idle"
                  onPointerDown={(event) => onPiecePointerDown(event, pieceId)}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
})
