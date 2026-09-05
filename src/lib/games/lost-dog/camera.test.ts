import { describe, expect, it } from 'vitest'
import { TUNING } from './config'
import { cameraFor, widenFractionFor } from './camera'

const MOTION = false
const REDUCED = true

describe('widenFractionFor (§18 — the camera only ever adds look-ahead)', () => {
  it('is 0 at the start of the run and never exceeds 8%', () => {
    expect(widenFractionFor(0, MOTION)).toBe(0)
    for (let ms = 0; ms <= 400_000; ms += 250) {
      const widen = widenFractionFor(ms, MOTION)
      expect(widen).toBeGreaterThanOrEqual(0)
      expect(widen).toBeLessThanOrEqual(TUNING.camera.maxWidenFraction)
    }
  })

  it('never shrinks the visible world as the run gets faster (FR-021)', () => {
    let previous = -1
    for (let ms = 0; ms <= 400_000; ms += 250) {
      const widen = widenFractionFor(ms, MOTION)
      expect(widen).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = widen
    }
  })

  it('takes at least the documented ease time to reach a new band', () => {
    const boundary = TUNING.bands[1].fromMs
    const atBoundary = widenFractionFor(boundary, MOTION)
    const midEase = widenFractionFor(boundary + TUNING.camera.widenEaseMinMs / 2, MOTION)
    const eased = widenFractionFor(boundary + TUNING.camera.widenEaseMinMs, MOTION)
    const later = widenFractionFor(boundary + TUNING.camera.widenEaseMinMs + 5_000, MOTION)

    expect(atBoundary).toBeLessThan(eased)
    expect(midEase).toBeGreaterThan(atBoundary)
    expect(midEase).toBeLessThan(eased)
    // Once eased, it holds until the next boundary rather than drifting.
    expect(later).toBeCloseTo(eased, 10)
  })

  it('is pinned at its widest for the whole run under reduced motion (DESIGN § Motion)', () => {
    for (const ms of [0, 1_000, 60_000, 400_000]) {
      expect(widenFractionFor(ms, REDUCED)).toBe(TUNING.camera.maxWidenFraction)
    }
  })
})

describe('cameraFor', () => {
  it('reports a scale that shows more world, never less', () => {
    expect(cameraFor({ elapsedActiveMs: 0, shakeMs: 0 }, MOTION).scale).toBe(1)
    expect(cameraFor({ elapsedActiveMs: 300_000, shakeMs: 0 }, MOTION).scale).toBeLessThan(1)
  })

  it('shakes at most the documented pixel budget, and decays to nothing', () => {
    const { shakeMaxMs, shakeMaxPx } = TUNING.camera
    for (let ms = shakeMaxMs; ms >= 0; ms -= 5) {
      const cam = cameraFor({ elapsedActiveMs: 50_000, shakeMs: ms }, MOTION)
      expect(Math.abs(cam.offsetX)).toBeLessThanOrEqual(shakeMaxPx)
      expect(Math.abs(cam.offsetY)).toBeLessThanOrEqual(shakeMaxPx)
    }
    const settled = cameraFor({ elapsedActiveMs: 50_000, shakeMs: 0 }, MOTION)
    expect(settled.offsetX).toBe(0)
    expect(settled.offsetY).toBe(0)
  })

  it('disables shake entirely under reduced motion (§18)', () => {
    const cam = cameraFor({ elapsedActiveMs: 50_000, shakeMs: TUNING.camera.shakeMaxMs }, REDUCED)
    expect(cam.offsetX).toBe(0)
    expect(cam.offsetY).toBe(0)
  })

  it('is a pure projection: it returns only a scale and an offset, and reads no world entity', () => {
    const cam = cameraFor({ elapsedActiveMs: 120_000, shakeMs: 40 }, MOTION)
    expect(Object.keys(cam).sort()).toEqual(['offsetX', 'offsetY', 'scale'])
    // Same input, same output — nothing here carries state between frames.
    expect(cameraFor({ elapsedActiveMs: 120_000, shakeMs: 40 }, MOTION)).toEqual(cam)
  })
})
