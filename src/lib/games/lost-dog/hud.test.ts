import { describe, expect, it } from 'vitest'
import { healthBarColor } from './hud'

describe('healthBarColor', () => {
  it('is exactly --games-mint at gap 100 (full/safe)', () => {
    expect(healthBarColor(100)).toBe('rgb(125 211 164)')
  })

  it('is exactly --games-ember at gap 0 (empty/danger)', () => {
    expect(healthBarColor(0)).toBe('rgb(224 108 91)')
  })

  it('is exactly --games-brass at gap 50 — the midpoint is a real third colour, not a red/green average', () => {
    expect(healthBarColor(50)).toBe('rgb(217 164 65)')
  })

  it('is continuous across the gap-50 seam between the two half-gradients', () => {
    expect(healthBarColor(49.99)).not.toBe(healthBarColor(0))
    expect(healthBarColor(50.01)).not.toBe(healthBarColor(100))
  })

  it('clamps above 100 to the safe colour', () => {
    expect(healthBarColor(150)).toBe(healthBarColor(100))
  })

  it('clamps below 0 to the danger colour', () => {
    expect(healthBarColor(-20)).toBe(healthBarColor(0))
  })
})
