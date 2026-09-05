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

interface FarProfile {
  readonly w: number
  readonly h: number
  readonly kind: 'flat' | 'gabled' | 'tree'
}

/** A small, fixed (never random — the renderer never reads either RNG stream, plan
 *  R4) set of rooftop/tree silhouettes, cycled by position so the skyline reads as
 *  a real, varied street instead of one shape stamped on a loop. */
const FAR_PROFILES: readonly FarProfile[] = [
  { w: 76, h: 96, kind: 'flat' },
  { w: 46, h: 134, kind: 'gabled' },
  { w: 34, h: 62, kind: 'tree' },
  { w: 58, h: 78, kind: 'flat' },
  { w: 40, h: 108, kind: 'gabled' },
  { w: 30, h: 54, kind: 'tree' },
]
const FAR_GAP = 20

/**
 * The far layer: a real skyline — flat and gabled rooftops plus a few trees,
 * cool and flat colour, no outline, ever (scenery cannot touch you, and the
 * world's grammar says so by leaving the ink off — DESIGN § World grammar).
 * `scroll` is 0 under reduced motion, which renders the same shapes as a
 * static backdrop.
 */
export function drawFarLayer(ctx: CanvasRenderingContext2D, width: number, scroll: number) {
  const groupWidth = FAR_PROFILES.reduce((sum, p) => sum + p.w + FAR_GAP, 0)
  const offset = ((scroll % groupWidth) + groupWidth) % groupWidth
  const base = LANE_TOP_Y
  ctx.fillStyle = PALETTE.far

  for (let groupX = -offset; groupX < width + groupWidth; groupX += groupWidth) {
    let x = groupX
    for (const p of FAR_PROFILES) {
      const top = base - p.h
      if (p.kind === 'tree') {
        ctx.fillRect(x + p.w * 0.4, base - p.h * 0.4, p.w * 0.2, p.h * 0.4)
        ctx.beginPath()
        ctx.ellipse(x + p.w / 2, base - p.h * 0.65, p.w * 0.55, p.h * 0.42, 0, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.kind === 'gabled') {
        ctx.beginPath()
        ctx.moveTo(x, top + 16)
        ctx.lineTo(x + p.w / 2, top)
        ctx.lineTo(x + p.w, top + 16)
        ctx.lineTo(x + p.w, base)
        ctx.lineTo(x, base)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.fillRect(x, top, p.w, p.h)
      }
      x += p.w + FAR_GAP
    }
  }
}

interface MidProfile {
  readonly w: number
  readonly h: number
  readonly awning: boolean
}

const MID_PROFILES: readonly MidProfile[] = [
  { w: 100, h: 82, awning: true },
  { w: 66, h: 58, awning: false },
  { w: 118, h: 96, awning: true },
  { w: 52, h: 48, awning: false },
]
const MID_GAP = 28
/** Reserved trailing space in each group for the one lamp post per group. */
const MID_LAMP_SLOT = 40

/**
 * The middle layer: storefronts, lit windows and awnings, one lamp post per
 * group, warmer and taller than the far layer, scrolling faster. Varied
 * storefront sizes (cycled, not random — same reasoning as the far layer)
 * replace what used to be one repeating rectangle.
 */
export function drawMidLayer(ctx: CanvasRenderingContext2D, width: number, scroll: number) {
  const groupWidth = MID_PROFILES.reduce((sum, p) => sum + p.w + MID_GAP, 0) + MID_LAMP_SLOT
  const offset = ((scroll % groupWidth) + groupWidth) % groupWidth
  const base = LANE_TOP_Y

  for (let groupX = -offset; groupX < width + groupWidth; groupX += groupWidth) {
    let x = groupX
    for (const p of MID_PROFILES) {
      const top = base - p.h
      ctx.fillStyle = PALETTE.mid
      ctx.fillRect(x, top, p.w, p.h)

      // Windows: dim recessed squares, a texture cue only — never an outline,
      // so they can never be mistaken for the hazard grammar.
      ctx.fillStyle = PALETTE.ink
      ctx.globalAlpha = 0.22
      const cols = Math.max(1, Math.floor((p.w - 12) / 26))
      for (let c = 0; c < cols; c++) {
        ctx.fillRect(x + 10 + c * 26, top + 10, 12, 14)
      }
      ctx.globalAlpha = 1

      if (p.awning) {
        ctx.fillStyle = '#a67c52'
        ctx.fillRect(x - 2, top + p.h - 12, p.w + 4, 7)
      }
      x += p.w + MID_GAP
    }
    // One lamp post per group, in the trailing slot.
    ctx.fillStyle = PALETTE.mid
    ctx.fillRect(x + 14, base - 54, 8, 54)
    ctx.fillRect(x + 6, base - 60, 24, 8)
  }
}

/**
 * The foreground band, drawn under the kerb so it never crosses the reaction
 * zone (§17's "foreground decoration never crosses the reaction zone" is
 * satisfied geometrically: it lives entirely below LANE_BOTTOM_Y). Two
 * alternating shapes — a low curb segment and a slim bollard — instead of
 * one repeating dash.
 */
export function drawForegroundLayer(ctx: CanvasRenderingContext2D, width: number, scroll: number) {
  const profiles = [
    { w: 54, h: 16, bollard: false },
    { w: 10, h: 22, bollard: true },
  ] as const
  const gap = 34
  const groupWidth = profiles.reduce((sum, p) => sum + p.w + gap, 0)
  const offset = ((scroll % groupWidth) + groupWidth) % groupWidth
  ctx.fillStyle = PALETTE.foreground

  for (let groupX = -offset; groupX < width + groupWidth; groupX += groupWidth) {
    let x = groupX
    for (const p of profiles) {
      const y = p.bollard ? LANE_BOTTOM_Y + 20 : LANE_BOTTOM_Y + 26
      ctx.fillRect(x, y, p.w, p.h)
      x += p.w + gap
    }
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

/**
 * The required-reaction cue (docs/DESIGN.md § The world's grammar, follow-up):
 * a small ink-on-cream badge floating above every hazard, chevron pointing
 * the direction of the fix — up for jump, down for duck. Pure shape and
 * light/dark contrast, the same two colours the hazard outline and the kerb
 * already use, so it survives grayscale and colour-vision simulation exactly
 * like the outline does (§22) — never a colour-only signal. Added because
 * the outline/silhouette distinction alone did not read fast enough during
 * real play, and a duck-only obstacle among five jump-only ones was reading
 * as unbeatable rather than as "the one that wants a different reaction."
 */
function drawActionCue(ctx: CanvasRenderingContext2D, cx: number, cy: number, direction: 'up' | 'down') {
  ctx.beginPath()
  ctx.arc(cx, cy, 9, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.cream
  ctx.fill()
  ctx.lineWidth = 1.25
  ctx.strokeStyle = PALETTE.ink
  ctx.stroke()

  ctx.beginPath()
  if (direction === 'up') {
    ctx.moveTo(cx - 4, cy + 2)
    ctx.lineTo(cx, cy - 3)
    ctx.lineTo(cx + 4, cy + 2)
  } else {
    ctx.moveTo(cx - 4, cy - 2)
    ctx.lineTo(cx, cy + 3)
    ctx.lineTo(cx + 4, cy - 2)
  }
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = PALETTE.ink
  ctx.stroke()
}

/** lowFence: a picket rail — level picket tops read as one clean jump line. */
function drawLowFence(ctx: CanvasRenderingContext2D, screenX: number) {
  const top = GROUND_Y - 38
  const wood = '#c2603f'
  const woodDark = '#96482f'
  // Two horizontal rails behind the pickets.
  ctx.fillStyle = woodDark
  ctx.fillRect(screenX, top + 8, 38, 5)
  ctx.fillRect(screenX, top + 26, 38, 5)
  // Four pickets, flat-topped and level — the collision-relevant silhouette.
  for (let i = 0; i < 4; i++) {
    const px = screenX + 2 + i * 9
    roundRectPath(ctx, px, top, 7, 40, [1, 1, 0, 0])
    fillWithOutline(ctx, wood, PALETTE.ink, HAZARD_OUTLINE_PX)
  }
  drawActionCue(ctx, screenX + 19, top - 12, 'up')
}

/** planter: a wide-rimmed pot, flat top, with a few leaves as thin detail above it — never widening the jump-relevant silhouette. */
function drawPlanter(ctx: CanvasRenderingContext2D, screenX: number) {
  const rimY = GROUND_Y - 50
  const potTop = rimY + 4
  // Pot: a trapezoid, wider at the rim than the base.
  ctx.beginPath()
  ctx.moveTo(screenX + 3, potTop)
  ctx.lineTo(screenX + 25, potTop)
  ctx.lineTo(screenX + 21, GROUND_Y)
  ctx.lineTo(screenX + 7, GROUND_Y)
  ctx.closePath()
  fillWithOutline(ctx, '#b5691f', PALETTE.ink, HAZARD_OUTLINE_PX)
  // Rim: the flat top edge a jump is actually judged against.
  roundRectPath(ctx, screenX, rimY, 28, 6, 2)
  fillWithOutline(ctx, '#8a5a34', PALETTE.ink, HAZARD_OUTLINE_PX)
  // Leaves: three simple blades, thin enough to never read as the jump line.
  ctx.fillStyle = '#4f7d52'
  for (const [dx, h, lean] of [[6, 16, -0.3], [14, 22, 0], [21, 15, 0.35]] as const) {
    ctx.save()
    ctx.translate(screenX + dx, rimY)
    ctx.rotate(lean)
    ctx.beginPath()
    ctx.ellipse(0, -h / 2, 3, h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  drawActionCue(ctx, screenX + 14, rimY - 10, 'up')
}

/** puddle: an irregular reflective blob, ground-level, hard near edge — never a vertical mass. */
function drawPuddle(ctx: CanvasRenderingContext2D, screenX: number) {
  const y = GROUND_Y - 4
  ctx.beginPath()
  ctx.moveTo(screenX, y)
  ctx.bezierCurveTo(screenX + 6, y - 6, screenX + 40, y - 7, screenX + 50, y - 1)
  ctx.bezierCurveTo(screenX + 58, y + 3, screenX + 44, y + 6, screenX + 26, y + 6)
  ctx.bezierCurveTo(screenX + 10, y + 6, screenX - 2, y + 3, screenX, y)
  ctx.closePath()
  // A top-to-bottom gradient instead of a flat tint, for a wet-asphalt depth read.
  const waterGradient = ctx.createLinearGradient(0, y - 7, 0, y + 6)
  waterGradient.addColorStop(0, '#5b7480')
  waterGradient.addColorStop(1, '#33454e')
  ctx.fillStyle = waterGradient
  ctx.globalAlpha = 0.6
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.lineWidth = HAZARD_OUTLINE_PX
  ctx.strokeStyle = PALETTE.ink
  ctx.stroke()
  // Two reflection streaks (was one) — drawn inside the near edge so they can
  // never soften it (§11) — for a proper wet-sheen read instead of one flat smear.
  for (const [dx, w] of [[20, 12], [38, 5]] as const) {
    ctx.beginPath()
    ctx.ellipse(screenX + dx, y - 1, w, 2, -0.1, 0, Math.PI * 2)
    ctx.fillStyle = '#cfe6ee'
    ctx.globalAlpha = 0.5
    ctx.fill()
  }
  ctx.globalAlpha = 1
  drawActionCue(ctx, screenX + 28, y - 18, 'up')
}

/** bicycle: a real side-on frame — wheels are undecorated scenery; only the handlebar/seat band above the duck line carries the hazard outline. */
function drawBicycle(ctx: CanvasRenderingContext2D, screenX: number) {
  const wheelY = GROUND_Y - 9
  const steel = '#5b7a8c'
  const steelDark = '#3f5866'
  const tire = '#2f3d45'
  const rim = '#a9bec6'

  // Wheels: scenery — filled tire + rim ring + a few spokes, no outline, so
  // the world grammar itself still says "harmless"; a solid disc instead of
  // a bare stroke circle so it reads as an actual wheel, not a wireframe.
  for (const dx of [9, 33]) {
    const cx = screenX + dx
    ctx.beginPath()
    ctx.arc(cx, wheelY, 9, 0, Math.PI * 2)
    ctx.fillStyle = tire
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, wheelY, 6, 0, Math.PI * 2)
    ctx.strokeStyle = rim
    ctx.lineWidth = 1.25
    ctx.stroke()
    ctx.strokeStyle = rim
    ctx.lineWidth = 1
    for (const angle of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
      ctx.beginPath()
      ctx.moveTo(cx - Math.cos(angle) * 5, wheelY - Math.sin(angle) * 5)
      ctx.lineTo(cx + Math.cos(angle) * 5, wheelY + Math.sin(angle) * 5)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(cx, wheelY, 1.6, 0, Math.PI * 2)
    ctx.fillStyle = rim
    ctx.fill()
  }

  // Frame: two triangles between the axles and the seat/handlebar posts —
  // scenery. Rounded, thicker strokes plus a thin darker edge line give the
  // tubing a solid, tapered read instead of a flat single-width line.
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = steel
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(screenX + 9, wheelY)
  ctx.lineTo(screenX + 21, GROUND_Y - 30)
  ctx.lineTo(screenX + 33, wheelY)
  ctx.lineTo(screenX + 21, wheelY)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(screenX + 21, GROUND_Y - 30)
  ctx.lineTo(screenX + 33, wheelY)
  ctx.stroke()
  ctx.strokeStyle = steelDark
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(screenX + 9, wheelY - 1.5)
  ctx.lineTo(screenX + 21, GROUND_Y - 31.5)
  ctx.stroke()
  // Seat post up to the danger band, with a small saddle.
  ctx.strokeStyle = steel
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(screenX + 21, GROUND_Y - 30)
  ctx.lineTo(screenX + 17, GROUND_Y - 46)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(screenX + 15, GROUND_Y - 48, 4, 2, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = steelDark
  ctx.fill()
  // Handlebar: the one part that actually carries the hazard outline — the
  // overhead projection the duck line is judged against (§11).
  roundRectPath(ctx, screenX + 5, GROUND_Y - 50, 22, 7, 3)
  fillWithOutline(ctx, steel, PALETTE.ink, HAZARD_OUTLINE_PX)
  // The one family in duck's direction, among five in jump's — the cue that
  // actually matters most (§11 follow-up).
  drawActionCue(ctx, screenX + 16, GROUND_Y - 64, 'down')
}

/** trashBin: a can with a domed lid — the lid's flat top is what a jump clears; the body reads as "bin", not "pot" or "fence". */
function drawTrashBin(ctx: CanvasRenderingContext2D, screenX: number) {
  const lidY = GROUND_Y - 40
  // Body: a slightly tapered can.
  ctx.beginPath()
  ctx.moveTo(screenX + 2, lidY + 8)
  ctx.lineTo(screenX + 28, lidY + 8)
  ctx.lineTo(screenX + 25, GROUND_Y)
  ctx.lineTo(screenX + 5, GROUND_Y)
  ctx.closePath()
  fillWithOutline(ctx, '#4f7d52', PALETTE.ink, HAZARD_OUTLINE_PX)
  // Ribbing detail — cosmetic only, never a second outline.
  ctx.strokeStyle = '#3d6140'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(screenX + 15, lidY + 10)
  ctx.lineTo(screenX + 14, GROUND_Y - 2)
  ctx.stroke()
  // Lid: domed, slightly wider than the body — the flat-topped silhouette a jump clears.
  roundRectPath(ctx, screenX - 2, lidY, 34, 9, 3)
  fillWithOutline(ctx, '#c2603f', PALETTE.ink, HAZARD_OUTLINE_PX)
  ctx.beginPath()
  ctx.arc(screenX + 15, lidY, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#c2603f'
  ctx.fill()
  drawActionCue(ctx, screenX + 15, lidY - 12, 'up')
}

/** pothole: a jagged broken-asphalt hole, ground-level, high-contrast rim — never covered by a foreground layer (§11). */
function drawPothole(ctx: CanvasRenderingContext2D, screenX: number) {
  const y = GROUND_Y - 2
  const cx = screenX + 20
  const points: readonly [number, number][] = [
    [-22, -1], [-14, -6], [-2, -3], [10, -7], [20, -2], [22, 3], [12, 6], [-4, 5], [-16, 6],
  ]
  ctx.beginPath()
  ctx.moveTo(cx + points[0][0], y + points[0][1])
  for (const [dx, dy] of points.slice(1)) ctx.lineTo(cx + dx, y + dy)
  ctx.closePath()
  // A radial gradient instead of a flat fill, so the hole reads as a
  // depression rather than a black sticker on the road.
  const holeGradient = ctx.createRadialGradient(cx, y, 2, cx, y, 22)
  holeGradient.addColorStop(0, '#181008')
  holeGradient.addColorStop(1, PALETTE.ink)
  ctx.fillStyle = holeGradient
  ctx.fill()
  ctx.lineWidth = HAZARD_OUTLINE_PX
  ctx.strokeStyle = '#e9e2d4'
  ctx.stroke()
  // A crack reaching toward the near edge, reinforcing "broken ground" at a glance.
  ctx.beginPath()
  ctx.moveTo(cx - 6, y + 4)
  ctx.lineTo(cx - 16, y + 12)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = PALETTE.ink
  ctx.stroke()
  drawActionCue(ctx, cx, y - 14, 'up')
}

export function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle, screenX: number) {
  switch (obstacle.family) {
    case 'lowFence':
      return drawLowFence(ctx, screenX)
    case 'planter':
      return drawPlanter(ctx, screenX)
    case 'puddle':
      return drawPuddle(ctx, screenX)
    case 'bicycle':
      return drawBicycle(ctx, screenX)
    case 'trashBin':
      return drawTrashBin(ctx, screenX)
    case 'pothole':
      return drawPothole(ctx, screenX)
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
