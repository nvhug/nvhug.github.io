/**
 * Draw-order orchestration for one Snapshot (docs/DESIGN.md § Layering):
 * far → mid → lane → gameplay → foreground → in-world UI, on the one 960x540
 * world-unit canvas. Reads only a Snapshot — never Run — so it structurally
 * cannot mutate simulation state (plan R4/R12).
 *
 * The camera transform is applied here and nowhere else: every world coordinate
 * this function receives was already decided by the simulation, so a widen or a
 * shake can only change how the frame is painted (§18).
 */

import { cameraFor } from '@/lib/games/lost-dog/camera'
import { TUNING } from '@/lib/games/lost-dog/config'
import type { Snapshot } from '@/lib/games/lost-dog/types'
import {
  drawCat,
  drawCriticalGlow,
  drawDog,
  drawEventBanner,
  drawFarLayer,
  drawFood,
  drawForegroundLayer,
  drawInstinctTrail,
  drawLane,
  drawMidLayer,
  drawObstacle,
  drawParticles,
  drawRain,
  drawSky,
  type DogReaction,
} from './poses'

export const APERTURE_WIDTH = 960
export const APERTURE_HEIGHT = 540
/** The dog's fixed screen position; the world scrolls under it (run.ts's world-space model). */
export const DOG_SCREEN_X = 180

/** Parallax rates, slowest layer first (DESIGN § Layering). 1.0 is the gameplay lane's own rate. */
const PARALLAX = { far: 0.15, mid: 0.4, foreground: 1.35 }

/** §24 caps the canvas backing ratio at 2; the page measures it, this module applies it. */
export const MAX_DPR = 2

export interface DrawOptions {
  /** Disables every decorative motion; never changes what is drawn where (§22, SC-009). */
  readonly reducedMotion: boolean
  /** Already-translated banner copy, or null. The renderer never touches i18n itself. */
  readonly eventBannerText?: string | null
  /** Backing-store ratio the canvas element was sized for; defaults to 1. */
  readonly dpr?: number
}

/** The dog's reaction pose, derived from the snapshot alone — never from RNG or a timer. */
function reactionFor(snapshot: Snapshot): DogReaction {
  if (snapshot.state === 'HIT_REACTION') return 'hit'
  if (snapshot.pursuitBand === 'danger' || snapshot.pursuitBand === 'critical') return 'threatened'
  if (snapshot.instinctTargetId !== null) return 'collecting'
  if (snapshot.band.speed >= 1.5) return 'tired'
  return 'running'
}

/** 0..1 fade envelope for the banner: 150ms in, hold, 150ms out (DESIGN § Motion). */
function bannerAlpha(snapshot: Snapshot): number {
  if (!snapshot.activeEvent) return 0
  const shownMs = snapshot.elapsedActiveMs - snapshot.activeEvent.startedAtMs
  if (shownMs < 0 || shownMs > TUNING.events.bannerMs) return 0
  const fade = 150
  if (shownMs < fade) return shownMs / fade
  if (shownMs > TUNING.events.bannerMs - fade) return (TUNING.events.bannerMs - shownMs) / fade
  return 1
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  snapshot: Snapshot,
  options: DrawOptions = { reducedMotion: false },
) {
  const { reducedMotion } = options
  const camera = cameraFor(snapshot, reducedMotion)
  const dpr = Math.min(MAX_DPR, Math.max(1, options.dpr ?? 1))

  // Everything below is written in world units; this one transform turns them
  // into device pixels, so no draw function ever has to know about DPR.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.save()
  ctx.clearRect(0, 0, APERTURE_WIDTH, APERTURE_HEIGHT)

  // Widen about the frame's centre so the extra world appears on both sides;
  // the shake is a whole-frame pixel offset on top of it.
  ctx.translate(APERTURE_WIDTH / 2 + camera.offsetX, APERTURE_HEIGHT / 2 + camera.offsetY)
  ctx.scale(camera.scale, camera.scale)
  ctx.translate(-APERTURE_WIDTH / 2, -APERTURE_HEIGHT / 2)

  drawSky(ctx, APERTURE_WIDTH, APERTURE_HEIGHT * TUNING.skyBandFraction)

  // Parallax is decoration: under reduced motion the layers render as a static
  // painted backdrop while everything gameplay-bearing still moves normally.
  const scroll = reducedMotion ? 0 : snapshot.distance
  drawFarLayer(ctx, APERTURE_WIDTH, scroll * PARALLAX.far)
  drawMidLayer(ctx, APERTURE_WIDTH, scroll * PARALLAX.mid)
  drawLane(ctx, APERTURE_WIDTH)

  for (const obstacle of snapshot.obstacles) {
    if (obstacle.resolved) continue
    const screenX = DOG_SCREEN_X + obstacle.x
    if (screenX < -60 || screenX > APERTURE_WIDTH + 60) continue
    drawObstacle(ctx, obstacle, screenX)
  }

  for (const food of snapshot.food) {
    if (food.collected) continue
    const screenX = DOG_SCREEN_X + food.x
    if (screenX < -60 || screenX > APERTURE_WIDTH + 60) continue
    drawFood(ctx, food, screenX)
  }

  const instinctTarget =
    snapshot.instinctTargetId === null
      ? null
      : (snapshot.food.find((f) => f.id === snapshot.instinctTargetId) ?? null)
  if (instinctTarget) {
    // The dash march is a function of distance travelled, not of a wall clock,
    // so it stays deterministic; reduced motion pins it (DESIGN § Motion).
    const marchPhase = reducedMotion ? 0 : snapshot.distance % 22
    drawInstinctTrail(ctx, DOG_SCREEN_X + 46, DOG_SCREEN_X + instinctTarget.x + 10, marchPhase)
  }

  drawParticles(ctx, snapshot.particles, DOG_SCREEN_X)
  drawCat(ctx, snapshot.cat, DOG_SCREEN_X + snapshot.cat.x)
  drawDog(ctx, snapshot.dog, DOG_SCREEN_X, reactionFor(snapshot), reducedMotion, snapshot.elapsedActiveMs)
  drawForegroundLayer(ctx, APERTURE_WIDTH, scroll * PARALLAX.foreground)

  if (snapshot.weather === 'rain') {
    drawRain(ctx, APERTURE_WIDTH, APERTURE_HEIGHT, snapshot.distance, reducedMotion)
  }

  if (snapshot.pursuitBand === 'critical') {
    // 1Hz, phased off elapsed run time so it is deterministic; a static rim
    // under reduced motion, which still carries the same information.
    const pulse = reducedMotion ? 1 : (1 - Math.cos((snapshot.elapsedActiveMs / 1000) * Math.PI * 2)) / 2
    drawCriticalGlow(ctx, APERTURE_WIDTH, APERTURE_HEIGHT, pulse)
  }

  const alpha = bannerAlpha(snapshot)
  if (alpha > 0 && options.eventBannerText) {
    drawEventBanner(
      ctx,
      APERTURE_WIDTH,
      APERTURE_HEIGHT * TUNING.skyBandFraction,
      options.eventBannerText,
      reducedMotion ? 1 : alpha,
    )
  }

  ctx.restore()
}
