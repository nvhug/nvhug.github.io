import { describe, expect, it } from 'vitest'
import { initialDogPhysics } from './physics'
import { resolveEntities, resolveObstacle } from './collision'
import type { Food, Obstacle } from './types'

const grounded = initialDogPhysics()
const airborne = { ...initialDogPhysics(), grounded: false, airborneMs: 300 }
const fullyDucked = { ...initialDogPhysics(), duckProgress: 1 }
const halfDucked = { ...initialDogPhysics(), duckProgress: 0.5 }

describe('resolveObstacle — per-family avoidance contract (§11)', () => {
  it('lowFence: jump clears it, standing does not', () => {
    expect(resolveObstacle(airborne, 'lowFence')).toBe('clear')
    expect(resolveObstacle(grounded, 'lowFence')).toBe('hit')
  })

  it('planter: jump clears it, standing does not', () => {
    expect(resolveObstacle(airborne, 'planter')).toBe('clear')
    expect(resolveObstacle(grounded, 'planter')).toBe('hit')
  })

  it('bicycle: fully ducking clears it; standing or a half-duck does not', () => {
    expect(resolveObstacle(fullyDucked, 'bicycle')).toBe('clear')
    expect(resolveObstacle(grounded, 'bicycle')).toBe('hit')
    expect(resolveObstacle(halfDucked, 'bicycle')).toBe('hit')
  })

  it('puddle: jump clears it cleanly; not jumping is a recoverable slip, never a hard hit', () => {
    expect(resolveObstacle(airborne, 'puddle')).toBe('clear')
    expect(resolveObstacle(grounded, 'puddle')).toBe('slip')
  })

  it('trashBin and pothole: jump clears them, standing does not', () => {
    expect(resolveObstacle(airborne, 'trashBin')).toBe('clear')
    expect(resolveObstacle(grounded, 'trashBin')).toBe('hit')
    expect(resolveObstacle(airborne, 'pothole')).toBe('clear')
    expect(resolveObstacle(grounded, 'pothole')).toBe('hit')
  })
})

function obstacle(id: number, x: number, extra: Partial<Obstacle> = {}): Obstacle {
  return { id, family: 'lowFence', x, resolved: false, ...extra }
}

function food(id: number, x: number, extra: Partial<Food> = {}): Food {
  return { id, kind: 'bone', x, collected: false, ...extra }
}

describe('resolveEntities — exactly-once resolution and fixed order (§29)', () => {
  it('resolves an obstacle reached this step exactly once', () => {
    const first = resolveEntities(grounded, [obstacle(1, 0)], [])
    expect(first.hits).toHaveLength(1)
    expect(first.obstacles[0].resolved).toBe(true)

    // Calling again with the now-resolved obstacle produces no new hit.
    const second = resolveEntities(grounded, first.obstacles, [])
    expect(second.hits).toHaveLength(0)
  })

  it('does not resolve an obstacle that has not been reached yet', () => {
    const result = resolveEntities(grounded, [obstacle(1, 50)], [])
    expect(result.hits).toHaveLength(0)
    expect(result.obstacles[0].resolved).toBe(false)
  })

  it('resolves an obstacle and food reached in the same step, each exactly once', () => {
    const result = resolveEntities(grounded, [obstacle(1, 0)], [food(2, 0)])
    expect(result.hits).toHaveLength(1)
    expect(result.collectedFoodIds).toEqual([2])
    expect(result.obstacles[0].resolved).toBe(true)
    expect(result.food[0].collected).toBe(true)
  })

  it('two overlapping obstacles at the same position each resolve independently, exactly once', () => {
    const result = resolveEntities(grounded, [obstacle(1, 0), obstacle(2, 0)], [])
    expect(result.hits).toHaveLength(2)
    expect(result.obstacles.every((o) => o.resolved)).toBe(true)

    const again = resolveEntities(grounded, result.obstacles, [])
    expect(again.hits).toHaveLength(0)
  })

  it('a cleared jump obstacle produces no hit but is still marked resolved', () => {
    const result = resolveEntities(airborne, [obstacle(1, 0)], [])
    expect(result.hits).toHaveLength(0)
    expect(result.obstacles[0].resolved).toBe(true)
  })
})
