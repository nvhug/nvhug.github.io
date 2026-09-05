/**
 * Seeded randomness shared by every game. Nothing here touches Math.random —
 * a game that needs "the same result for the same seed on every device"
 * builds on these primitives (spec 013 FR-009, spec 015 §13).
 *
 * Each game owns its own version constant (e.g. block-puzzle's
 * GENERATOR_VERSION, lost-dog's GAMEPLAY_VERSION) and folds it into the seed
 * itself via seedFor/deriveSeed — this module has no opinion on what a
 * "version" means for a given game.
 */

export type Rng = () => number

/** Integer hash of (input, version) — one seed per input per version. */
export function seedFor(input: number, version: number): number {
  let h = Math.imul(version, 0x9e3779b1) ^ Math.imul(input + 1, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  return (h ^ (h >>> 15)) >>> 0
}

/**
 * Derives an independent seed for a named stream off one root seed — e.g. a
 * run's gameplay stream and its cosmetic stream must never share state, or a
 * renderer/audio decision could perturb a gameplay outcome (spec 015 §13,
 * plan R6). The stream id is hashed the same way a numeric input is.
 */
export function deriveSeed(rootSeed: number, streamId: string): number {
  let strHash = 0
  for (let i = 0; i < streamId.length; i++) {
    strHash = Math.imul(strHash ^ streamId.charCodeAt(i), 0x01000193) >>> 0
  }
  return seedFor(rootSeed ^ strHash, strHash)
}

/** mulberry32 — small, fast, good enough for game logic. Returns values in [0, 1). */
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
