import { describe, expect, it } from 'vitest'
import { CAMPAIGN_LEVELS, TIERS, gridFor, looseCountFor, parTimeMs, parseLevelParam, tierOf } from './tiers'

describe('TIERS', () => {
  it('has five tiers covering levels 1..100 with no gaps or overlaps', () => {
    expect(TIERS).toHaveLength(5)
    expect(CAMPAIGN_LEVELS).toBe(100)
    let expectedFrom = 1
    for (const tier of TIERS) {
      expect(tier.levels[0]).toBe(expectedFrom)
      expect(tier.levels[1]).toBeGreaterThanOrEqual(tier.levels[0])
      expectedFrom = tier.levels[1] + 1
    }
    expect(expectedFrom - 1).toBe(CAMPAIGN_LEVELS)
  })

  it('names each tier through an i18n key', () => {
    for (const [i, tier] of TIERS.entries()) {
      expect(tier.i18nKey).toBe(`games.blockPuzzle.tiers.t${i + 1}`)
    }
  })
})

describe('tierOf', () => {
  it('resolves the boundaries', () => {
    expect(tierOf(1).index).toBe(1)
    expect(tierOf(20).index).toBe(1)
    expect(tierOf(21).index).toBe(2)
    expect(tierOf(100).index).toBe(5)
  })

  it('rejects levels outside the campaign', () => {
    expect(() => tierOf(0)).toThrow()
    expect(() => tierOf(101)).toThrow()
  })
})

describe('looseCountFor', () => {
  it('never decreases across the campaign', () => {
    for (let level = 2; level <= CAMPAIGN_LEVELS; level++) {
      expect(looseCountFor(level)).toBeGreaterThanOrEqual(looseCountFor(level - 1))
    }
  })

  it('starts small and reaches a fixed ceiling in the last tier', () => {
    expect(looseCountFor(1)).toBe(3)
    expect(looseCountFor(CAMPAIGN_LEVELS)).toBe(10)
    // The ceiling is a plateau, not a single peak: the last several levels share it.
    expect(looseCountFor(CAMPAIGN_LEVELS - 1)).toBe(looseCountFor(CAMPAIGN_LEVELS))
  })
})

describe('gridFor', () => {
  it('grows from 5×5 to 8×8 and never shrinks', () => {
    expect(gridFor(1)).toBe(5)
    expect(gridFor(CAMPAIGN_LEVELS)).toBe(8)
    for (let level = 2; level <= CAMPAIGN_LEVELS; level++) {
      expect(gridFor(level)).toBeGreaterThanOrEqual(gridFor(level - 1))
    }
  })

  it('always holds the largest cavity the tier can produce', () => {
    for (const tier of TIERS) {
      const cells = gridFor(tier.levels[1]) ** 2
      const maxCavity = (looseCountFor(tier.levels[1]) + tier.fixed) * tier.sizes[1]
      expect(cells).toBeGreaterThan(maxCavity)
    }
  })
})

describe('parTimeMs', () => {
  it('is positive and grows with the piece count inside a tier', () => {
    expect(parTimeMs(1, 3)).toBeGreaterThan(0)
    expect(parTimeMs(1, 4)).toBeGreaterThan(parTimeMs(1, 3))
  })

  it('grows across tiers for the same piece count', () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(parTimeMs(TIERS[i].levels[0], 6)).toBeGreaterThan(parTimeMs(TIERS[i - 1].levels[0], 6))
    }
  })
})

describe('parseLevelParam', () => {
  it('accepts the canonical decimal form of a campaign level', () => {
    expect(parseLevelParam('1')).toBe(1)
    expect(parseLevelParam('7')).toBe(7)
    expect(parseLevelParam('100')).toBe(CAMPAIGN_LEVELS)
  })

  it('rejects anything that is not exactly a level number', () => {
    for (const param of ['0', '101', '-3', 'abc', '7.5', '', ' 7', '07', '1e2', undefined]) {
      expect(parseLevelParam(param)).toBeNull()
    }
  })

  it('rejects an array param, which is what a repeated segment produces', () => {
    expect(parseLevelParam(['1', '2'])).toBeNull()
  })
})
