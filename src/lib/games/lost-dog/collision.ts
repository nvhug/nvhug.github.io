/**
 * Per-family collision resolution (spec 015 §11) and exactly-once,
 * fixed-order entity resolution (§29). Pure, no rendering or position
 * concerns beyond the single world-space trigger line every obstacle/food
 * crosses on its way to the dog.
 *
 * Simplification noted for this Release-1 pass: the "timing" half of
 * trashBin/pothole's "timing or jump" avoidance (an obstacle's open/closed
 * state fixed before the reaction window, §11) is not yet modeled as a
 * separate passable state — both currently resolve like a plain jump
 * requirement. This is additive to extend later (a `passable` flag on the
 * Obstacle entity) without changing this module's contract.
 */

import { OBSTACLE_ACTIONS, type ObstacleFamily } from './config'
import type { DogPhysics } from './physics'
import type { Food, Obstacle } from './types'

export type CollisionResult = 'clear' | 'hit' | 'slip'

/** The world-space x every entity is resolved at, once reached. */
const TRIGGER_X = 0

export function resolveObstacle(dog: DogPhysics, family: ObstacleFamily): CollisionResult {
  const action = OBSTACLE_ACTIONS[family]
  switch (action) {
    case 'jump':
    case 'timingOrJump':
      return dog.grounded ? 'hit' : 'clear'
    case 'duck':
      return dog.duckProgress >= 1 ? 'clear' : 'hit'
    case 'jumpOrSlip':
      return dog.grounded ? 'slip' : 'clear'
  }
}

export interface ResolveResult {
  readonly obstacles: readonly Obstacle[]
  readonly food: readonly Food[]
  readonly hits: readonly { readonly family: ObstacleFamily; readonly result: 'hit' | 'slip' }[]
  readonly collectedFoodIds: readonly number[]
}

/**
 * Resolves every unresolved obstacle/food that has reached the trigger line
 * this step. Obstacles resolve before food in the same step (§29's fixed
 * order); each entity's own `resolved`/`collected` flag guarantees it is
 * never resolved twice, including when two entities occupy the same
 * position (they are still resolved independently).
 */
export function resolveEntities(
  dog: DogPhysics,
  obstacles: readonly Obstacle[],
  food: readonly Food[],
): ResolveResult {
  const hits: { family: ObstacleFamily; result: 'hit' | 'slip' }[] = []
  const collectedFoodIds: number[] = []

  const nextObstacles = obstacles.map((o) => {
    if (o.resolved || o.x > TRIGGER_X) return o
    const result = resolveObstacle(dog, o.family)
    if (result !== 'clear') hits.push({ family: o.family, result })
    return { ...o, resolved: true }
  })

  const nextFood = food.map((f) => {
    if (f.collected || f.x > TRIGGER_X) return f
    collectedFoodIds.push(f.id)
    return { ...f, collected: true }
  })

  return { obstacles: nextObstacles, food: nextFood, hits, collectedFoodIds }
}
