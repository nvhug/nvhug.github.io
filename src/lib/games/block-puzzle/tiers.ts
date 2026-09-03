/**
 * The campaign's difficulty curve: five tiers of twenty levels (spec 013
 * FR-008, FR-011). Everything about "how hard is level N" lives in this table so
 * tuning after real play is one edit with the tests still green.
 *
 * Par time (FR-013) is a function of the tier and the piece count, never of a
 * player, so stars can be derived from a stored best time and are never stored.
 */

import { parseLevelKey } from '../level-key'

export const CAMPAIGN_LEVELS = 100

export interface Tier {
  index: 1 | 2 | 3 | 4 | 5
  i18nKey: string
  /** First and last level of the tier, inclusive. */
  levels: readonly [number, number]
  /** Grid size at the start and end of the tier; interpolated in between. */
  grid: readonly [number, number]
  /** Loose (player-placed) piece count at the start and end of the tier. */
  loose: readonly [number, number]
  /** Pre-seated pieces the player cannot move. */
  fixed: number
  /** Min and max cells per piece. */
  sizes: readonly [number, number]
  parBaseMs: number
  parPerPieceMs: number
}

export const TIERS: readonly Tier[] = [
  { index: 1, i18nKey: 'games.blockPuzzle.tiers.t1', levels: [1, 20], grid: [5, 5], loose: [3, 4], fixed: 1, sizes: [3, 4], parBaseMs: 25_000, parPerPieceMs: 5_000 },
  { index: 2, i18nKey: 'games.blockPuzzle.tiers.t2', levels: [21, 40], grid: [6, 6], loose: [5, 5], fixed: 1, sizes: [3, 5], parBaseMs: 30_000, parPerPieceMs: 6_000 },
  { index: 3, i18nKey: 'games.blockPuzzle.tiers.t3', levels: [41, 60], grid: [6, 7], loose: [6, 6], fixed: 1, sizes: [4, 5], parBaseMs: 35_000, parPerPieceMs: 7_000 },
  { index: 4, i18nKey: 'games.blockPuzzle.tiers.t4', levels: [61, 80], grid: [7, 7], loose: [7, 8], fixed: 1, sizes: [4, 5], parBaseMs: 40_000, parPerPieceMs: 8_000 },
  { index: 5, i18nKey: 'games.blockPuzzle.tiers.t5', levels: [81, 100], grid: [8, 8], loose: [9, 10], fixed: 0, sizes: [4, 5], parBaseMs: 45_000, parPerPieceMs: 9_000 },
]

export function tierOf(level: number): Tier {
  const tier = TIERS.find((t) => level >= t.levels[0] && level <= t.levels[1])
  if (!tier) throw new RangeError(`level ${level} is outside the campaign (1..${CAMPAIGN_LEVELS})`)
  return tier
}

/**
 * Step from `from` to `to` across the tier: the tier's levels are split into
 * equal bands, one per value. [9, 10] over twenty levels → ten at 9, ten at 10.
 */
function stepAcrossTier(tier: Tier, level: number, [from, to]: readonly [number, number]): number {
  const span = tier.levels[1] - tier.levels[0] + 1
  const offset = level - tier.levels[0]
  const steps = to - from + 1
  return from + Math.min(steps - 1, Math.floor((offset * steps) / span))
}

export function looseCountFor(level: number): number {
  const tier = tierOf(level)
  return stepAcrossTier(tier, level, tier.loose)
}

export function gridFor(level: number): number {
  const tier = tierOf(level)
  return stepAcrossTier(tier, level, tier.grid)
}

export function parTimeMs(level: number, pieceCount: number): number {
  const tier = tierOf(level)
  return tier.parBaseMs + tier.parPerPieceMs * pieceCount
}

/** Par for a level from the table alone — no generation needed (used by the hub and map). */
export function parMsForLevel(level: number): number {
  const tier = tierOf(level)
  return parTimeMs(level, looseCountFor(level) + tier.fixed)
}

/**
 * Reads the `[level]` route segment: `parseLevelKey` bounded by the campaign, so
 * '07', '7.5', '1e2' and '101' all fall through to the level map
 * (contracts/routing.md § Level URL rules).
 */
export function parseLevelParam(param: string | string[] | undefined): number | null {
  return parseLevelKey(param, CAMPAIGN_LEVELS)
}
