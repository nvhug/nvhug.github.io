import { describe, expect, it } from 'vitest'
import { TUNING, pursuitBandFor } from './config'
import { applyFoodHeal, applyHit, canApplyHit, initialPursuit, tickPursuit } from './pursuit'

describe('initialPursuit', () => {
  it('starts at gap 75, per §9', () => {
    expect(initialPursuit().pursuitGap).toBe(TUNING.pursuit.startGap)
    expect(initialPursuit().pursuitGap).toBe(75)
  })
})

describe('applyFoodHeal', () => {
  it('restores gap by each kind\'s configured amount', () => {
    expect(applyFoodHeal(initialPursuit(), 'bone').pursuitGap).toBe(75 + TUNING.pursuit.foodHeal.bone)
    expect(applyFoodHeal(initialPursuit(), 'sausage').pursuitGap).toBe(75 + TUNING.pursuit.foodHeal.sausage)
    expect(applyFoodHeal(initialPursuit(), 'chickenLeg').pursuitGap).toBe(75 + TUNING.pursuit.foodHeal.chickenLeg)
  })

  it('never exceeds the 100 gap ceiling', () => {
    const after = applyFoodHeal({ ...initialPursuit(), pursuitGap: 95 }, 'chickenLeg')
    expect(after.pursuitGap).toBe(100)
  })

  it('never touches msSinceLastHit — healing is not a hit-recovery event', () => {
    const before = { ...initialPursuit(), msSinceLastHit: 42 }
    expect(applyFoodHeal(before, 'bone').msSinceLastHit).toBe(42)
  })
})

describe('applyHit', () => {
  it('a standard collision removes 22 gap points', () => {
    const after = applyHit(initialPursuit(), 'standard')
    expect(after.pursuitGap).toBe(75 - 22)
  })

  it('a puddle slip removes 16 gap points', () => {
    const after = applyHit(initialPursuit(), 'puddle')
    expect(after.pursuitGap).toBe(75 - 16)
  })

  it('never drops the gap below 0', () => {
    let state = initialPursuit()
    // Force well past invulnerability between each hit so every hit actually applies.
    for (let i = 0; i < 6; i++) {
      state = tickPursuit(state, TUNING.hit.invulnerabilityMs + 1)
      state = applyHit(state, 'standard')
    }
    expect(state.pursuitGap).toBe(0)
  })

  it('resets msSinceLastHit to 0 so the next hit is blocked by invulnerability', () => {
    const after = applyHit(initialPursuit(), 'standard')
    expect(after.msSinceLastHit).toBe(0)
  })

  it('blocks a second harmful collision inside the 1.1s invulnerability window (§9)', () => {
    let state = applyHit(initialPursuit(), 'standard') // gap 53, msSinceLastHit 0
    state = tickPursuit(state, 500) // 500ms later, still inside 1.1s window
    const attempted = applyHit(state, 'standard')
    expect(attempted.pursuitGap).toBe(state.pursuitGap) // unchanged — the hit was ignored
  })

  it('allows a new hit once the invulnerability window has fully elapsed', () => {
    let state = applyHit(initialPursuit(), 'standard') // gap 53
    state = tickPursuit(state, TUNING.hit.invulnerabilityMs + 1)
    const after = applyHit(state, 'standard')
    expect(after.pursuitGap).toBe(state.pursuitGap - 22)
  })
})

describe('canApplyHit', () => {
  it('matches the invulnerability boundary exactly', () => {
    expect(canApplyHit(TUNING.hit.invulnerabilityMs - 1)).toBe(false)
    expect(canApplyHit(TUNING.hit.invulnerabilityMs)).toBe(true)
  })
})

describe('tickPursuit — recovery', () => {
  it('does not recover before 1.5s without a hit has elapsed', () => {
    let state = applyHit(initialPursuit(), 'standard') // gap 53
    state = tickPursuit(state, TUNING.pursuit.recoveryDelayMs - 1)
    expect(state.pursuitGap).toBe(53)
  })

  it('recovers 2 gap points per second once 1.5s without a hit has elapsed', () => {
    let state = applyHit(initialPursuit(), 'standard') // gap 53
    state = tickPursuit(state, TUNING.pursuit.recoveryDelayMs) // crosses the threshold, 0ms of recovery yet
    state = tickPursuit(state, 1000) // one full second of recovery
    expect(state.pursuitGap).toBeCloseTo(53 + 2, 5)
  })

  it('never recovers past 100', () => {
    let state = { ...initialPursuit(), pursuitGap: 99.5, msSinceLastHit: TUNING.pursuit.recoveryDelayMs }
    state = tickPursuit(state, 5000)
    expect(state.pursuitGap).toBe(100)
  })

  it('a clean run from any positive gap can always recover — gap never gets mathematically stuck', () => {
    let state = { ...initialPursuit(), pursuitGap: 1, msSinceLastHit: TUNING.pursuit.recoveryDelayMs }
    state = tickPursuit(state, 1000)
    expect(state.pursuitGap).toBeGreaterThan(1)
  })
})

describe('pursuitBandFor integration (re-exported from config, exercised here against real pursuit values)', () => {
  it('classifies a freshly-hit gap correctly', () => {
    const afterTwoHits = applyHit(applyHit(tickPursuit(applyHit(initialPursuit(), 'standard'), TUNING.hit.invulnerabilityMs + 1), 'standard'), 'standard')
    // Not asserting an exact number here (that's applyHit's job above) — just that
    // pursuit.ts's output is a valid input to the shared band classifier.
    expect(['safe', 'watch', 'danger', 'critical', 'caught']).toContain(pursuitBandFor(afterTwoHits.pursuitGap))
  })
})
