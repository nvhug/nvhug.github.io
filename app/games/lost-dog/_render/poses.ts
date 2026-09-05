/**
 * Per-entity canvas draw functions (docs/DESIGN.md § Cún đi lạc — World
 * grammar). Every hazard carries the 3px umber outline; every food carries
 * the brass rim/halo; scenery carries neither. Pure functions: `(ctx,
 * entity, ...) => void`, no component state, no mutation of anything but
 * the canvas context (plan R12).
 */

import { PALETTE } from '@/lib/games/lost-dog/palette'
import type { DogPhysics } from '@/lib/games/lost-dog/physics'
import type { CatState, Food, Obstacle, Particle } from '@/lib/games/lost-dog/types'
import { jumpHeightFraction } from '@/lib/games/lost-dog/physics'

const HAZARD_OUTLINE_PX = 3
/** World-unit ground line the lane sits on; obstacles/food/dog are drawn relative to it. */
export const GROUND_Y = 380
export const LANE_TOP_Y = 300
export const LANE_BOTTOM_Y = 420

function outlinedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
  ctx.lineWidth = HAZARD_OUTLINE_PX
  ctx.strokeStyle = PALETTE.ink
  ctx.strokeRect(x, y, w, h)
}

export function drawLane(ctx: CanvasRenderingContext2D, width: number) {
  ctx.fillStyle = PALETTE.lane
  ctx.fillRect(0, LANE_TOP_Y, width, LANE_BOTTOM_Y - LANE_TOP_Y)
  ctx.fillStyle = PALETTE.kerb
  ctx.fillRect(0, LANE_TOP_Y, width, 3)
  ctx.fillRect(0, LANE_BOTTOM_Y - 3, width, 3)
}

export function drawSky(ctx: CanvasRenderingContext2D, width: number, skyHeight: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, skyHeight)
  gradient.addColorStop(0, PALETTE.skyHigh)
  gradient.addColorStop(1, PALETTE.skyHaze)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, skyHeight)
}

/**
 * The far layer: rooftops, cool and flat. No outline, ever — scenery cannot
 * touch you and the world's grammar says so by leaving the ink off (DESIGN §
 * World grammar). `scroll` is 0 under reduced motion, which renders the same
 * shapes as a static backdrop.
 */
export function drawFarLayer(ctx: CanvasRenderingContext2D, width: number, scroll: number) {
  const period = 160
  const offset = ((scroll % period) + period) % period
  ctx.fillStyle = PALETTE.far
  for (let x = -offset; x < width + period; x += period) {
    ctx.fillRect(x, LANE_TOP_Y - 120, 90, 120)
    ctx.fillRect(x + 100, LANE_TOP_Y - 78, 44, 78)
  }
}

/** The middle layer: storefronts and lamps, warmer and taller, scrolling faster than the far one. */
export function drawMidLayer(ctx: CanvasRenderingContext2D, width: number, scroll: number) {
  const period = 220
  const offset = ((scroll % period) + period) % period
  ctx.fillStyle = PALETTE.mid
  for (let x = -offset; x < width + period; x += period) {
    ctx.fillRect(x, LANE_TOP_Y - 86, 128, 86)
    ctx.fillRect(x + 150, LANE_TOP_Y - 54, 8, 54) // lamp post
    ctx.fillRect(x + 142, LANE_TOP_Y - 60, 24, 8) // lamp head
  }
}

/**
 * The foreground band, drawn under the kerb so it never crosses the reaction
 * zone (§17's "foreground decoration never crosses the reaction zone" is
 * satisfied geometrically: it lives entirely below LANE_BOTTOM_Y).
 */
export function drawForegroundLayer(ctx: CanvasRenderingContext2D, width: number, scroll: number) {
  const period = 90
  const offset = ((scroll % period) + period) % period
  ctx.fillStyle = PALETTE.foreground
  for (let x = -offset; x < width + period; x += period) {
    ctx.fillRect(x, LANE_BOTTOM_Y + 26, 54, 16)
  }
}

