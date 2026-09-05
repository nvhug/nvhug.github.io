import { describe, expect, it } from 'vitest'
import { TUNING } from './config'
import { createRng } from '../rng'
import {
  foodRefusalIsSafe,
  generateCandidate,
  pickValidPattern,
  reactionBudgetSecFor,
  validatePattern,
} from './spawner'
import { applyComboReset, collectFood, initialCombo } from './combo'

describe('reactionBudgetSecFor', () => {
  it('is 0.85s at base speed and 0.70s at the 1.65x cap, per §12', () => {
    expect(reactionBudgetSecFor(TUNING.bands[0])).toBeCloseTo(0.85, 5)
    expect(reactionBudgetSecFor(TUNING.bands[5])).toBeCloseTo(0.7, 5)
  })

  it('never falls below 0.70s for any band', () => {
    for (const band of TUNING.bands) {
      expect(reactionBudgetSecFor(band)).toBeGreaterThanOrEqual(0.7)
    }
  })

  it('interpolates monotonically down as speed increases', () => {
    let prev = Infinity
    for (const band of TUNING.bands) {
      const budget = reactionBudgetSecFor(band)
      expect(budget).toBeLessThanOrEqual(prev + 1e-9)
      prev = budget
    }
  })
})

describe('validatePattern', () => {
  const band = TUNING.bands[0]

  it('accepts a single obstacle with enough lead time', () => {
    const pattern = {
      obstacles: [{ kind: 'obstacle' as const, family: 'lowFence' as const, action: 'jump' as const }],
      food: null,
      leadSec: reactionBudgetSecFor(band),
      gapSec: 0,
      foodHasSafeRefusal: true,
    }
    expect(validatePattern(pattern, band)).toBe(true)
  })

  it('rejects insufficient lead time (reaction budget violation)', () => {
    const pattern = {
      obstacles: [{ kind: 'obstacle' as const, family: 'lowFence' as const, action: 'jump' as const }],
      food: null,
      leadSec: reactionBudgetSecFor(band) - 0.01,
      gapSec: 0,
      foodHasSafeRefusal: true,
    }
    expect(validatePattern(pattern, band)).toBe(false)
  })

  it('rejects two obstacles requiring different actions with too little gap', () => {
    const pattern = {
      obstacles: [
        { kind: 'obstacle' as const, family: 'lowFence' as const, action: 'jump' as const },
        { kind: 'obstacle' as const, family: 'bicycle' as const, action: 'duck' as const },
      ],
      food: null,
      leadSec: reactionBudgetSecFor(band),
      gapSec: TUNING.reactionBudget.postActionNeutralSec - 0.01,
      foodHasSafeRefusal: true,
    }
    expect(validatePattern(pattern, band)).toBe(false)
  })

  it('accepts two obstacles with different actions once the gap meets the neutral-time floor', () => {
    const pattern = {
      obstacles: [
        { kind: 'obstacle' as const, family: 'lowFence' as const, action: 'jump' as const },
        { kind: 'obstacle' as const, family: 'bicycle' as const, action: 'duck' as const },
      ],
      food: null,
      leadSec: reactionBudgetSecFor(band),
      gapSec: TUNING.reactionBudget.postActionNeutralSec,
      foodHasSafeRefusal: true,
    }
    expect(validatePattern(pattern, band)).toBe(true)
  })

  it('never accepts a literally-simultaneous jump+duck pair (gap 0)', () => {
    const pattern = {
      obstacles: [
        { kind: 'obstacle' as const, family: 'lowFence' as const, action: 'jump' as const },
        { kind: 'obstacle' as const, family: 'bicycle' as const, action: 'duck' as const },
      ],
      food: null,
      leadSec: reactionBudgetSecFor(band),
      gapSec: 0,
      foodHasSafeRefusal: true,
    }
    expect(validatePattern(pattern, band)).toBe(false)
  })

  it('allows two obstacles requiring the SAME action back-to-back without the neutral-time gap', () => {
    const pattern = {
      obstacles: [
        { kind: 'obstacle' as const, family: 'lowFence' as const, action: 'jump' as const },
        { kind: 'obstacle' as const, family: 'planter' as const, action: 'jump' as const },
      ],
      food: null,
      leadSec: reactionBudgetSecFor(band),
      gapSec: 0.05,
      foodHasSafeRefusal: true,
    }
    expect(validatePattern(pattern, band)).toBe(true)
  })

  it('rejects food that makes damage mandatory to collect', () => {
    const pattern = {
      obstacles: [],
      food: { kind: 'food' as const, foodKind: 'bone' as const, placement: 'nearHazard' as const, offsetSec: 0 },
      leadSec: reactionBudgetSecFor(band),
      gapSec: 0,
      foodHasSafeRefusal: false,
    }
    expect(validatePattern(pattern, band)).toBe(false)
  })
})

