'use client'

/**
 * The drag engine (plan R5). Pointer events only, so mouse, pen and touch are
 * one code path.
 *
 * Two decisions carry the feel:
 *
 * 1. **Pointer capture goes on the drag layer, not the piece.** The layer is
 *    always mounted; the grabbed piece is not — it leaves its tray slot or its
 *    board cell the moment the drag starts, and capture on a removed element is
 *    lost mid-gesture. Capturing on the layer keeps the gesture alive wherever
 *    the finger goes, including outside the window.
 * 2. **The transform is written straight to the layer element on every move.**
 *    React re-renders only when the derived target cell changes, which is what
 *    keeps the drag at refresh rate on a mid-range phone.
 *
 * Board geometry and the piece's origin are measured once at drag start; a
 * resize or an orientation change cancels the drag rather than re-measuring.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canPlaceWith,
  landingCells,
  lift,
  occupancy,
  pieceBounds,
  place,
  type BoardState,
  type Cell,
  type Level,
  type Piece as PieceModel,
} from '@/lib/games/block-puzzle/board'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { type PieceVisualState } from '../_components/Piece'

const DRAG_THRESHOLD_PX = 4
const SNAP_MS = 200
const RETURN_MS = 250
const LIFT_SCALE = 1.06
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
/** One array for every empty preview, so a memoised Board sees no new prop. */
const NO_CELLS: readonly Cell[] = []

interface DragView {
  pieceId: string
  bounds: { w: number; h: number }
  visualState: PieceVisualState
  previewCells: readonly Cell[]
}

interface ActiveDrag {
  pointerId: number
  piece: PieceModel
  /** The board without this piece — what legality is judged against. */
  base: BoardState
  /** `base`'s occupancy and the piece's box: fixed for the whole gesture, so
   *  both are computed once here instead of on every pointer move. */
  occ: ReadonlyMap<string, string>
  bounds: { w: number; h: number }
  wasOnBoard: boolean
  startX: number
  startY: number
  originLeft: number
  originTop: number
  gridLeft: number
  gridTop: number
  started: boolean
  target: Cell | null
  valid: boolean
  settling: boolean
}

