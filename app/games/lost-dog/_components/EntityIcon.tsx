'use client'

/**
 * Renders one obstacle or food entity, cropped and scaled to fill a small
 * square canvas, using the exact same draw functions the running game uses
 * (`poses.ts`) — so the legend can never drift from what actually appears
 * on the field (ADR-030: canvas primitives only, no asset files).
 *
 * The per-kind boxes below are hand-measured from each draw function's own
 * geometry (all relative to `GROUND_Y`/`screenX=0`) — purely a framing crop
 * for this decorative icon, never read by gameplay code.
 */

import { useEffect, useRef } from 'react'
import type { FoodKind, ObstacleFamily } from '@/lib/games/lost-dog/config'
import { drawFood, drawObstacle } from '../_render/poses'

const SIZE = 56
const DPR = 2

interface IconBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

const OBSTACLE_BOX: Readonly<Record<ObstacleFamily, IconBox>> = {
  lowFence: { x: -2, y: 340, w: 42, h: 44 },
  planter: { x: -3, y: 304, w: 35, h: 80 },
  puddle: { x: -4, y: 366, w: 66, h: 20 },
  bicycle: { x: -3, y: 327, w: 48, h: 56 },
  trashBin: { x: -5, y: 334, w: 40, h: 49 },
  pothole: { x: -5, y: 368, w: 50, h: 25 },
}

const FOOD_BOX: Readonly<Record<FoodKind, IconBox>> = {
  bone: { x: -6, y: 350, w: 32, h: 20 },
  sausage: { x: -5, y: 348, w: 32, h: 24 },
  chickenLeg: { x: -6, y: 344, w: 36, h: 32 },
}

export type EntityKind = { readonly type: 'obstacle'; readonly family: ObstacleFamily } | { readonly type: 'food'; readonly foodKind: FoodKind }

export function EntityIcon({ kind }: { kind: EntityKind }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const canvasSize = SIZE * DPR
    const box = kind.type === 'obstacle' ? OBSTACLE_BOX[kind.family] : FOOD_BOX[kind.foodKind]
    const scale = Math.min(canvasSize / box.w, canvasSize / box.h) * 0.9

    ctx.clearRect(0, 0, canvasSize, canvasSize)
    ctx.save()
    ctx.translate((canvasSize - box.w * scale) / 2, (canvasSize - box.h * scale) / 2)
    ctx.scale(scale, scale)
    ctx.translate(-box.x, -box.y)

    if (kind.type === 'obstacle') {
      drawObstacle(ctx, { id: 0, family: kind.family, x: 0, resolved: false }, 0)
    } else {
      drawFood(ctx, { id: 0, kind: kind.foodKind, x: 0, collected: false }, 0)
    }
    ctx.restore()
  }, [kind])

  return (
    <canvas
      ref={canvasRef}
      width={SIZE * DPR}
      height={SIZE * DPR}
      aria-hidden
      style={{ width: SIZE, height: SIZE }}
      className="shrink-0 rounded-lg bg-(--games-mat)/40"
    />
  )
}
