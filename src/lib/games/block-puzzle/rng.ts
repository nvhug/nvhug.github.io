/**
 * Seeded randomness for the block puzzle generator.
 *
 * Level N must be the same puzzle for every player on every device (spec 013
 * FR-009), so nothing here touches Math.random. The seed folds in
 * GENERATOR_VERSION: changing the algorithm is a deliberate, visible reset of
 * every puzzle, never a silent one.
 */

export const GENERATOR_VERSION = 1

export type Rng = () => number

/** Integer hash of (version, level) — one seed per level per generator version. */
export function seedFor(level: number, version: number = GENERATOR_VERSION): number {
  let h = Math.imul(version, 0x9e3779b1) ^ Math.imul(level + 1, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  return (h ^ (h >>> 15)) >>> 0
}

/** mulberry32 — small, fast, good enough for puzzle layout. Returns values in [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform integer in [min, max], both inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** Seeded Fisher–Yates; returns a new array, input untouched. */
export function shuffle<T>(rng: Rng, input: readonly T[]): T[] {
  const out = [...input]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
