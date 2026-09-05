import { describe, expect, it } from 'vitest'
import { TUNING } from './config'
import { instinctTarget, type InstinctSlice } from './instinct'
import type { Food } from './types'

function food(id: number, x: number, collected = false): Food {
  return { id, kind: 'bone', x, collected }
}

function slice(partial: Partial<InstinctSlice> = {}): InstinctSlice {
  return { state: 'RUNNING', food: [], ...partial }
}

describe('instinctTarget', () => {
  it('points at the nearest eligible food inside the instinct range', () => {
    const target = instinctTarget(slice({ food: [food(1, 400), food(2, 120), food(3, 650)] }))
    expect(target?.id).toBe(2)
  })

  it('never selects food outside the clear look-ahead zone', () => {
    const beyond = TUNING.instinct.rangeUnits + 1
    expect(instinctTarget(slice({ food: [food(1, beyond)] }))).toBeNull()
    expect(instinctTarget(slice({ food: [food(1, TUNING.instinct.rangeUnits)] }))?.id).toBe(1)
  })

  it('clears the moment the target is collected', () => {
    expect(instinctTarget(slice({ food: [food(1, 200, true)] }))).toBeNull()
  })

  it('clears once the target is behind the dog and no longer safe to advertise', () => {
    expect(instinctTarget(slice({ food: [food(1, 0)] }))).toBeNull()
    expect(instinctTarget(slice({ food: [food(1, -30)] }))).toBeNull()
  })

  it('clears when the target despawned (an empty world advertises nothing)', () => {
    expect(instinctTarget(slice({ food: [] }))).toBeNull()
  })

  it('is suppressed during the hit reaction and after the catch (§14)', () => {
    const world = [food(1, 200)]
    expect(instinctTarget(slice({ state: 'HIT_REACTION', food: world }))).toBeNull()
    expect(instinctTarget(slice({ state: 'GAME_OVER', food: world }))).toBeNull()
    expect(instinctTarget(slice({ state: 'RESULT', food: world }))).toBeNull()
    expect(instinctTarget(slice({ state: 'PAUSED', food: world }))).toBeNull()
    expect(instinctTarget(slice({ state: 'READY', food: world }))).toBeNull()
  })

  it('is active in every running-pursuit state', () => {
    const world = [food(1, 200)]
    for (const state of ['RUNNING', 'CAT_WARNING', 'CAT_CHASE'] as const) {
      expect(instinctTarget(slice({ state, food: world }))?.id).toBe(1)
    }
  })

  it('is a pure read — it returns an existing entity and mutates nothing', () => {
    const world = [food(1, 200)]
    const input = slice({ food: world })
    const frozen = JSON.stringify(input)
    const target = instinctTarget(input)
    expect(target).toBe(world[0])
    expect(JSON.stringify(input)).toBe(frozen)
  })
})
