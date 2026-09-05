import { describe, expect, it } from 'vitest'
import { TUNING, comboMultiplierFor } from './config'
import { applyComboReset, collectFood, distanceScore, foodTuningFor, initialCombo, metresTravelled } from './combo'
import { advance, initialRun } from './run'
import { transition } from './state-machine'
import type { Run } from './types'

const HOLD = { jumpRequested: false, duckHeld: false, pauseRequested: false }
const STEP = TUNING.frame.fixedStepMs

function startedRun(seed: number): Run {
  let run = initialRun(seed)
  run = transition(run, { type: 'INIT' })
  run = transition(run, { type: 'LOADING_COMPLETE' })
  run = transition(run, { type: 'START' })
  return transition(run, { type: 'COUNTDOWN_COMPLETE' })
}

describe('foodTuningFor', () => {
  it('gives the three food types distinct base points and rarities (§14)', () => {
    const kinds = ['bone', 'sausage', 'chickenLeg'] as const
    const points = kinds.map((k) => foodTuningFor(k).basePoints)
    const rarities = kinds.map((k) => foodTuningFor(k).rarity)
    expect(new Set(points).size).toBe(3)
    expect(new Set(rarities).size).toBe(3)
    expect(foodTuningFor('bone').basePoints).toBe(10)
    expect(foodTuningFor('sausage').basePoints).toBe(25)
    expect(foodTuningFor('chickenLeg').basePoints).toBe(50)
  })
})

describe('collectFood', () => {
  it('increments the combo count and adds base points at the multiplier reached AFTER the increment', () => {
    let slice = initialCombo()
    slice = collectFood(slice, 'bone')
    // First item: count 1 -> still x1.
    expect(slice.comboCount).toBe(1)
    expect(slice.score).toBe(10)

    slice = collectFood(slice, 'bone')
    slice = collectFood(slice, 'bone')
    // Third item takes the count to 3, which is the x2 threshold — so it is
    // itself worth x2, not x1 (§14's "base points x current multiplier after increment").
    expect(slice.comboCount).toBe(3)
    expect(comboMultiplierFor(slice.comboCount)).toBe(2)
    expect(slice.score).toBe(10 + 10 + 20)
  })

  it('counts every collected item and remembers the best combo reached', () => {
    let slice = initialCombo()
    for (let i = 0; i < 7; i++) slice = collectFood(slice, 'bone')
    expect(slice.foodCollected).toBe(7)
    expect(slice.bestComboCount).toBe(7)

    slice = applyComboReset(slice)
    slice = collectFood(slice, 'bone')
    expect(slice.comboCount).toBe(1)
    expect(slice.bestComboCount).toBe(7)
    expect(slice.foodCollected).toBe(8)
  })

  it('honours the band combo cap (§10) without changing the threshold table', () => {
    let slice = initialCombo()
    for (let i = 0; i < 20; i++) slice = collectFood(slice, 'bone', 1)
    // 20 items at a hard x1 cap: 200 points, never 5x.
    expect(slice.score).toBe(200)
    expect(slice.comboCount).toBe(20)
  })

  it('never touches the pursuit gap — food is not a recovery mechanic (§14)', () => {
    const slice = { ...initialCombo(), pursuitGap: 41 }
    expect(collectFood(slice, 'chickenLeg').pursuitGap).toBe(41)
    expect(applyComboReset(slice).pursuitGap).toBe(41)
  })
})

describe('applyComboReset', () => {
  it('resets the count (and so the multiplier) to x1 without removing earned score', () => {
    let slice = initialCombo()
    for (let i = 0; i < 6; i++) slice = collectFood(slice, 'sausage')
    const earned = slice.score
    expect(comboMultiplierFor(slice.comboCount)).toBe(3)

    const reset = applyComboReset(slice)
    expect(reset.comboCount).toBe(0)
    expect(comboMultiplierFor(reset.comboCount)).toBe(1)
    expect(reset.score).toBe(earned)
  })
})

describe('distanceScore', () => {
  it('is one point per whole metre and never negative', () => {
    expect(distanceScore(0)).toBe(0)
    expect(distanceScore(0.99)).toBe(0)
    expect(distanceScore(1)).toBe(1)
    expect(distanceScore(412.7)).toBe(412)
    expect(distanceScore(-5)).toBe(0)
  })
})

describe('metresTravelled', () => {
  it('scales raw world-position units down to a believable narrative pace, not a 1:1 pixel count', () => {
    // Caught live in QA: at speedUnitsPerSec's raw scale, 12 seconds of clean
    // play produced "7560 m" and a ~7225 score — an 630 m/s dog. The whole
    // point of this conversion is that it never reads that way again: a full
    // 3-minute run at the fastest band must land near DESIGN's own ~2,400
    // distance-point estimate, not two orders of magnitude past it.
    const threeMinutesAtMaxBand = TUNING.bands[TUNING.bands.length - 1].speed * TUNING.world.speedUnitsPerSec * 180
    expect(distanceScore(metresTravelled(threeMinutesAtMaxBand))).toBeLessThan(5000)
    expect(distanceScore(metresTravelled(threeMinutesAtMaxBand))).toBeGreaterThan(500)
  })

  it('is a pure linear scale — zero maps to zero, doubling the input doubles the output', () => {
    expect(metresTravelled(0)).toBe(0)
    expect(metresTravelled(200)).toBeCloseTo(metresTravelled(100) * 2, 6)
  })
})

describe('scoring inside a real run', () => {
  it('collects a food item exactly once no matter how many ticks pass over it', () => {
    let run = startedRun(11)
    run = { ...run, food: [{ id: 777, kind: 'chickenLeg', x: 0, collected: false }], obstacles: [] }
    const scoreBefore = run.score

    run = advance(run, HOLD, STEP)
    const afterFirst = run.score
    expect(run.comboCount).toBe(1)
    expect(run.foodCollected).toBe(1)
    expect(afterFirst).toBeGreaterThan(scoreBefore)

    for (let i = 0; i < 10; i++) run = advance(run, HOLD, STEP)
    expect(run.comboCount).toBe(1)
    expect(run.foodCollected).toBe(1)
  })

  it('a collision resets the combo without removing the score it already earned', () => {
    let run = startedRun(12)
    run = { ...run, food: [{ id: 778, kind: 'sausage', x: 0, collected: false }], obstacles: [] }
    run = advance(run, HOLD, STEP)
    for (let i = 0; i < 3; i++) {
      run = { ...run, food: [{ id: 780 + i, kind: 'sausage', x: 0, collected: false }] }
      run = advance(run, HOLD, STEP)
    }
    const scoreBeforeHit = run.score
    expect(run.comboCount).toBeGreaterThanOrEqual(4)

    run = { ...run, obstacles: [{ id: 900, family: 'lowFence', x: 0, resolved: false }] }
    run = advance(run, HOLD, STEP)
    expect(run.state).toBe('HIT_REACTION')
    expect(run.comboCount).toBe(0)
    expect(run.score).toBeGreaterThanOrEqual(scoreBeforeHit)
  })

  it('distance points are never multiplied by the combo', () => {
    let clean = startedRun(13)
    let combod = { ...startedRun(13), comboCount: 20 }
    for (let i = 0; i < 120; i++) {
      clean = advance({ ...clean, food: [], obstacles: [] }, HOLD, STEP)
      combod = advance({ ...combod, food: [], obstacles: [] }, HOLD, STEP)
    }
    expect(combod.score).toBe(clean.score)
  })
})