describe('foodRefusalIsSafe (§12 — food never makes damage mandatory)', () => {
  const neutral = TUNING.reactionBudget.postActionNeutralSec
  const fence = { kind: 'obstacle' as const, family: 'lowFence' as const, action: 'jump' as const }

  it('treats food with no obstacle in the pattern as trivially refusable', () => {
    const food = { kind: 'food' as const, foodKind: 'bone' as const, placement: 'safeLine' as const, offsetSec: 0 }
    expect(foodRefusalIsSafe(food, [])).toBe(true)
  })

  it('refuses food sitting inside the hazard action window', () => {
    const food = {
      kind: 'food' as const,
      foodKind: 'sausage' as const,
      placement: 'nearHazard' as const,
      offsetSec: neutral - 0.01,
    }
    expect(foodRefusalIsSafe(food, [fence])).toBe(false)
  })

  it('accepts food just outside the hazard action window (the authored risky placement)', () => {
    const food = {
      kind: 'food' as const,
      foodKind: 'chickenLeg' as const,
      placement: 'nearHazard' as const,
      offsetSec: neutral,
    }
    expect(foodRefusalIsSafe(food, [fence])).toBe(true)
  })
})

describe('pickValidPattern — the property sweep (SC-002, SC-016, plan R7)', () => {
  it('every accepted pattern across 10,000 seeds x 6 bands satisfies validatePattern, with a low fallback rate', () => {
    const SEEDS = 10_000
    let fallbackCount = 0
    let total = 0

    for (const band of TUNING.bands) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const rng = createRng(seed * 7919 + 13)
        const { pattern, usedFallback } = pickValidPattern(rng, band)
        total++
        if (usedFallback) fallbackCount++
        expect(validatePattern(pattern, band)).toBe(true)
      }
    }

    expect(fallbackCount / total).toBeLessThan(0.1)
  })

  it('the deterministic fallback itself is always a valid, safe pattern', () => {
    // Force fallback by handing it an rng that always produces the worst-case candidate.
    const alwaysZero = () => 0
    for (const band of TUNING.bands) {
      const { pattern } = pickValidPattern(alwaysZero, band, /* maxAttempts */ 0)
      expect(validatePattern(pattern, band)).toBe(true)
    }
  })
})

describe('generateCandidate — determinism', () => {
  it('produces the same candidate for the same rng state', () => {
    const a = generateCandidate(createRng(123), TUNING.bands[2])
    const b = generateCandidate(createRng(123), TUNING.bands[2])
    expect(a).toEqual(b)
  })
})

describe('the food-bearing pattern library (US2)', () => {
  it('produces both authored food placements, and every accepted one is refusable', () => {
    const seen = new Set<string>()
    for (const band of TUNING.bands) {
      for (let seed = 0; seed < 2000; seed++) {
        const { pattern } = pickValidPattern(createRng(seed * 104_729 + 7), band)
        if (!pattern.food) continue
        seen.add(pattern.food.placement)
        expect(pattern.foodHasSafeRefusal).toBe(true)
        expect(foodRefusalIsSafe(pattern.food, pattern.obstacles)).toBe(true)
      }
    }
    expect(seen).toEqual(new Set(['safeLine', 'nearHazard']))
  })

  it('produces food-only patterns as well as obstacle-bearing ones', () => {
    let foodOnly = 0
    for (let seed = 0; seed < 2000; seed++) {
      const { pattern } = pickValidPattern(createRng(seed * 31 + 5), TUNING.bands[3])
      if (pattern.obstacles.length === 0 && pattern.food) foodOnly++
    }
    expect(foodOnly).toBeGreaterThan(0)
  })

  it('every candidate declares a refusal flag consistent with its own placement', () => {
    for (const band of TUNING.bands) {
      for (let seed = 0; seed < 1000; seed++) {
        const candidate = generateCandidate(createRng(seed * 8191 + 3), band)
        expect(candidate.foodHasSafeRefusal).toBe(foodRefusalIsSafe(candidate.food, candidate.obstacles))
      }
    }
  })

  it('food never restores the pursuit gap — combo.ts and pursuit.ts do not cross-call (§14)', () => {
    const slice = { ...initialCombo(), pursuitGap: 33, msSinceLastHit: 5_000 }
    expect(collectFood(slice, 'chickenLeg').pursuitGap).toBe(33)
    expect(collectFood(slice, 'chickenLeg').msSinceLastHit).toBe(5_000)
    expect(applyComboReset(slice).pursuitGap).toBe(33)
  })
})
