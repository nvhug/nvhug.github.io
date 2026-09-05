/**
 * The spawner and its fairness validator (spec 015 §12; plan R7). The
 * validator is a direct transcription of §12's Reaction budget and Forbidden
 * patterns tables — the same rule set the property test in spawner.test.ts
 * checks candidates against, so test and implementation share one source of
 * truth. Every candidate is generated, then validated; a rejected candidate
 * is redrawn (bounded retries) from the gameplay stream, falling back to a
 * guaranteed-safe single-obstacle pattern if retries are exhausted — the
 * same generate-then-validate shape the block puzzle's generator uses.
 */

import type { Rng } from '../rng'
import { randInt } from '../rng'
import {
  OBSTACLE_ACTIONS,
  TUNING,
  type DifficultyBand,
  type FoodKind,
  type ObstacleFamily,
  type RequiredAction,
} from './config'

export interface ObstacleToken {
  readonly kind: 'obstacle'
  readonly family: ObstacleFamily
  readonly action: RequiredAction
}

/** Where the pattern's food sits relative to the first obstacle's action point. */
export type FoodPlacement = 'safeLine' | 'nearHazard'

export interface FoodToken {
  readonly kind: 'food'
  readonly foodKind: FoodKind
  readonly placement: FoodPlacement
  /** Seconds after the first obstacle's action point (0 when the pattern has no obstacle). */
  readonly offsetSec: number
}

export interface GeneratedPattern {
  /** One or two obstacles (paired), temporally ordered. */
  readonly obstacles: readonly ObstacleToken[]
  readonly food: FoodToken | null
  /** Seconds of clear read time before the first obstacle's action must be taken. */
  readonly leadSec: number
  /** Seconds between the first and second obstacle's action (0 when only one obstacle). */
  readonly gapSec: number
  /** Whether food (if present) can be skipped without taking any obstacle's action. */
  readonly foodHasSafeRefusal: boolean
}

/** Linearly interpolates the §12 reaction-budget minimum: 0.85s at 1.0x down to 0.70s at 1.65x. */
export function reactionBudgetSecFor(band: DifficultyBand): number {
  const { normalMinSec, atCapMinSec } = TUNING.reactionBudget
  const t = Math.min(1, Math.max(0, (band.speed - 1.0) / (1.65 - 1.0)))
  return normalMinSec + (atCapMinSec - normalMinSec) * t
}

function actionsIncompatible(a: RequiredAction, b: RequiredAction): boolean {
  return a !== b
}

/**
 * §12's forbidden-pattern rules, transcribed directly:
 * - reaction budget minimum honored;
 * - no simultaneous (zero-gap) differing-action pair — "jump and duck at once";
 * - an incompatible action inside the previous action's recovery window;
 * - food never makes damage mandatory.
 */
export function validatePattern(pattern: GeneratedPattern, band: DifficultyBand): boolean {
  if (pattern.leadSec < reactionBudgetSecFor(band)) return false

  if (pattern.obstacles.length === 2) {
    const [first, second] = pattern.obstacles
    if (actionsIncompatible(first.action, second.action)) {
      if (pattern.gapSec <= 0) return false
      if (pattern.gapSec < TUNING.reactionBudget.postActionNeutralSec) return false
    }
  }

  if (pattern.food && !pattern.foodHasSafeRefusal) return false

  return true
}

const OBSTACLE_FAMILIES = Object.keys(OBSTACLE_ACTIONS) as readonly ObstacleFamily[]

function pickFamily(rng: Rng): ObstacleFamily {
  return OBSTACLE_FAMILIES[randInt(rng, 0, OBSTACLE_FAMILIES.length - 1)]
}

/** Seeded weighted pick from the §14 food table. Exported so the food-bonus event can use the same rarity curve. */
export function pickFoodKindFromRng(rng: Rng): FoodKind {
  const roll = rng()
  let cumulative = 0
  for (const food of TUNING.food) {
    cumulative += food.rarity
    if (roll < cumulative) return food.kind
  }
  return TUNING.food[TUNING.food.length - 1].kind
}

/**
 * Whether the pattern's food can be declined without taking damage (§12's
 * "food that makes damage mandatory" is the forbidden case). Food with no
 * obstacle in the pattern is trivially refusable; food beside a hazard is only
 * refusable when it sits *outside* that hazard's own action window, so
 * reaching for it never means abandoning the required action.
 */
