import { describe, expect, it } from 'vitest'
import { TUNING } from './config'
import { advanceClamped, initialDogPhysics, isAirborne, jumpHeightFraction, stepDogPhysics } from './physics'

const HOLD = { jumpRequested: false, duckHeld: false }

function runJump(stepMs: number) {
  let dog = initialDogPhysics()
  dog = stepDogPhysics(dog, { ...HOLD, jumpRequested: true }, stepMs)
  let elapsed = stepMs
  let maxHeight = jumpHeightFraction(dog)
  let elapsedAtApex = elapsed
  while (isAirborne(dog)) {
    dog = stepDogPhysics(dog, HOLD, stepMs)
    elapsed += stepMs
    const height = jumpHeightFraction(dog)
    if (height > maxHeight) {
      maxHeight = height
      elapsedAtApex = elapsed
    }
  }
  return { totalAirtimeMs: elapsed, elapsedAtApex }
}

describe('stepDogPhysics — jump', () => {
  it('lands within one fixed step of the configured airtime, at 60Hz', () => {
    const { totalAirtimeMs } = runJump(TUNING.frame.fixedStepMs)
    expect(Math.abs(totalAirtimeMs - TUNING.jump.airtimeMs)).toBeLessThanOrEqual(TUNING.frame.fixedStepMs)
  })

  it('lands within one fixed step of the configured airtime at a different step size (frame-rate independence)', () => {
    const fineStepMs = TUNING.frame.fixedStepMs / 2
    const { totalAirtimeMs } = runJump(fineStepMs)
    expect(Math.abs(totalAirtimeMs - TUNING.jump.airtimeMs)).toBeLessThanOrEqual(fineStepMs)
  })

  it('reaches its peak airborne height near the configured apex fraction, regardless of step size', () => {
    for (const stepMs of [TUNING.frame.fixedStepMs, TUNING.frame.fixedStepMs / 2]) {
      const { totalAirtimeMs, elapsedAtApex } = runJump(stepMs)
      const expectedApexMs = totalAirtimeMs * TUNING.jump.apexFraction
      expect(Math.abs(elapsedAtApex - expectedApexMs)).toBeLessThanOrEqual(totalAirtimeMs * 0.15)
    }
  })

  it('is grounded again after landing', () => {
    let dog = initialDogPhysics()
    dog = stepDogPhysics(dog, { ...HOLD, jumpRequested: true }, TUNING.frame.fixedStepMs)
    while (isAirborne(dog)) dog = stepDogPhysics(dog, HOLD, TUNING.frame.fixedStepMs)
    expect(isAirborne(dog)).toBe(false)
    expect(dog.airborneMs).toBe(0)
  })

  it('drops a second jump request made well before landing (no double-jump)', () => {
    let dog = initialDogPhysics()
    dog = stepDogPhysics(dog, { ...HOLD, jumpRequested: true }, TUNING.frame.fixedStepMs)
    // Request again immediately — far outside the buffer window (landing is ~670ms away).
    const requestedAgain = stepDogPhysics(dog, { ...HOLD, jumpRequested: true }, TUNING.frame.fixedStepMs)
    expect(requestedAgain.jumpBufferMs).toBe(0)
  })

  it('buffers a jump requested inside the buffer window and triggers it immediately on landing', () => {
    // Put the dog one fixed step away from landing, well inside the buffer window.
    const almostLanded = {
      grounded: false,
      airborneMs: TUNING.jump.airtimeMs - TUNING.frame.fixedStepMs,
      jumpBufferMs: 0,
      duckProgress: 0,
    }
    const buffered = stepDogPhysics(almostLanded, { ...HOLD, jumpRequested: true }, 0)
    expect(buffered.jumpBufferMs).toBeGreaterThan(0)

    const landed = stepDogPhysics(buffered, HOLD, TUNING.frame.fixedStepMs)
    expect(isAirborne(landed)).toBe(true)
    expect(landed.jumpBufferMs).toBe(0)
  })

  it('ignores a jump request while airborne and outside the buffer window', () => {
    const midair = { grounded: false, airborneMs: TUNING.jump.airtimeMs / 2, jumpBufferMs: 0, duckProgress: 0 }
    const requested = stepDogPhysics(midair, { ...HOLD, jumpRequested: true }, 0)
    expect(requested.jumpBufferMs).toBe(0)
  })
})

