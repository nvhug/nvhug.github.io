import { describe, expect, it } from 'vitest'
import { GAMEPLAY_VERSION, TUNING, bandForElapsed, comboMultiplierFor, pursuitBandFor } from './config'

describe('GAMEPLAY_VERSION', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(GAMEPLAY_VERSION)).toBe(true)
    expect(GAMEPLAY_VERSION).toBeGreaterThan(0)
  })
})

describe('TUNING.jump / TUNING.duck concrete values', () => {
  it('picks one airtime and apex fraction inside the documented acceptance range', () => {
    expect(TUNING.jump.airtimeMs).toBeGreaterThanOrEqual(TUNING.jump.minAirtimeMs)
    expect(TUNING.jump.airtimeMs).toBeLessThanOrEqual(TUNING.jump.maxAirtimeMs)
    expect(TUNING.jump.apexFraction).toBeGreaterThanOrEqual(TUNING.jump.apexMinFraction)
    expect(TUNING.jump.apexFraction).toBeLessThanOrEqual(TUNING.jump.apexMaxFraction)
  })

  it('picks one duck transition duration inside the documented range', () => {
    expect(TUNING.duck.transitionMs).toBeGreaterThanOrEqual(TUNING.duck.minTransitionMs)
    expect(TUNING.duck.transitionMs).toBeLessThanOrEqual(TUNING.duck.maxTransitionMs)
  })

  it('picks one hit-reaction lock duration inside the documented range', () => {
    expect(TUNING.hit.reactionLockMs).toBeGreaterThanOrEqual(TUNING.hit.reactionLockMinMs)
    expect(TUNING.hit.reactionLockMs).toBeLessThanOrEqual(TUNING.hit.reactionLockMaxMs)
  })
})

describe('TUNING.bands', () => {
  it('has exactly six bands covering 0s..Infinity with no gap', () => {
    expect(TUNING.bands).toHaveLength(6)
    expect(TUNING.bands[0].fromMs).toBe(0)
    for (let i = 1; i < TUNING.bands.length; i++) {
      expect(TUNING.bands[i].fromMs).toBe(TUNING.bands[i - 1].toMs)
    }
    expect(TUNING.bands[TUNING.bands.length - 1].toMs).toBe(Infinity)
  })

  it('has non-decreasing speed and density, capped at 1.65x / 4.0', () => {
    for (let i = 1; i < TUNING.bands.length; i++) {
      expect(TUNING.bands[i].speed).toBeGreaterThanOrEqual(TUNING.bands[i - 1].speed)
      expect(TUNING.bands[i].density).toBeGreaterThanOrEqual(TUNING.bands[i - 1].density)
    }
    expect(Math.max(...TUNING.bands.map((b) => b.speed))).toBe(1.65)
    expect(Math.max(...TUNING.bands.map((b) => b.density))).toBe(4.0)
  })

  it('has a non-decreasing combo cap that reaches the x5 ceiling', () => {
    for (let i = 1; i < TUNING.bands.length; i++) {
      expect(TUNING.bands[i].comboCap).toBeGreaterThanOrEqual(TUNING.bands[i - 1].comboCap)
    }
    expect(TUNING.bands[TUNING.bands.length - 1].comboCap).toBe(5)
  })
})

describe('TUNING.obstacles', () => {
  it('has exactly the six documented families', () => {
    const families = TUNING.obstacles.map((o) => o.family).sort()
    expect(families).toEqual(
      ['bicycle', 'lowFence', 'planter', 'pothole', 'puddle', 'trashBin'].sort(),
    )
  })
})

describe('TUNING.food', () => {
  it('has exactly three food types summing to 100% rarity', () => {
    expect(TUNING.food).toHaveLength(3)
    const totalRarity = TUNING.food.reduce((sum, f) => sum + f.rarity, 0)
    expect(totalRarity).toBeCloseTo(1, 5)
  })

  it('gives the rarest food the most points', () => {
    const sorted = [...TUNING.food].sort((a, b) => a.rarity - b.rarity)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].basePoints).toBeGreaterThanOrEqual(sorted[i].basePoints)
    }
  })
})

describe('TUNING.pursuit', () => {
  it('starts at 75 out of 0-100', () => {
    expect(TUNING.pursuit.startGap).toBe(75)
  })

  it('a standard collision removes more gap than a puddle slip', () => {
    expect(TUNING.pursuit.hitCosts.standard).toBeGreaterThan(TUNING.pursuit.hitCosts.puddle)
  })
})

describe('TUNING.entityCaps', () => {
  it('matches the spec 015 §24 budget', () => {
    expect(TUNING.entityCaps).toEqual({ obstacles: 12, food: 12, particles: 32 })
  })
})

describe('TUNING.skyBandFraction', () => {
  it('reserves 18% of world height', () => {
    expect(TUNING.skyBandFraction).toBeCloseTo(0.18, 5)
  })
})

describe('bandForElapsed', () => {
  it('returns the first band at 0ms and the last band well past 180s', () => {
    expect(bandForElapsed(0)).toBe(TUNING.bands[0])
    expect(bandForElapsed(500_000)).toBe(TUNING.bands[5])
  })

  it('picks the band whose range contains the elapsed time, at a boundary', () => {
    expect(bandForElapsed(19_999)).toBe(TUNING.bands[0])
    expect(bandForElapsed(20_000)).toBe(TUNING.bands[1])
  })
})

describe('pursuitBandFor', () => {
  it('classifies every documented boundary (§9)', () => {
    expect(pursuitBandFor(100)).toBe('safe')
    expect(pursuitBandFor(76)).toBe('safe')
    expect(pursuitBandFor(75)).toBe('watch')
    expect(pursuitBandFor(51)).toBe('watch')
    expect(pursuitBandFor(50)).toBe('danger')
    expect(pursuitBandFor(26)).toBe('danger')
    expect(pursuitBandFor(25)).toBe('critical')
    expect(pursuitBandFor(1)).toBe('critical')
    expect(pursuitBandFor(0)).toBe('caught')
  })
})

describe('comboMultiplierFor', () => {
  it('classifies every documented threshold (§14)', () => {
    expect(comboMultiplierFor(0)).toBe(1)
    expect(comboMultiplierFor(2)).toBe(1)
    expect(comboMultiplierFor(3)).toBe(2)
    expect(comboMultiplierFor(5)).toBe(2)
    expect(comboMultiplierFor(6)).toBe(3)
    expect(comboMultiplierFor(9)).toBe(3)
    expect(comboMultiplierFor(10)).toBe(4)
    expect(comboMultiplierFor(14)).toBe(4)
    expect(comboMultiplierFor(15)).toBe(5)
    expect(comboMultiplierFor(500)).toBe(5)
  })
})
