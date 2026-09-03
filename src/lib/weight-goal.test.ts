import { describe, expect, it } from 'vitest'
import { DEFAULT_WEIGHT_GOAL, parseWeightGoal, parseWeightInput } from './weight-goal'

describe('parseWeightGoal', () => {
  it('accepts a stored goal with both bounds', () => {
    expect(parseWeightGoal({ start: 61, target: 75 })).toEqual({ start: 61, target: 75 })
  })

  it('falls back to the starter goal when nothing is stored', () => {
    expect(parseWeightGoal(undefined)).toEqual(DEFAULT_WEIGHT_GOAL)
    expect(parseWeightGoal(null)).toEqual(DEFAULT_WEIGHT_GOAL)
  })

  it('falls back to the starter goal when the stored record is malformed', () => {
    // A bad record must read as "not set", not as a NaN progress bar.
    expect(parseWeightGoal({ start: '61', target: 75 })).toEqual(DEFAULT_WEIGHT_GOAL)
    expect(parseWeightGoal({ start: 61 })).toEqual(DEFAULT_WEIGHT_GOAL)
    expect(parseWeightGoal({ start: 0, target: 75 })).toEqual(DEFAULT_WEIGHT_GOAL)
    expect(parseWeightGoal({ start: 61, target: Number.NaN })).toEqual(DEFAULT_WEIGHT_GOAL)
    expect(parseWeightGoal('61-75')).toEqual(DEFAULT_WEIGHT_GOAL)
  })
})

describe('parseWeightInput', () => {
  it('parses a typed weight to one decimal place', () => {
    expect(parseWeightInput('64.2')).toBe(64.2)
    expect(parseWeightInput(' 75 ')).toBe(75)
    expect(parseWeightInput('64.25')).toBe(64.3)
  })

  it('accepts a decimal comma, which a Vietnamese keyboard produces', () => {
    expect(parseWeightInput('64,2')).toBe(64.2)
  })

  it('rejects anything that is not a positive weight', () => {
    expect(parseWeightInput('')).toBeNull()
    expect(parseWeightInput('abc')).toBeNull()
    expect(parseWeightInput('0')).toBeNull()
    expect(parseWeightInput('-5')).toBeNull()
  })
})