describe('stepDogPhysics — duck', () => {
  it('reaches full duck within the configured transition duration', () => {
    let dog = initialDogPhysics()
    let elapsed = 0
    while (dog.duckProgress < 1 && elapsed < TUNING.duck.transitionMs * 2) {
      dog = stepDogPhysics(dog, { ...HOLD, duckHeld: true }, TUNING.frame.fixedStepMs)
      elapsed += TUNING.frame.fixedStepMs
    }
    expect(dog.duckProgress).toBe(1)
    expect(elapsed).toBeLessThanOrEqual(TUNING.duck.transitionMs + TUNING.frame.fixedStepMs)
  })

  it('releases back to standing within the configured transition duration once held clears', () => {
    let dog = { ...initialDogPhysics(), duckProgress: 1 }
    let elapsed = 0
    while (dog.duckProgress > 0 && elapsed < TUNING.duck.transitionMs * 2) {
      dog = stepDogPhysics(dog, HOLD, TUNING.frame.fixedStepMs)
      elapsed += TUNING.frame.fixedStepMs
    }
    expect(dog.duckProgress).toBe(0)
    expect(elapsed).toBeLessThanOrEqual(TUNING.duck.transitionMs + TUNING.frame.fixedStepMs)
  })
})

describe('advanceClamped — long-frame safety (§7, §29)', () => {
  const identityStep = (n: number, dtMs: number) => n + dtMs

  it('advances a normal frame delta by one fixed step', () => {
    const result = advanceClamped(0, TUNING.frame.fixedStepMs, identityStep)
    expect(result.stepsRun).toBe(1)
    expect(result.state).toBeCloseTo(TUNING.frame.fixedStepMs, 5)
  })

  it('clamps a very large real delta instead of running dozens of catch-up steps', () => {
    const hugeDelta = 5000 // e.g. a debugger pause or a backgrounded tab
    const result = advanceClamped(0, hugeDelta, identityStep)
    const maxPossibleSteps = Math.ceil(TUNING.frame.maxDeltaMs / TUNING.frame.fixedStepMs) + 1
    expect(result.stepsRun).toBeLessThanOrEqual(maxPossibleSteps)
    expect(result.state).toBeLessThanOrEqual(TUNING.frame.maxDeltaMs + TUNING.frame.fixedStepMs)
  })

  it('carries the sub-step remainder forward via the returned accumulator', () => {
    const oddDelta = TUNING.frame.fixedStepMs * 1.5
    const first = advanceClamped(0, oddDelta, identityStep)
    expect(first.stepsRun).toBe(1)
    expect(first.accumulator).toBeCloseTo(TUNING.frame.fixedStepMs * 0.5, 5)

    // Feeding the leftover accumulator back in produces the second step exactly
    // once enough time has accumulated — no time is silently dropped or duplicated.
    const second = advanceClamped(first.state, oddDelta, identityStep, first.accumulator)
    expect(second.stepsRun).toBe(2)
  })

  it('produces the same total motion whether split into small deltas or fed as one delta, below the clamp ceiling', () => {
    // Total time here (2 fixed steps) stays under maxDeltaMs, so neither path clamps —
    // this isolates the accumulator's correctness from the clamp behavior above.
    let accA = 0
    let stateA = 0
    for (let i = 0; i < 2; i++) {
      const r = advanceClamped(stateA, TUNING.frame.fixedStepMs, identityStep, accA)
      stateA = r.state
      accA = r.accumulator
    }
    const r = advanceClamped(0, TUNING.frame.fixedStepMs * 2, identityStep)
    expect(r.state).toBeCloseTo(stateA, 5)
  })
})
