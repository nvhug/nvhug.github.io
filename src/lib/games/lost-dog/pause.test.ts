/**
 * SC-010's acceptance pass: time spent paused — because the tab was hidden,
 * the window lost focus, or the player pressed Escape — changes the run by
 * exactly nothing.
 *
 * The guarantee has two halves and both are asserted here. The simulation half
 * is that `advance` is a no-op outside an active state, so even a loop that
 * mistakenly keeps ticking cannot move the world. The loop half is that
 * `useGameLoop` stops accumulating (rather than skipping render) and zeroes its
 * accumulator on resume — that hook is not unit-tested by project convention,
 * but the arithmetic it delegates to is, in physics.test.ts.
 */

import { describe, expect, it } from 'vitest'
import { TUNING } from './config'
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

/** Everything a paused run must not change, as plain comparable data. */
function worldOf(run: Run) {
  return {
    elapsedActiveMs: run.elapsedActiveMs,
    distance: run.distance,
    score: run.score,
    comboCount: run.comboCount,
    pursuitGap: run.pursuitGap,
    dog: run.dog,
    obstacles: run.obstacles,
    food: run.food,
    particles: run.particles,
    weather: run.weather,
    activeEvent: run.activeEvent,
    nextSpawnDistance: run.nextSpawnDistance,
    nextEntityId: run.nextEntityId,
  }
}

describe('pausing changes nothing about the run (SC-010)', () => {
  it('the PAUSE transition itself moves no time, no score and no entity', () => {
    let run = startedRun(21)
    for (let i = 0; i < 400; i++) run = advance(run, { ...HOLD, jumpRequested: i % 31 === 0 }, STEP)

    const before = worldOf(run)
    const paused = transition(run, { type: 'PAUSE' })
    expect(paused.state).toBe('PAUSED')
    expect(worldOf(paused)).toEqual(before)
  })

  it('however long the tab stays hidden, every value is untouched', () => {
    let run = startedRun(22)
    for (let i = 0; i < 300; i++) run = advance(run, HOLD, STEP)
    const paused = transition(run, { type: 'PAUSE' })
    const before = worldOf(paused)

    // Ten minutes of hidden time, delivered as ticks the loop should never have
    // made — and would not have made, since it stops accumulating while paused.
    let hidden = paused
    for (let i = 0; i < 36_000; i++) hidden = advance(hidden, { ...HOLD, jumpRequested: true }, STEP)

    expect(worldOf(hidden)).toEqual(before)
    expect(hidden.state).toBe('PAUSED')
  })

  it('a pause and resume leave the run on exactly the trajectory it was already on', () => {
    const timeline = Array.from({ length: 600 }, (_, i) => i % 23 === 0)

    let uninterrupted = startedRun(23)
    for (const jump of timeline) uninterrupted = advance(uninterrupted, { ...HOLD, jumpRequested: jump }, STEP)

    let interrupted = startedRun(23)
    timeline.forEach((jump, index) => {
      if (index === 200 || index === 401) {
        interrupted = transition(interrupted, { type: 'PAUSE' })
        // Held input is cleared on the way in, and hidden ticks do nothing.
        for (let i = 0; i < 500; i++) interrupted = advance(interrupted, HOLD, STEP)
        interrupted = transition(interrupted, { type: 'RESUME' })
      }
      interrupted = advance(interrupted, { ...HOLD, jumpRequested: jump }, STEP)
    })

    expect(worldOf(interrupted)).toEqual(worldOf(uninterrupted))
  })

  it('a pause requested mid-hit still costs no time — the lock resolves, then it pauses (§8)', () => {
    let run = startedRun(24)
    run = { ...run, obstacles: [{ id: 1, family: 'lowFence', x: 0, resolved: false }] }
    run = advance(run, HOLD, STEP)
    expect(run.state).toBe('HIT_REACTION')

    const queued = transition(run, { type: 'PAUSE' })
    expect(queued.state).toBe('HIT_REACTION')
    expect(worldOf(queued)).toEqual(worldOf(run))

    let resolving = queued
    while (resolving.state === 'HIT_REACTION') resolving = advance(resolving, HOLD, STEP)
    expect(resolving.state).toBe('PAUSED')

    const before = worldOf(resolving)
    for (let i = 0; i < 1_000; i++) resolving = advance(resolving, HOLD, STEP)
    expect(worldOf(resolving)).toEqual(before)
  })

  it('every non-active state is inert to a tick, not just PAUSED', () => {
    let run = startedRun(25)
    for (let i = 0; i < 120; i++) run = advance(run, HOLD, STEP)

    for (const state of ['READY', 'COUNTDOWN', 'PAUSED', 'GAME_OVER', 'RESULT'] as const) {
      const frozen: Run = { ...run, state }
      expect(advance(frozen, { ...HOLD, jumpRequested: true, duckHeld: true }, STEP)).toEqual(frozen)
    }
  })
})
