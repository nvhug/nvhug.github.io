/**
 * Food, combo and score (spec 015 §14). Pure and generic over any object
 * carrying at least `ComboSlice`'s fields — the same pattern pursuit.ts and
 * state-machine.ts use, so `Run` satisfies it without a circular import.
 *
 * Nothing here reads or writes the pursuit gap: food is optional reward and
 * never a recovery mechanic (§14's "never gates survival, pursuit recovery or
 * event progression"). combo.test.ts asserts that directly.
 */

import { TUNING, comboMultiplierFor, type FoodKind, type FoodTuning } from './config'

export interface ComboSlice {
  score: number
  /** Consecutive items collected since the last collision; drives the multiplier. */
  comboCount: number
  foodCollected: number
  /** The highest `comboCount` this run reached, for the result breakdown. */
  bestComboCount: number
}

export function initialCombo(): ComboSlice {
  return { score: 0, comboCount: 0, foodCollected: 0, bestComboCount: 0 }
}

export function foodTuningFor(kind: FoodKind): FoodTuning {
  const entry = TUNING.food.find((f) => f.kind === kind)
  // The table is exhaustive over FoodKind (config.test.ts asserts all three),
  // so this fallback is unreachable — it exists only to keep the return total.
  return entry ?? TUNING.food[0]
}

/**
 * Converts raw world-position units (the pixel-scale distance `run.distance`
 * accumulates for spawn timing and pruning — see `TUNING.world.metresPerUnit`'s
 * own comment) into the narrative "metres travelled" figure the score and
 * every player-facing distance stat are actually about. `run.distance` itself
 * must never be rescaled — spawn/collision logic depends on its raw units —
 * so every score or display read goes through this conversion first.
 */
export function metresTravelled(rawDistanceUnits: number): number {
  return rawDistanceUnits * TUNING.world.metresPerUnit
}

/** One point per whole metre, never multiplied by the combo (§14). Takes a
 *  metres value — pass it through `metresTravelled` first if what you have
 *  is `run.distance`'s raw world-position units. */
export function distanceScore(distanceMetres: number): number {
  return Math.floor(Math.max(0, distanceMetres))
}

/**
 * Collects one item. The multiplier applied is the one reached *after* the
 * increment (§14), bounded by the current difficulty band's combo cap (§10) —
 * the threshold table itself is unchanged, the band only clamps its output.
 */
export function collectFood<T extends ComboSlice>(slice: T, kind: FoodKind, comboCap = 5): T {
  const comboCount = slice.comboCount + 1
  const multiplier = Math.min(comboMultiplierFor(comboCount), comboCap)
  return {
    ...slice,
    comboCount,
    bestComboCount: Math.max(slice.bestComboCount, comboCount),
    foodCollected: slice.foodCollected + 1,
    score: slice.score + foodTuningFor(kind).basePoints * multiplier,
  }
}

/** A collision resets count and multiplier; earned score is never removed (§14). */
export function applyComboReset<T extends ComboSlice>(slice: T): T {
  return { ...slice, comboCount: 0 }
}
