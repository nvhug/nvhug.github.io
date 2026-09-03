'use client'

/**
 * The play page. One level, generated in the page and playable the moment it
 * paints (FR-044): the progress request runs beside it and only feeds the HUD's
 * best-time slot, the save flow and the lock check (plan R8).
 *
 * Between a level starting and its completion the page makes no request at all
 * (FR-045) — the only two are the progress load on open and one save per solve.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  initialState,
  isSolved,
  pieceBounds,
  type BoardState,
  type Level,
} from '@/lib/games/block-puzzle/board'
import { generateLevel } from '@/lib/games/block-puzzle/generator'
import { CAMPAIGN_LEVELS, parseLevelParam, tierOf } from '@/lib/games/block-puzzle/tiers'
import { enqueue, list, pendingFor, remove } from '@/lib/games/pending-completions'
import { bestFor, isUnlocked, recordCompletion, starsFor, withPending } from '@/lib/games/progress'
import { BLOCK_PUZZLE_ID, BLOCK_PUZZLE_PATH } from '@/lib/games/registry'
import { useLanguage } from '@/lib/i18n/language-context'
import type { GameProgressRecord } from '@/types'
import { GamesShell } from '../../_components/GamesShell'
import { useGameProgress } from '../../_hooks/useGameProgress'
import { Board } from '../_components/Board'
import { Hud, type SaveState } from '../_components/Hud'
import { Piece } from '../_components/Piece'
import { SolvedPanel } from '../_components/SolvedPanel'
import { Tray } from '../_components/Tray'
import { useBoardMetrics } from '../_hooks/useBoardMetrics'
import { useDragPiece } from '../_hooks/useDragPiece'
import { useLevelTimer } from '../_hooks/useLevelTimer'

const MAP_HREF = BLOCK_PUZZLE_PATH
/** Badge, gaps and the HUD strip reserved above the board. */
const CHROME_PX = 104

export default function BlockPuzzleLevelPage() {
  const router = useRouter()
  const params = useParams()
  const { t } = useLanguage()
  const levelNumber = parseLevelParam(params?.level)

  const { records, merge } = useGameProgress(BLOCK_PUZZLE_ID)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  // The save toast reads the current language from a ref: `t` is a new function
  // on every provider render, and nothing here may re-run because of that.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    if (levelNumber === null) router.replace(MAP_HREF)
  }, [levelNumber, router])

  // The lock rule (FR-012). It can only bite someone typing a URL, so it waits
  // for the answer rather than gating the start of play on it — and it only
  // runs once the answer arrived: a failed load leaves `records` null, and
  // unknown is not locked (FR-028). A completion still queued for saving
  // counts, or finishing level N offline would re-lock N+1.
  useEffect(() => {
    if (levelNumber === null || records === null) return
    const effective = withPending(records, pendingFor(BLOCK_PUZZLE_ID))
    if (!isUnlocked(levelNumber, effective)) router.replace(`${MAP_HREF}?focus=${levelNumber}`)
  }, [levelNumber, records, router])

  const bestMs =
    levelNumber === null || records === null
      ? null
      : bestFor(withPending(records, pendingFor(BLOCK_PUZZLE_ID)), levelNumber)

  /**
   * One save per solve, plus whatever earlier solves never got through. The
   * queue lives in a module (see pending-completions), so leaving this page for
   * the next level does not drop it — and only the entries that actually
   * succeeded are removed from it.
   */
  const save = useCallback(
    async (levelKey: string, timeMs: number) => {
      enqueue({ gameId: BLOCK_PUZZLE_ID, levelKey, timeMs })
      setSaveState('saving')

      const queued = list()
      const results = await Promise.allSettled(
        queued.map((entry) =>
          recordCompletion({ gameId: entry.gameId, levelKey: entry.levelKey, timeMs: entry.timeMs }),
        ),
      )

      const saved: GameProgressRecord[] = []
      let failed = false
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          failed = true
          return
        }
        saved.push(result.value)
        remove(queued[index].id)
      })

      // The function returns the stored row, so the authoritative best is known
      // without a second request (FR-045). Only this game's rows belong in this
      // page's records; another game's queued entry was flushed, not adopted.
      const mine = saved.filter((row) => row.game_id === BLOCK_PUZZLE_ID)
      if (mine.length > 0) merge(mine)

      if (failed) {
        setSaveState('unsaved')
        toast.error(tRef.current('games.errors.saveFailed'))
        return
      }
      setSaveState('saved')
      window.setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500)
    },
    [merge],
  )

  if (levelNumber === null) return <GamesShell />

  return (
    <PlayLevel
      key={levelNumber}
      levelNumber={levelNumber}
      bestMs={bestMs}
      saveState={saveState}
      onSolve={(timeMs) => void save(String(levelNumber), timeMs)}
      onNext={() => router.push(`${MAP_HREF}/${levelNumber + 1}`)}
    />
  )
}

interface SolvedInfo {
  elapsedMs: number
  stars: 1 | 2 | 3
  newRecord: boolean
  /** The best this account had before the attempt, for the panel's record line. */
  bestBefore: number | null
}

