'use client'

/**
 * The walnut board: a routed cavity in a wooden frame, the pieces seated in it,
 * and the mint landing preview under a piece that would drop legally.
 *
 * The grid element is what the drag engine measures, so its ref is exposed
 * rather than the frame's — cell maths must not include the frame padding.
 *
 * The preview is its own thin layer of at most five divs over the cavity, not a
 * flag on every cell: the alternative re-renders all sixty-four cells on every
 * cell the dragged piece crosses. Memoised for the same reason — during a drag
 * only the preview and the drag layer change, and the sixty-four cells behind
 * them do not need to be reconciled to find that out.
 */

import { memo } from 'react'
import { cellKey, placedCount, type BoardState, type Cell, type Level } from '@/lib/games/block-puzzle/board'
import { BOARD_FRAME_PX } from '@/lib/games/block-puzzle/metrics'
import { useLanguage } from '@/lib/i18n/language-context'
import { Piece } from './Piece'

export const Board = memo(function Board({
  level,
  state,
  cellPx,
  previewCells,
  draggingId,
  solved,
  gridRef,
  onPiecePointerDown,
}: {
  level: Level
  state: BoardState
  cellPx: number
  previewCells: readonly Cell[]
  draggingId: string | null
  solved: boolean
  gridRef: React.Ref<HTMLDivElement>
  onPiecePointerDown: (event: React.PointerEvent<HTMLDivElement>, pieceId: string) => void
}) {
  const { t } = useLanguage()
  const boardPx = cellPx * level.cols

  return (
    <div
      className="games-board shrink-0"
      data-solved={solved ? 'true' : 'false'}
      style={{ padding: BOARD_FRAME_PX / 2 }}
    >
      <div ref={gridRef} className="relative" style={{ width: boardPx, height: cellPx * level.rows }}>
        {level.cavity.map((row, y) =>
          row.map((isCavity, x) => (
            <div
              key={cellKey(x, y)}
              className="games-cell"
              data-cavity={isCavity ? 'true' : 'false'}
              style={{ left: x * cellPx, top: y * cellPx, width: cellPx, height: cellPx }}
            />
          )),
        )}

        {previewCells.map(([x, y]) => (
          <div
            key={`preview-${cellKey(x, y)}`}
            className="games-cell"
            data-preview="true"
            style={{ left: x * cellPx, top: y * cellPx, width: cellPx, height: cellPx }}
          />
        ))}

        {level.pieces.map((piece) => {
          const at = state.placed.get(piece.id)
          if (!at || piece.id === draggingId) return null
          const fixed = level.fixedIds.includes(piece.id)
          return (
            <Piece
              key={piece.id}
              piece={piece}
              cellPx={cellPx}
              state={fixed ? 'fixed' : 'placed'}
              style={{ left: at[0] * cellPx, top: at[1] * cellPx }}
              onPointerDown={fixed ? undefined : (event) => onPiecePointerDown(event, piece.id)}
            />
          )
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {t('games.blockPuzzle.hud.placedOf', { n: placedCount(state), total: level.pieces.length })}
      </p>
    </div>
  )
})
