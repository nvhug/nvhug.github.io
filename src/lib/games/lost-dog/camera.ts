/**
 * The camera (spec 015 §18) as a pure projection: elapsed time and the
 * remaining shake budget in, a scale and a pixel offset out.
 *
 * It is deliberately *not* part of the simulation. No world position, no
 * collision box and no reaction window is computed from anything here — the
 * renderer applies the transform after the world is already decided, so a
 * camera change can never alter what the player had to react to. It also
 * carries no state between frames, so reduced motion can turn it off without
 * any risk of desynchronising a run (SC-009).
 */

import { TUNING, bandForElapsed, bandIndexForElapsed } from './config'

export interface CameraInput {
  readonly elapsedActiveMs: number
  /** ms of collision shake still owed; run.ts counts it down. */
  readonly shakeMs: number
}

export interface CameraTransform {
  /** <1 shows more world than the base framing; it is never >1 (FR-021). */
  readonly scale: number
  readonly offsetX: number
  readonly offsetY: number
}

/** Widen for a given band speed: 0 at 1.0x, the full budget at the 1.65x cap. */
function widenForSpeed(speed: number): number {
  const t = Math.min(1, Math.max(0, (speed - 1.0) / (1.65 - 1.0)))
  return TUNING.camera.maxWidenFraction * t
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/**
 * How much extra world the framing shows right now. Under reduced motion it is
 * pinned at the widest for the entire run, so look-ahead is constant and can
 * never shrink (DESIGN § Motion).
 */
export function widenFractionFor(elapsedActiveMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return TUNING.camera.maxWidenFraction

  const band = bandForElapsed(elapsedActiveMs)
  const index = bandIndexForElapsed(elapsedActiveMs)
  const target = widenForSpeed(band.speed)
  const previous = index > 0 ? widenForSpeed(TUNING.bands[index - 1].speed) : target
  // Eased across the band boundary rather than snapped; derived from elapsed
  // time alone, so it needs no per-frame state and stays deterministic.
  const t = Math.min(1, (elapsedActiveMs - band.fromMs) / TUNING.camera.widenEaseMinMs)
  return previous + (target - previous) * easeInOut(t)
}

export function cameraFor(view: CameraInput, reducedMotion: boolean): CameraTransform {
  const widen = widenFractionFor(view.elapsedActiveMs, reducedMotion)
  const scale = 1 / (1 + widen)

  if (reducedMotion || view.shakeMs <= 0) return { scale, offsetX: 0, offsetY: 0 }

  const { shakeMaxMs, shakeMaxPx } = TUNING.camera
  // Amplitude decays linearly with the remaining budget; the oscillation is a
  // function of that same budget, so two frames with the same state shake the
  // same way and no RNG stream is touched.
  const amplitude = shakeMaxPx * Math.min(1, view.shakeMs / shakeMaxMs)
  const phase = (shakeMaxMs - view.shakeMs) / shakeMaxMs
  return {
    scale,
    offsetX: amplitude * Math.sin(phase * Math.PI * 6),
    offsetY: amplitude * Math.sin(phase * Math.PI * 4) * 0.5,
  }
}