/**
 * Rain presentation (§15): streaks and a wet sheen on the lane. The streaks are
 * motion, so reduced motion drops them and keeps only the still sheen — the
 * weather is still legible, it just does not move (DESIGN § Motion).
 */
export function drawRain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  reducedMotion: boolean,
) {
  ctx.save()
  ctx.fillStyle = PALETTE.rain
  ctx.globalAlpha = 0.16
  ctx.fillRect(0, LANE_TOP_Y, width, LANE_BOTTOM_Y - LANE_TOP_Y)

  if (!reducedMotion) {
    ctx.strokeStyle = PALETTE.rain
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 1
    for (let i = 0; i < 60; i++) {
      // A fixed lattice offset by one phase value: no RNG, so rain can never
      // consume either stream (plan R6).
      const x = ((i * 137 + phase * 3) % (width + 40)) - 20
      const y = ((i * 91 + phase * 7) % height)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 4, y + 12)
      ctx.stroke()
    }
  }
  ctx.restore()
}

/**
 * The Critical inner glow (DESIGN § States): an ember rim around the inside of
 * the frame at **1Hz** — one pulse per second, well under §22's three-per-second
 * ceiling, and never a full-frame flash. Drawn on the canvas rather than as a
 * DOM effect so it needs no global keyframe and stays inside §24's overlay
 * budget. `intensity` is pinned by the caller under reduced motion.
 */
export function drawCriticalGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
) {
  const inset = 6
  ctx.save()
  ctx.globalAlpha = 0.25 + 0.35 * Math.max(0, Math.min(1, intensity))
  ctx.strokeStyle = PALETTE.ember
  ctx.lineWidth = 10
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2)
  ctx.restore()
}

/** The sky-band event banner (DESIGN § The sky band): centred, inside the reserved region only. */
export function drawEventBanner(
  ctx: CanvasRenderingContext2D,
  width: number,
  skyHeight: number,
  text: string,
  alpha: number,
) {
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 22px var(--font-tuvi-sans), system-ui, sans-serif'
  ctx.lineWidth = HAZARD_OUTLINE_PX
  ctx.strokeStyle = PALETTE.ink
  ctx.strokeText(text, width / 2, skyHeight / 2)
  ctx.fillStyle = PALETTE.cream
  ctx.fillText(text, width / 2, skyHeight / 2)
  ctx.restore()
}

/**
 * Cosmetic chain-reaction debris (§16). Drawn with no outline and no rim, so
 * the world's own grammar labels it harmless the instant it appears.
 */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: readonly Particle[], originX: number) {
  ctx.save()
  ctx.fillStyle = PALETTE.mid
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.ageMs / p.maxAgeMs) * 0.8
    ctx.fillRect(originX + p.x, GROUND_Y + p.y, 5, 5)
  }
  ctx.restore()
}

/**
 * A silhouette drawn per §11's rule: flat top = jump, overhead projection =
 * duck, ground-plane mark = ground hazard. Variants may change fill/detail;
 * never the outline weight or silhouette class (enforced here by always
 * drawing the outline the same way regardless of family-specific fill).
 */
