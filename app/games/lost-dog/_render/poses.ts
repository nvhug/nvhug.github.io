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

/** A filled path with a stroked outline in one call — every solid shape below uses this. */
function fillWithOutline(ctx: CanvasRenderingContext2D, fill: string, outline: string, outlineWidth: number) {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = outlineWidth
  ctx.strokeStyle = outline
  ctx.stroke()
}

/**
 * Starts a rounded-rectangle path, using the native `ctx.roundRect` where
 * available and a manual `arcTo` construction otherwise — `roundRect` is
 * unsupported on Safari < 16.4 and some older WebViews, and this is the only
 * place in the codebase that draws one, so there is no other call site to
 * miss. `radii` matches the native API's per-corner form: one number for all
 * four corners, or `[topLeft, topRight, bottomRight, bottomLeft]`.
 */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number | readonly number[],
) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radii as number[])
    return
  }
  const [tl, tr, br, bl] = Array.isArray(radii) ? radii : [radii, radii, radii, radii]
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  ctx.arcTo(x + w, y, x + w, y + tr, tr)
  ctx.lineTo(x + w, y + h - br)
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br)
  ctx.lineTo(x + bl, y + h)
  ctx.arcTo(x, y + h, x, y + h - bl, bl)
  ctx.lineTo(x, y + tl)
  ctx.arcTo(x, y, x + tl, y, tl)
  ctx.closePath()
}

/** A stubby leg: a rounded capsule, angled slightly back when running, tucked flat when airborne. */
function drawLeg(ctx: CanvasRenderingContext2D, hipX: number, hipY: number, tuck: number, swing: number) {
  const len = 12 * (1 - tuck)
  if (len <= 0.5) return
  const footX = hipX + swing * len * 0.4
  const footY = hipY + len
  ctx.beginPath()
  ctx.moveTo(hipX - 3, hipY)
  ctx.lineTo(footX - 3, footY)
  ctx.quadraticCurveTo(footX, footY + 3, footX + 3, footY)
  ctx.lineTo(hipX + 3, hipY)
  ctx.closePath()
  fillWithOutline(ctx, PALETTE.corgiBodyShade, PALETTE.ink, 1)
}

/**
 * The Corgi (§17): a low, long "loaf" body — the breed's signature silhouette
 * — a rounded head with the big upright ears, a tapered snout, a fluffed
 * curled tail, and two visible stubby legs. Running / airborne / ducking
 * stay distinct from each other by silhouette alone, without colour (§17);
 * the reaction vocabulary (ears/eye/tail/tongue) rides on top of it and can
 * never change the footprint DogPhysics/collision.ts actually collide
 * against — every number here is cosmetic geometry around that footprint,
 * never a substitute for it.
 */
