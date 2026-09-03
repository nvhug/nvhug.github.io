import { describe, expect, it } from 'vitest'
import { GENERATOR_VERSION, createRng, randInt, seedFor, shuffle } from './rng'

describe('createRng', () => {
  it('yields the same sequence for the same seed', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('yields a different sequence for a different seed', () => {
    const a = createRng(1)
    const b = createRng(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('stays inside [0, 1)', () => {
    const rng = createRng(99)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('seedFor', () => {
  it('gives every level its own seed', () => {
    const seeds = new Set(Array.from({ length: 100 }, (_, i) => seedFor(i + 1)))
    expect(seeds.size).toBe(100)
  })

  it('folds the generator version into the seed', () => {
    // Bumping GENERATOR_VERSION is a deliberate reset of every puzzle; the seed
    // must change with it so the change is visible, never silent.
    expect(GENERATOR_VERSION).toBe(1)
    expect(seedFor(7)).not.toBe(seedFor(7, GENERATOR_VERSION + 1))
  })
})

describe('randInt', () => {
  it('is inclusive at both ends and never leaves the range', () => {
    const rng = createRng(3)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const v = randInt(rng, 2, 5)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThanOrEqual(5)
      seen.add(v)
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5])
  })
})

describe('shuffle', () => {
  it('returns a seeded permutation and leaves the input untouched', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f']
    const out = shuffle(createRng(5), input)
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect([...out].sort()).toEqual(input)
    expect(shuffle(createRng(5), input)).toEqual(out)
  })
})
