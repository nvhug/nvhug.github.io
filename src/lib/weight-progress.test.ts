import { describe, expect, it } from 'vitest'
import { weightProgress } from './weight-progress'

// The tracker's goal direction is loss: START above TARGET.
const START = 70
const TARGET = 65

describe('weightProgress — a loss goal', () => {
  it('reports nothing lost and the full gap remaining at the starting weight', () => {
    expect(weightProgress(START, START, TARGET)).toEqual({
      lost: 0,
      remaining: 5,
      percent: 0,
    })
  })

  it('reports progress partway down', () => {
    expect(weightProgress(66, START, TARGET)).toEqual({
      lost: 4,
      remaining: 1,
      percent: 80,
    })
  })

  it('reports the goal met exactly at the target', () => {
    expect(weightProgress(TARGET, START, TARGET)).toEqual({
      lost: 5,
      remaining: 0,
      percent: 100,
    })
  })
})

describe('weightProgress — values outside the goal range', () => {
  it('counts extra loss past the target but never asks for more than 0 remaining', () => {
    // Overshooting the goal must not render as "-2 kg remaining".
    expect(weightProgress(63, START, TARGET)).toEqual({
      lost: 7,
      remaining: 0,
      percent: 100,
    })
  })

  it('reports a negative loss when the weight went up, and never a negative percent', () => {
    // This is the case the old formula rendered as "+-4.0 kg": the sign has to
    // live in the number, not in a hardcoded "+" in the markup.
    const progress = weightProgress(72, START, TARGET)
    expect(progress.lost).toBe(-2)
    expect(progress.remaining).toBe(7)
    expect(progress.percent).toBe(0)
  })
})

describe('weightProgress — degenerate configuration', () => {
  it('does not divide by zero when start and target are the same', () => {
    const progress = weightProgress(70, 70, 70)
    expect(Number.isFinite(progress.percent)).toBe(true)
    expect(progress.percent).toBe(100)
  })
})

describe('weightProgress — rounding', () => {
  it('keeps one decimal place rather than a long float', () => {
    // 70 - 66.2 = 3.8000000000000043 in IEEE 754 without rounding.
    const progress = weightProgress(66.2, START, TARGET)
    expect(progress.lost).toBe(3.8)
    expect(progress.remaining).toBe(1.2)
  })

  it('never emits more than one decimal place, whichever way a half rounds', () => {
    // 66.35 is a deliberate edge case: the same input lands just above a half
    // for `lost` and just below it for `remaining`. Which way each goes is an
    // IEEE 754 artifact and not worth pinning; that neither becomes a long
    // float is what the card actually needs.
    const progress = weightProgress(66.35, START, TARGET)
    for (const value of [progress.lost, progress.remaining]) {
      expect(value).toBe(Math.round(value * 10) / 10)
      expect(String(value).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(1)
    }
  })
})