export function drawDog(
  ctx: CanvasRenderingContext2D,
  dog: DogPhysics,
  dogScreenX: number,
  reaction: DogReaction = 'running',
  reducedMotion = false,
  /** Drives the grounded run-cycle leg swing — any steadily-increasing clock
   *  works (the caller passes `elapsedActiveMs`). `dog.airborneMs` cannot be
   *  used for this: it is pinned to exactly 0 whenever the dog is grounded
   *  (physics.ts), so a swing driven by it would never actually move. */
  runCyclePhaseMs = 0,
) {
  // Under reduced motion the jump still occupies exactly the same airtime and
  // still passes through crouch/rise/apex/fall at the same instants — it snaps
  // between those key poses instead of interpolating (§22: "preserves
  // anticipation timing through static pose changes"). The simulation is
  // untouched either way: collision reads DogPhysics, never this height.
  const raw = jumpHeightFraction(dog)
  const height = reducedMotion ? Math.round(raw * 2) / 2 : raw
  const airborne = !dog.grounded
  const liftPx = height * 60
  const duckProgress = reducedMotion ? Math.round(dog.duckProgress) : dog.duckProgress
  const duckSquash = duckProgress * 12

  const bodyW = 48
  const bodyH = 30 - duckSquash
  const bodyX = dogScreenX
  const bodyY = GROUND_Y - bodyH - liftPx - 10 // -10: legs occupy the space between body and GROUND_Y
  // A stumble tips the body forward; nothing here changes the collision profile,
  // which is computed from DogPhysics alone (§17's "never distort the collision contract").
  const tilt = reaction === 'hit' ? 0.22 : 0

  ctx.save()
  ctx.translate(bodyX + bodyW / 2, bodyY + bodyH / 2)
  ctx.rotate(tilt)
  ctx.translate(-(bodyX + bodyW / 2), -(bodyY + bodyH / 2))

  // Legs: two visible, planted when grounded, swept back and tucked when
  // airborne or ducking (a Corgi's legs disappear under its low body when it
  // crouches, which is exactly what ducking should read as).
  const legTuck = airborne ? 0.85 : duckProgress * 0.5
  const runSwing = airborne || reducedMotion ? 0 : Math.sin(runCyclePhaseMs * 0.012) * 0.6
  drawLeg(ctx, bodyX + 10, bodyY + bodyH - 2, legTuck, -1 - runSwing)
  drawLeg(ctx, bodyX + bodyW - 14, bodyY + bodyH - 2, legTuck, 1 + runSwing)

  // Body: a rounded "loaf" — long, low, generous corner radius front and back.
  roundRectPath(ctx, bodyX, bodyY, bodyW, bodyH, [bodyH * 0.55, bodyH * 0.4, bodyH * 0.4, bodyH * 0.3])
  fillWithOutline(ctx, PALETTE.corgiBody, PALETTE.ink, 1.25)

  // Back shading: a subtle darker cap along the spine, not a new hue.
  roundRectPath(ctx, bodyX + 3, bodyY + 1, bodyW - 10, bodyH * 0.32, bodyH * 0.2)
  ctx.fillStyle = PALETTE.corgiBodyShade
  ctx.globalAlpha = 0.35
  ctx.fill()
  ctx.globalAlpha = 1

  // Chest/blaze: the cream patch, low on the front of the body.
  ctx.beginPath()
  ctx.ellipse(bodyX + bodyW - 10, bodyY + bodyH - 4, 9, bodyH * 0.42, 0, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.corgiCream
  ctx.fill()

  // Head: a rounded blob at the front-top of the body, overlapping it so the
  // silhouette reads as one animal, not a body with a box stuck on it.
  const headCx = bodyX + bodyW - 6
  const headCy = bodyY - 2
  const headR = 12
  ctx.beginPath()
  ctx.arc(headCx, headCy, headR, 0, Math.PI * 2)
  fillWithOutline(ctx, PALETTE.corgiBody, PALETTE.ink, 1.25)

  // Snout: a tapered wedge off the front of the head.
  ctx.beginPath()
  ctx.moveTo(headCx + headR - 2, headCy - 4)
  ctx.lineTo(headCx + headR + 9, headCy + 1)
  ctx.lineTo(headCx + headR - 2, headCy + 6)
  ctx.closePath()
  fillWithOutline(ctx, PALETTE.corgiCream, PALETTE.ink, 1)
  // Nose: the one pure-ink mark on the whole animal.
  ctx.beginPath()
  ctx.arc(headCx + headR + 8, headCy + 1, 1.6, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.ink
  ctx.fill()

  // Ears: the Corgi's signature big upright triangles. Up and forward when the
  // instinct cue is live, flattened back when ducking/threatened, drooped
  // when tired — always a shape change, never a colour change (§17).
  const earUp = reaction === 'collecting' ? 1 : reaction === 'threatened' ? 0.3 : reaction === 'tired' ? 0.15 : 0.75
  const earLean = reaction === 'collecting' ? 3 : reaction === 'threatened' ? -4 : -1
  for (const side of [-1, 1] as const) {
    const baseX = headCx + side * 6
    const tipX = baseX + earLean * side * 0.4 + side * 2
    const tipY = headCy - headR - 14 * earUp
    ctx.beginPath()
    ctx.moveTo(baseX - 4, headCy - headR + 3)
    ctx.lineTo(tipX, tipY)
    ctx.lineTo(baseX + 4, headCy - headR + 3)
    ctx.closePath()
    fillWithOutline(ctx, PALETTE.corgiBody, PALETTE.ink, 1)
    // Inner-ear shade, only readable when the ear is actually raised.
    if (earUp > 0.4) {
      ctx.beginPath()
      ctx.moveTo(baseX - 1.5, headCy - headR + 1)
      ctx.lineTo(tipX, tipY + 4)
      ctx.lineTo(baseX + 1.5, headCy - headR + 1)
      ctx.closePath()
      ctx.fillStyle = PALETTE.corgiBodyShade
      ctx.fill()
    }
  }

  // Eye: a real circle with a highlight, leading toward the target while
  // collecting rather than a plain dot.
  const eyeX = headCx + (reaction === 'collecting' ? 6 : 3)
  ctx.beginPath()
  ctx.arc(eyeX, headCy - 1, 2.4, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.ink
  ctx.fill()
  ctx.beginPath()
  ctx.arc(eyeX + 0.7, headCy - 1.7, 0.8, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.corgiCream
  ctx.fill()

  // Tail: a curled, fluffed sweep instead of a flat rectangle — raised and
  // curled forward when noticing food, tucked low under threat.
  const tailLift = reaction === 'threatened' ? -0.15 : reaction === 'collecting' ? 0.85 : 0.45
  const tailBaseX = bodyX + 4
  const tailBaseY = bodyY + bodyH * 0.4
  const tailTipX = tailBaseX - 14
  const tailTipY = tailBaseY - 16 * tailLift
  ctx.beginPath()
  ctx.moveTo(tailBaseX, tailBaseY - 3)
  ctx.quadraticCurveTo(tailBaseX - 12, tailBaseY - 6 - 10 * tailLift, tailTipX, tailTipY)
  ctx.quadraticCurveTo(tailBaseX - 6, tailBaseY + 2 - 6 * tailLift, tailBaseX, tailBaseY + 4)
  ctx.closePath()
  fillWithOutline(ctx, PALETTE.corgiCream, PALETTE.ink, 1)

  // Tongue out on sustained speed (§17's fatigue read).
  if (reaction === 'tired') {
    ctx.beginPath()
    ctx.ellipse(headCx + headR + 4, headCy + 6, 2, 4, 0.3, 0, Math.PI * 2)
    ctx.fillStyle = PALETTE.ember
    ctx.fill()
  }

  ctx.restore()
}

/**
 * The cat (§17): one deep violet-charcoal mass with brass eyes (DESIGN §
 * Palette), but a crouched, prowling *silhouette* — an arched back, pointed
 * ears, a curled tail — not a rectangle. It stays legible at a glance and in
 * grayscale precisely because it is a shape, not a colour.
 */
export function drawCat(ctx: CanvasRenderingContext2D, cat: CatState, catScreenX: number) {
  const bodyW = 34
  const bodyH = 22
  const x = catScreenX
  const y = GROUND_Y - bodyH

  ctx.save()

  // Body: a crouching arch — low at the haunches, rising toward the shoulders.
  ctx.beginPath()
  ctx.moveTo(x, y + bodyH)
  ctx.quadraticCurveTo(x, y + 6, x + 8, y + 4)
  ctx.quadraticCurveTo(x + bodyW * 0.55, y - 6, x + bodyW - 6, y + 3)
  ctx.quadraticCurveTo(x + bodyW, y + 8, x + bodyW, y + bodyH)
  ctx.closePath()
  fillWithOutline(ctx, PALETTE.cat, PALETTE.ink, 1.25)

  // Haunch shading — a darker patch at the rear, the one bit of depth on the mass.
  ctx.beginPath()
  ctx.ellipse(x + 7, y + bodyH - 5, 7, 8, 0.2, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.catShade
  ctx.globalAlpha = 0.5
  ctx.fill()
  ctx.globalAlpha = 1

  // Head: a smaller rounded mass at the shoulder, low and forward (a prowling
  // cat carries its head level with its back, not above it).
  const headCx = x + bodyW - 4
  const headCy = y + 2
  ctx.beginPath()
  ctx.arc(headCx, headCy, 7, 0, Math.PI * 2)
  fillWithOutline(ctx, PALETTE.cat, PALETTE.ink, 1)

  // Ears: sharp triangles, taller and narrower than the dog's.
  for (const side of [-1, 1] as const) {
    const baseX = headCx + side * 3.5
    ctx.beginPath()
    ctx.moveTo(baseX - 2.5, headCy - 5)
    ctx.lineTo(baseX + side * 1.5, headCy - 13)
    ctx.lineTo(baseX + 2.5, headCy - 5)
    ctx.closePath()
    fillWithOutline(ctx, PALETTE.cat, PALETTE.ink, 1)
  }

  // Eyes: the one glowing accent on the whole silhouette.
  for (const side of [-1, 1] as const) {
    ctx.beginPath()
    ctx.ellipse(headCx + side * 2.6, headCy - 0.5, 1.3, 0.9, 0, 0, Math.PI * 2)
    ctx.fillStyle = PALETTE.catEye
    ctx.fill()
  }

  // Tail: a curled sweep rising behind the haunches.
  ctx.beginPath()
  ctx.moveTo(x + 2, y + bodyH - 6)
  ctx.quadraticCurveTo(x - 10, y + bodyH - 10, x - 9, y + 2)
  ctx.quadraticCurveTo(x - 8, y - 4, x - 2, y - 2)
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.strokeStyle = PALETTE.cat
  ctx.stroke()

  ctx.restore()
}