export function useDragPiece({
  level,
  state,
  applyState,
  cellPx,
  gridRef,
  slotRefs,
  disabled,
}: {
  level: Level
  state: BoardState
  /** Commits a new board state; the caller also checks for the solve there. */
  applyState: (next: BoardState) => void
  cellPx: number
  gridRef: React.RefObject<HTMLDivElement | null>
  slotRefs: React.RefObject<Map<string, HTMLElement>>
  disabled: boolean
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<ActiveDrag | null>(null)
  const timerRef = useRef<number | null>(null)
  const [view, setView] = useState<DragView | null>(null)

  const reduceMotion = useReducedMotion()

  const ctxRef = useRef({ level, state, cellPx, disabled, applyState, reduceMotion })
  useEffect(() => {
    ctxRef.current = { level, state, cellPx, disabled, applyState, reduceMotion }
  }, [level, state, cellPx, disabled, applyState, reduceMotion])

  const writeTransform = useCallback((x: number, y: number, scale: number) => {
    const layer = layerRef.current
    if (layer) layer.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
  }, [])

  const finish = useCallback(() => {
    const layer = layerRef.current
    if (layer) {
      layer.style.transition = ''
      layer.style.transform = ''
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    document.body.style.removeProperty('cursor')
    activeRef.current = null
    setView(null)
  }, [])

  /** Slides the piece back to the tray slot it belongs to and drops it there. */
  const returnToTray = useCallback(
    (active: ActiveDrag) => {
      const anchor = slotRefs.current?.get(active.piece.id)
      const duration = ctxRef.current.reduceMotion ? 0 : RETURN_MS
      const commit = () => {
        if (active.wasOnBoard) ctxRef.current.applyState(lift(ctxRef.current.level, ctxRef.current.state, active.piece.id))
        finish()
      }
      if (!anchor || duration === 0) {
        commit()
        return
      }
      const rect = anchor.getBoundingClientRect()
      const layer = layerRef.current
      if (layer) layer.style.transition = `transform ${duration}ms ${EASING}`
      writeTransform(rect.left, rect.top, 1)
      timerRef.current = window.setTimeout(commit, duration)
    },
    [finish, slotRefs, writeTransform],
  )

  const cancel = useCallback(() => {
    const active = activeRef.current
    if (!active) return
    if (!active.started) {
      finish()
      return
    }
    active.settling = true
    returnToTray(active)
  }, [finish, returnToTray])

  const onPiecePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, pieceId: string) => {
      const { level: lvl, state: current, disabled: off } = ctxRef.current
      if (off || activeRef.current) return
      if (lvl.fixedIds.includes(pieceId)) return
      const piece = lvl.pieces.find((p) => p.id === pieceId)
      const grid = gridRef.current
      const layer = layerRef.current
      if (!piece || !grid || !layer) return

      const rect = event.currentTarget.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      const wasOnBoard = current.placed.has(pieceId)
      const base = wasOnBoard ? lift(lvl, current, pieceId) : current

      activeRef.current = {
        pointerId: event.pointerId,
        piece,
        base,
        occ: occupancy(lvl, base),
        bounds: pieceBounds(piece),
        wasOnBoard,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: rect.left,
        originTop: rect.top,
        gridLeft: gridRect.left,
        gridTop: gridRect.top,
        started: false,
        target: null,
        valid: false,
        settling: false,
      }

      // Capture on the layer, not on the piece: the piece is about to leave the DOM.
      layer.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [gridRef],
  )

  useEffect(() => {
    const layer: HTMLDivElement | null = layerRef.current
    if (layer === null) return
    const dragLayer = layer

    function handleMove(event: PointerEvent) {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId || active.settling) return
      const dx = event.clientX - active.startX
      const dy = event.clientY - active.startY

      if (!active.started) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return
        active.started = true
        document.body.style.cursor = 'grabbing'
        setView({
          pieceId: active.piece.id,
          bounds: active.bounds,
          visualState: 'dragging',
          previewCells: NO_CELLS,
        })
      }

      const left = active.originLeft + dx
      const top = active.originTop + dy
      writeTransform(left, top, LIFT_SCALE)

      const { level: lvl, cellPx: cell } = ctxRef.current
      const cellX = Math.round((left - active.gridLeft) / cell)
      const cellY = Math.round((top - active.gridTop) / cell)
      if (active.target && active.target[0] === cellX && active.target[1] === cellY) return

      const bounds = active.bounds
      const overlaps =
        cellX + bounds.w > 0 && cellY + bounds.h > 0 && cellX < lvl.cols && cellY < lvl.rows
      const at: Cell = [cellX, cellY]
      const valid = overlaps && canPlaceWith(active.occ, lvl, active.piece, at)

      active.target = at
      active.valid = valid
      setView({
        pieceId: active.piece.id,
        bounds,
        visualState: !overlaps ? 'dragging' : valid ? 'valid' : 'invalid',
        previewCells: valid ? landingCells(active.piece, at) : NO_CELLS,
      })
    }

    function handleUp(event: PointerEvent) {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId || active.settling) return
      if (!active.started) {
        // A tap, not a drag.
        finish()
        return
      }
      active.settling = true

      if (active.valid && active.target) {
        const target = active.target
        const { cellPx: cell } = ctxRef.current
        const duration = ctxRef.current.reduceMotion ? 0 : SNAP_MS
        const commit = () => {
          ctxRef.current.applyState(place(active.base, active.piece.id, target))
          finish()
        }
        if (duration === 0) {
          commit()
          return
        }
        dragLayer.style.transition = `transform ${duration}ms ${EASING}`
        writeTransform(active.gridLeft + target[0] * cell, active.gridTop + target[1] * cell, 1)
        timerRef.current = window.setTimeout(commit, duration)
        return
      }

      returnToTray(active)
    }

    function handleCancel(event: PointerEvent) {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      cancel()
    }

    function handleContextMenu(event: Event) {
      if (activeRef.current) event.preventDefault()
    }

    dragLayer.addEventListener('pointermove', handleMove)
    dragLayer.addEventListener('pointerup', handleUp)
    dragLayer.addEventListener('pointercancel', handleCancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', cancel)
    window.addEventListener('orientationchange', cancel)
    window.addEventListener('contextmenu', handleContextMenu)

    return () => {
      dragLayer.removeEventListener('pointermove', handleMove)
      dragLayer.removeEventListener('pointerup', handleUp)
      dragLayer.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('resize', cancel)
      window.removeEventListener('orientationchange', cancel)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [cancel, finish, returnToTray, writeTransform])

  useEffect(() => finish, [finish])

  const draggingPiece = view ? level.pieces.find((p) => p.id === view.pieceId) ?? null : null

  return {
    layerRef,
    draggingId: view?.pieceId ?? null,
    draggingPiece,
    dragVisualState: view?.visualState ?? 'dragging',
    dragBounds: view?.bounds ?? null,
    previewCells: view?.previewCells ?? NO_CELLS,
    onPiecePointerDown,
  }
}
