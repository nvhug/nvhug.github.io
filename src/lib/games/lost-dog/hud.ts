/**
 * Pure presentation helpers for the HUD (docs/DESIGN.md § Signature element —
 * the chase strip). Kept out of `ChaseStrip.tsx` so the colour math is
 * unit-testable independent of the DOM.
 */

interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

/** `--games-ember` (empty/danger, gap 0). */
const DANGER: Rgb = { r: 0xe0, g: 0x6c, b: 0x5b }
/** `--games-brass` (half, gap 50) — a straight red-to-green blend passes through a muddy brown at the midpoint, so this middle stop is a real third colour, not an average. */
const WARNING: Rgb = { r: 0xd9, g: 0xa4, b: 0x41 }
/** `--games-mint` (full/safe, gap 100). */
const SAFE: Rgb = { r: 0x7d, g: 0xd3, b: 0xa4 }

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

/**
 * The chase-strip health-bar fill colour: danger -> warning -> safe as the
 * pursuit gap rises from 0 to 100. The bar's *fill width* is what actually
 * carries the reading (docs/DESIGN.md § Signature element still holds:
 * never colour alone) — this colour is reinforcement, the same role the
 * lit/unlit pawprint colour used to play.
 */
export function healthBarColor(gapPercent: number): string {
  const clamped = Math.max(0, Math.min(100, gapPercent))
  const [from, to, localT] = clamped <= 50 ? [DANGER, WARNING, clamped / 50] : [WARNING, SAFE, (clamped - 50) / 50]
  const r = lerp(from.r, to.r, localT)
  const g = lerp(from.g, to.g, localT)
  const b = lerp(from.b, to.b, localT)
  return `rgb(${r} ${g} ${b})`
}