function PlayLevel({
  levelNumber,
  bestMs,
  saveState,
  onSolve,
  onNext,
}: {
  levelNumber: number
  bestMs: number | null
  saveState: SaveState
  onSolve: (timeMs: number) => void
  onNext: () => void
}) {
  const { t } = useLanguage()
  const level: Level = useMemo(() => generateLevel(levelNumber), [levelNumber])
  const [state, setState] = useState<BoardState>(() => initialState(level))
  const [solved, setSolved] = useState<SolvedInfo | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const timer = useLevelTimer()
  const gridRef = useRef<HTMLDivElement>(null)
  const resetRef = useRef<HTMLButtonElement>(null)
  const slotRefs = useRef<Map<string, HTMLElement>>(new Map())

  const looseIds = level.trayOrder
  const slotCells = useMemo(() => {
    let w = 1
    let h = 1
    for (const id of looseIds) {
      const piece = level.pieces.find((p) => p.id === id)
      if (!piece) continue
      const bounds = pieceBounds(piece)
      w = Math.max(w, bounds.w)
      h = Math.max(h, bounds.h)
    }
    return { w, h }
  }, [level, looseIds])

  const metrics = useBoardMetrics({
    grid: level.cols,
    looseCount: looseIds.length,
    slotCells,
    chromePx: CHROME_PX,
  })

  const applyState = useCallback(
    (next: BoardState) => {
      setState(next)
      if (!isSolved(level, next)) return
      const elapsedMs = timer.stop()
      // The best as it stood when the solve landed: the save that follows is
      // what changes it, and this panel is about the attempt just finished.
      setSolved({
        elapsedMs,
        stars: starsFor(elapsedMs, level.parMs),
        newRecord: bestMs === null || elapsedMs < bestMs,
        bestBefore: bestMs,
      })
      setPanelOpen(true)
      onSolve(elapsedMs)
    },
    [bestMs, level, onSolve, timer],
  )

  const {
    layerRef,
    draggingId,
    draggingPiece,
    dragVisualState,
    dragBounds,
    previewCells,
    onPiecePointerDown,
  } = useDragPiece({
    level,
    state,
    applyState,
    cellPx: metrics.cellPx,
    gridRef,
    slotRefs,
    disabled: solved !== null,
  })

  const reset = useCallback(() => {
    setState(initialState(level))
    setSolved(null)
    setPanelOpen(false)
    timer.reset()
  }, [level, timer])

  const tierName = t(tierOf(levelNumber).i18nKey)

  return (
    <GamesShell contentClassName="flex max-w-none flex-col items-center gap-3">
      <Hud
        level={levelNumber}
        tierName={tierName}
        elapsedMs={solved ? solved.elapsedMs : timer.elapsedMs}
        bestMs={bestMs}
        saveState={saveState}
        mapHref={MAP_HREF}
        resetRef={resetRef}
        onReset={reset}
      />

      <div
        className={`games-play-area flex w-full items-start justify-center gap-4 ${
          metrics.trayPlacement === 'below' ? 'flex-col items-center' : 'flex-row'
        }`}
      >
        <Board
          level={level}
          state={state}
          cellPx={metrics.cellPx}
          previewCells={previewCells}
          draggingId={draggingId}
          solved={solved !== null}
          gridRef={gridRef}
          onPiecePointerDown={onPiecePointerDown}
        />

        <Tray
          level={level}
          state={state}
          cellPx={metrics.cellPx}
          slotCells={slotCells}
          columns={metrics.trayColumns}
          minHeightPx={metrics.trayMinHeightPx}
          widthPx={metrics.trayWidthPx}
          placement={metrics.trayPlacement}
          draggingId={draggingId}
          slotRefs={slotRefs}
          onPiecePointerDown={onPiecePointerDown}
        />
      </div>

      {/* The drag layer. Always mounted — it holds the pointer capture, so it
          must outlive the piece that left its slot (see useDragPiece). */}
      <div
        ref={layerRef}
        className="fixed left-0 top-0 z-[60]"
        style={{
          touchAction: 'none',
          width: dragBounds ? dragBounds.w * metrics.cellPx : 0,
          height: dragBounds ? dragBounds.h * metrics.cellPx : 0,
        }}
      >
        {draggingPiece && (
          <Piece piece={draggingPiece} cellPx={metrics.cellPx} state={dragVisualState} />
        )}
      </div>

      {solved && panelOpen && (
        <SolvedPanel
          stars={solved.stars}
          elapsedMs={solved.elapsedMs}
          bestMs={solved.bestBefore}
          newRecord={solved.newRecord}
          isCampaignComplete={levelNumber >= CAMPAIGN_LEVELS}
          mapHref={MAP_HREF}
          onClose={() => {
            setPanelOpen(false)
            resetRef.current?.focus()
          }}
          onNext={onNext}
          onReplay={reset}
        />
      )}
    </GamesShell>
  )
}