export function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle, screenX: number) {
  switch (obstacle.family) {
    case 'lowFence':
      outlinedRect(ctx, screenX, GROUND_Y - 40, 36, 40, '#c2603f')
      return
    case 'planter':
      outlinedRect(ctx, screenX, GROUND_Y - 55, 28, 55, '#4f7d52')
      return
    case 'puddle':
      ctx.fillStyle = PALETTE.ink
      ctx.globalAlpha = 0.15
      ctx.fillRect(screenX, GROUND_Y - 6, 56, 6)
      ctx.globalAlpha = 1
      ctx.lineWidth = HAZARD_OUTLINE_PX
      ctx.strokeStyle = PALETTE.ink
      ctx.strokeRect(screenX, GROUND_Y - 6, 56, 6)
      return
    case 'bicycle': {
      // Overhead projection (handlebar) above the duck line; wheels are pure scenery below it.
      ctx.fillStyle = '#5b7a8c'
      ctx.fillRect(screenX, GROUND_Y - 34, 4, 34) // frame post
      outlinedRect(ctx, screenX - 6, GROUND_Y - 46, 24, 8, '#5b7a8c') // handlebar danger zone
      return
    }
    case 'trashBin':
      outlinedRect(ctx, screenX, GROUND_Y - 42, 30, 42, '#4f7d52')
      return
    case 'pothole':
      ctx.fillStyle = PALETTE.ink
      ctx.beginPath()
      ctx.ellipse(screenX + 20, GROUND_Y - 3, 22, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = HAZARD_OUTLINE_PX
      ctx.strokeStyle = '#e9e2d4'
      ctx.stroke()
      return
  }
}

/** Halo radius scales with rarity (DESIGN § World grammar): the rarer, the brighter the invitation. */
const FOOD_HALO: Readonly<Record<Food['kind'], number>> = { bone: 6, sausage: 9, chickenLeg: 13 }

function foodHalo(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.brass
  ctx.globalAlpha = 0.25
  ctx.fill()
  ctx.globalAlpha = 1
}

function brassRim(ctx: CanvasRenderingContext2D) {
  ctx.lineWidth = 2
  ctx.strokeStyle = PALETTE.brass
  ctx.stroke()
}

/** Bone: two knobs on a shaft — the widest, flattest of the three silhouettes. */
function drawBone(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = PALETTE.corgiCream
  ctx.beginPath()
  ctx.rect(cx - 9, cy - 3, 18, 6)
  ctx.fill()
  brassRim(ctx)
  for (const dx of [-9, 9]) {
    ctx.beginPath()
    ctx.arc(cx + dx, cy, 5, 0, Math.PI * 2)
    ctx.fillStyle = PALETTE.corgiCream
    ctx.fill()
    brassRim(ctx)
  }
}

/** Sausage: one plump capsule, taller than the bone and with no end knobs. */
function drawSausage(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.beginPath()
  ctx.ellipse(cx, cy, 12, 6, -0.25, 0, Math.PI * 2)
  ctx.fillStyle = '#c2603f'
  ctx.fill()
  brassRim(ctx)
}

/** Chicken leg: a drumstick — round mass on a stub, the tallest silhouette of the three. */
function drawChickenLeg(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.beginPath()
  ctx.arc(cx + 3, cy + 1, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#b06a34'
  ctx.fill()
  brassRim(ctx)
  ctx.beginPath()
  ctx.rect(cx - 11, cy - 8, 7, 7)
  ctx.fillStyle = PALETTE.corgiCream
  ctx.fill()
  brassRim(ctx)
}

/**
 * Brass rim + halo, never a hazard outline — the reward half of the world's
 * grammar. Each kind has its own silhouette so the three are told apart in
 * grayscale and under a colour-vision simulation (§22), not by hue.
 */
export function drawFood(ctx: CanvasRenderingContext2D, food: Food, screenX: number) {
  const cx = screenX + 10
  const cy = GROUND_Y - 20
  foodHalo(ctx, cx, cy, FOOD_HALO[food.kind])
  if (food.kind === 'bone') drawBone(ctx, cx, cy)
  else if (food.kind === 'sausage') drawSausage(ctx, cx, cy)
  else drawChickenLeg(ctx, cx, cy)
}

/**
 * The dotted scent path from the dog's nose to the food its instinct has
 * noticed (§14). Drawn in-world, brass, and static under reduced motion — the
 * dashes march only when motion is allowed (DESIGN § Motion).
 */
export function drawInstinctTrail(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  toX: number,
  marchPhase: number,
) {
  const y = GROUND_Y - 34
  ctx.save()
  ctx.setLineDash([4, 7])
  ctx.lineDashOffset = -marchPhase
  ctx.strokeStyle = PALETTE.brass
  ctx.globalAlpha = 0.7
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(fromX, y)
  ctx.quadraticCurveTo((fromX + toX) / 2, y - 26, toX, GROUND_Y - 20)
  ctx.stroke()
  ctx.restore()
}

/**
 * The dog's reaction vocabulary (§17). The silhouette carries the gameplay
 * state (running / low profile / airborne / stumble); the reaction only adds
 * head, ear and tail detail on top of it, so it can never make two gameplay
 * states look alike.
 */
export type DogReaction = 'running' | 'collecting' | 'hit' | 'threatened' | 'tired'

/** Running / airborne / ducking silhouettes stay distinct from each other without color (§17). */
export function drawDog(
  ctx: CanvasRenderingContext2D,
  dog: DogPhysics,
  dogScreenX: number,
  reaction: DogReaction = 'running',
  reducedMotion = false,
) {
  // Under reduced motion the jump still occupies exactly the same airtime and
  // still passes through crouch/rise/apex/fall at the same instants — it snaps
  // between those key poses instead of interpolating (§22: "preserves
  // anticipation timing through static pose changes"). The simulation is
  // untouched either way: collision reads DogPhysics, never this height.
  const raw = jumpHeightFraction(dog)
  const height = reducedMotion ? Math.round(raw * 2) / 2 : raw
  const liftPx = height * 60
  const duckSquash = (reducedMotion ? Math.round(dog.duckProgress) : dog.duckProgress) * 12

  const bodyW = 48
  const bodyH = 30 - duckSquash
  const y = GROUND_Y - bodyH - liftPx
  // A stumble tips the body forward; nothing here changes the collision profile,
  // which is computed from DogPhysics alone (§17's "never distort the collision contract").
  const tilt = reaction === 'hit' ? 0.22 : 0

  ctx.save()
  ctx.translate(dogScreenX + bodyW / 2, y + bodyH / 2)
  ctx.rotate(tilt)
  ctx.translate(-(dogScreenX + bodyW / 2), -(y + bodyH / 2))

  ctx.fillStyle = PALETTE.corgiBody
  ctx.fillRect(dogScreenX, y, bodyW, bodyH)
  ctx.fillStyle = PALETTE.corgiCream
  ctx.fillRect(dogScreenX + bodyW - 14, y - 6, 12, 10) // head/blaze silhouette accent

  // Ears: up and forward when the instinct cue is live, flat back when ducking
  // or threatened, drooped when tired.
  const earLift = reaction === 'collecting' ? 9 : reaction === 'threatened' ? 3 : reaction === 'tired' ? 1 : 6
  const earLean = reaction === 'collecting' ? 3 : reaction === 'threatened' ? -3 : 0
  ctx.fillStyle = PALETTE.corgiBody
  ctx.fillRect(dogScreenX + bodyW - 12 + earLean, y - 6 - earLift, 4, earLift)
  ctx.fillRect(dogScreenX + bodyW - 6 + earLean, y - 6 - earLift, 4, earLift)

  // Eye leads toward the target while collecting; a plain dot otherwise.
  ctx.fillStyle = PALETTE.ink
  ctx.fillRect(dogScreenX + bodyW - (reaction === 'collecting' ? 5 : 8), y - 2, 3, 3)

  // Tail: raised when noticing food, tucked under threat.
  const tailY = reaction === 'threatened' ? y + bodyH - 4 : y + 2
  ctx.fillStyle = PALETTE.corgiCream
  ctx.fillRect(dogScreenX - 8, tailY, 9, 5)

  // Tongue out on sustained speed (§17's fatigue read).
  if (reaction === 'tired') {
    ctx.fillStyle = PALETTE.ember
    ctx.fillRect(dogScreenX + bodyW - 2, y + 1, 5, 3)
  }

  ctx.restore()
}

export function drawCat(ctx: CanvasRenderingContext2D, cat: CatState, catScreenX: number) {
  ctx.fillStyle = PALETTE.cat
  ctx.fillRect(catScreenX, GROUND_Y - 26, 34, 26)
}
