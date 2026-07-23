'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const HANDLE_SIZE = 40
const TRACK_PADDING = 4
const CANVAS_W = 300
const CANVAS_H = 150
const MAX_OFFSET = CANVAS_W - HANDLE_SIZE - TRACK_PADDING * 2
const PIECE_SIZE = 42
const TAB = 8
const PIECE_PAD = TAB + 4
const PIECE_BOX = PIECE_SIZE + PIECE_PAD * 2
const MATCH_TOLERANCE = 6

function tracePiecePath(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const r = TAB
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.arc(x + PIECE_SIZE / 2, y - r + 2, r, 0.72 * Math.PI, 2.26 * Math.PI)
  ctx.lineTo(x + PIECE_SIZE, y)
  ctx.arc(x + PIECE_SIZE + r - 2, y + PIECE_SIZE / 2, r, 1.21 * Math.PI, 2.78 * Math.PI)
  ctx.lineTo(x + PIECE_SIZE, y + PIECE_SIZE)
  ctx.lineTo(x, y + PIECE_SIZE)
  ctx.arc(x + r - 2, y + PIECE_SIZE / 2, r + 0.4, 2.76 * Math.PI, 1.24 * Math.PI, true)
  ctx.lineTo(x, y)
  ctx.closePath()
}

function paintScene(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
  gradient.addColorStop(0, '#34d399')
  gradient.addColorStop(1, '#0d9488')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const blobs: Array<[number, number, number]> = [
    [40, 30, 38], [230, 40, 46], [130, 100, 50], [270, 110, 30], [60, 115, 26],
  ]
  blobs.forEach(([bx, by, br]) => {
    ctx.beginPath()
    ctx.arc(bx, by, br, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fill()
  })
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function JigsawSliderCaptcha({
  onVerify,
  label,
  verifiedLabel,
  refreshLabel,
}: {
  onVerify: () => void
  label: string
  verifiedLabel: string
  refreshLabel: string
}) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const pieceCanvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<HTMLCanvasElement | null>(null)
  const targetRef = useRef({ px: 0, py: 0 })
  const [pieceTop, setPieceTop] = useState(0)
  const [position, setPosition] = useState(0)
  const positionRef = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [verified, setVerified] = useState(false)
  const dragState = useRef<{ startX: number; startPos: number } | null>(null)

  function updatePosition(value: number) {
    positionRef.current = value
    setPosition(value)
  }

  function generateChallenge() {
    const bgCtx = bgCanvasRef.current?.getContext('2d')
    const pieceCtx = pieceCanvasRef.current?.getContext('2d')
    if (!bgCtx || !pieceCtx) return

    if (!sceneRef.current) sceneRef.current = document.createElement('canvas')
    const scene = sceneRef.current
    scene.width = CANVAS_W
    scene.height = CANVAS_H
    const sceneCtx = scene.getContext('2d')
    if (!sceneCtx) return
    paintScene(sceneCtx)

    const px = randomBetween(PIECE_PAD + 20, MAX_OFFSET - 10)
    const py = randomBetween(PIECE_PAD, CANVAS_H - PIECE_SIZE - PIECE_PAD)
    targetRef.current = { px, py }
    setPieceTop(py - PIECE_PAD)

    bgCtx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    bgCtx.drawImage(scene, 0, 0)
    tracePiecePath(bgCtx, px, py)
    bgCtx.fillStyle = 'rgba(15, 23, 42, 0.4)'
    bgCtx.fill()
    bgCtx.strokeStyle = 'rgba(255,255,255,0.85)'
    bgCtx.lineWidth = 1.5
    bgCtx.stroke()

    pieceCtx.clearRect(0, 0, PIECE_BOX, PIECE_BOX)
    pieceCtx.save()
    tracePiecePath(pieceCtx, PIECE_PAD, PIECE_PAD)
    pieceCtx.clip()
    pieceCtx.drawImage(scene, px - PIECE_PAD, py - PIECE_PAD, PIECE_BOX, PIECE_BOX, 0, 0, PIECE_BOX, PIECE_BOX)
    pieceCtx.restore()
    tracePiecePath(pieceCtx, PIECE_PAD, PIECE_PAD)
    pieceCtx.strokeStyle = 'rgba(255,255,255,0.95)'
    pieceCtx.lineWidth = 1.5
    pieceCtx.stroke()

    updatePosition(0)
    setVerified(false)
  }

  useEffect(() => {
    generateChallenge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePointerDown(e: React.PointerEvent) {
    if (verified) return
    dragState.current = { startX: e.clientX, startPos: positionRef.current }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current) return
    const { startX, startPos } = dragState.current
    updatePosition(Math.min(Math.max(0, startPos + (e.clientX - startX)), MAX_OFFSET))
  }

  function handlePointerUp() {
    if (!dragState.current) return
    setDragging(false)
    if (Math.abs(positionRef.current - targetRef.current.px) <= MATCH_TOLERANCE) {
      updatePosition(targetRef.current.px)
      setVerified(true)
      onVerify()
    } else {
      generateChallenge()
    }
    dragState.current = null
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
        <canvas ref={bgCanvasRef} width={CANVAS_W} height={CANVAS_H} className="block rounded-xl" />
        <canvas
          ref={pieceCanvasRef}
          width={PIECE_BOX}
          height={PIECE_BOX}
          className="pointer-events-none absolute"
          style={{
            left: -PIECE_PAD,
            top: pieceTop,
            transform: `translateX(${position}px)`,
            transition: dragging ? 'none' : 'transform 0.2s ease',
          }}
        />
        <button
          type="button"
          onClick={generateChallenge}
          aria-label={refreshLabel}
          title={refreshLabel}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/45"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className={cn(
          'relative h-11 touch-none select-none overflow-hidden rounded-2xl transition-colors',
          verified ? 'bg-emerald-600' : 'bg-emerald-500'
        )}
        style={{ width: CANVAS_W }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-black/10 transition-[width]"
          style={{ width: `${position + TRACK_PADDING + HANDLE_SIZE}px`, transitionDuration: dragging ? '0ms' : '200ms' }}
        />
        {!verified && !dragging && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-shimmer-sweep bg-linear-to-r from-transparent via-white/35 to-transparent" />
        )}
        <div
          className="pointer-events-none absolute inset-0 flex items-center text-sm font-medium text-white"
          style={{ paddingLeft: TRACK_PADDING + HANDLE_SIZE + 10, paddingRight: 12 }}
        >
          {verified ? (
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              {verifiedLabel}
            </span>
          ) : (
            <span className="truncate">{label}</span>
          )}
        </div>
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            left: TRACK_PADDING,
            top: TRACK_PADDING,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            transform: `translateX(${position}px)`,
            transition: dragging ? 'none' : 'transform 0.2s ease',
          }}
          className="absolute flex cursor-grab touch-none items-center justify-center rounded-xl bg-white text-emerald-600 shadow-md active:cursor-grabbing"
        >
          {verified ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5 animate-slider-hint" />}
        </div>
      </div>
    </div>
  )
}