export function foodRefusalIsSafe(
  food: FoodToken | null,
  obstacles: readonly ObstacleToken[],
): boolean {
  if (!food || obstacles.length === 0) return true
  return food.offsetSec >= TUNING.reactionBudget.postActionNeutralSec
}

/** The authored pattern library (plan R7). Every candidate is one of these shapes. */
export type PatternKind =
  | 'singleObstacle'
  | 'pairedObstacles'
  | 'obstacleWithSafeFood'
  | 'obstacleWithRiskyFood'
  | 'foodLine'

const PATTERN_LIBRARY: readonly { readonly kind: PatternKind; readonly weight: number }[] = [
  { kind: 'singleObstacle', weight: 34 },
  { kind: 'pairedObstacles', weight: 20 },
  { kind: 'obstacleWithSafeFood', weight: 24 },
  { kind: 'obstacleWithRiskyFood', weight: 12 },
  { kind: 'foodLine', weight: 10 },
]

function pickPatternKind(rng: Rng): PatternKind {
  const total = PATTERN_LIBRARY.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = rng() * total
  for (const entry of PATTERN_LIBRARY) {
    roll -= entry.weight
    if (roll < 0) return entry.kind
  }
  return PATTERN_LIBRARY[0].kind
}

function obstacleToken(family: ObstacleFamily): ObstacleToken {
  return { kind: 'obstacle', family, action: OBSTACLE_ACTIONS[family] }
}

/**
 * One raw candidate — deliberately not always legal, so the validator/retry
 * loop in `pickValidPattern` has real work to do, the same way a naive
 * random placement would before being checked.
 */
export function generateCandidate(rng: Rng, band: DifficultyBand): GeneratedPattern {
  const baseline = reactionBudgetSecFor(band)
  const neutral = TUNING.reactionBudget.postActionNeutralSec
  // Occasionally undershoot the reaction budget slightly, exercising rejection.
  const leadSec = rng() < 0.15 ? baseline - 0.05 : baseline + rng() * 0.6
  const patternKind = pickPatternKind(rng)

  const obstacles: ObstacleToken[] =
    patternKind === 'foodLine' ? [] : [obstacleToken(pickFamily(rng))]
  let gapSec = 0
  if (patternKind === 'pairedObstacles') {
    obstacles.push(obstacleToken(pickFamily(rng)))
    // Deliberately span both legal and illegal gaps so validation has real cases to reject.
    gapSec = rng() * (neutral + 0.3)
  }

  let food: FoodToken | null = null
  if (patternKind === 'obstacleWithSafeFood') {
    // Well clear of the hazard's action window: the "teach the line" placement.
    food = { kind: 'food', foodKind: pickFoodKindFromRng(rng), placement: 'safeLine', offsetSec: neutral + 0.2 + rng() * 0.5 }
  } else if (patternKind === 'obstacleWithRiskyFood') {
    // Tight against the hazard on purpose; some of these land inside the action
    // window and are rejected, which is exactly what makes the check meaningful.
    food = { kind: 'food', foodKind: pickFoodKindFromRng(rng), placement: 'nearHazard', offsetSec: rng() * (neutral + 0.25) }
  } else if (patternKind === 'foodLine') {
    food = { kind: 'food', foodKind: pickFoodKindFromRng(rng), placement: 'safeLine', offsetSec: 0 }
  }

  return { obstacles, food, leadSec, gapSec, foodHasSafeRefusal: foodRefusalIsSafe(food, obstacles) }
}

/** A single, generous, always-valid pattern — the deterministic fallback when retries are exhausted. */
function safeFallback(band: DifficultyBand): GeneratedPattern {
  return {
    obstacles: [obstacleToken('lowFence')],
    food: null,
    leadSec: reactionBudgetSecFor(band) + 0.5,
    gapSec: 0,
    foodHasSafeRefusal: true,
  }
}

export interface PickedPattern {
  readonly pattern: GeneratedPattern
  readonly usedFallback: boolean
}

export function pickValidPattern(rng: Rng, band: DifficultyBand, maxAttempts = 8): PickedPattern {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateCandidate(rng, band)
    if (validatePattern(candidate, band)) return { pattern: candidate, usedFallback: false }
  }
  return { pattern: safeFallback(band), usedFallback: true }
}
