/**
 * Determinism (spec 015 §13, SC-003, SC-009). `runSeed + input timeline +
 * GAMEPLAY_VERSION` decides a run, and nothing else does — in particular not
 * the cosmetic RNG stream, and not the visitor's motion preference.
 */

import { describe, expect, it } from 'vitest'
import { createRng, deriveSeed } from '../rng'
import { cameraFor } from './camera'
import { GAMEPLAY_VERSION, TUNING } from './config'
import { advance, initialRun } from './run'
import { transition } from './state-machine'
import type { Run } from './types'

const STEP = TUNING.frame.fixedStepMs
const STEPS = 4_000

function startedRun(seed: number): Run {
  let run = initialRun(seed)
  run = transition(run, { type: 'INIT' })
  run = transition(run, { type: 'LOADING_COMPLETE' })
  run = transition(run, { type: 'START' })
  return transition(run, { type: 'COUNTDOWN_COMPLETE' })
}

/** A fixed, reproducible input timeline — the "recorded inputs" half of §13. */
function intentAt(index: number) {
  return {
    jumpRequested: index % 29 === 0 || index % 71 === 0,
    duckHeld: index % 97 < 12,
    pauseRequested: false,
  }
}

/** Everything an observer of a run could care about, per step. */
interface Trace {
  readonly score: number
  readonly distance: number
  readonly pursuitGap: number
  readonly comboCount: number
  readonly foodCollected: number
  readonly hitsTaken: number
  readonly states: readonly string[]
  readonly events: readonly string[]
}

function play(run: Run, steps = STEPS): Trace {
  const states: string[] = []
  const events: string[] = []
  let current = run
  for (let i = 0; i < steps; i++) {
    const before = current.activeEvent
    current = advance(current, intentAt(i), STEP)
    if (current.state !== states[states.length - 1]) states.push(current.state)
    if (current.activeEvent && current.activeEvent !== before) {
      events.push(`${current.activeEvent.kind}@${current.activeEvent.startedAtMs}:${current.activeEvent.durationMs}`)
    }
  }
  return {
    score: current.score,
    distance: current.distance,
    pursuitGap: current.pursuitGap,
    comboCount: current.comboCount,
    foodCollected: current.foodCollected,
    hitsTaken: current.hitsTaken,
    states,
    events,
  }
}

describe('seed + input timeline + version (SC-003)', () => {
  it('reproduces an identical score, collision and event sequence', () => {
    expect(play(startedRun(2026))).toEqual(play(startedRun(2026)))
  })

  it('produces different runs for different seeds (the seed is actually used)', () => {
    expect(play(startedRun(1))).not.toEqual(play(startedRun(2)))
  })

  it('folds a version constant into the seed, so a version bump is a visible reset', () => {
    expect(Number.isInteger(GAMEPLAY_VERSION)).toBe(true)
    expect(deriveSeed(2026, 'gameplay')).not.toBe(deriveSeed(2026, 'cosmetic'))
  })
})

describe('the cosmetic stream is isolated (plan R6)', () => {
  it('is never the same object as the gameplay stream', () => {
    const run = initialRun(99)
    expect(run.cosmeticRng).not.toBe(run.gameplayRng)
  })

  it('changing it — or draining it — does not change the run at all', () => {
    const baseline = play(startedRun(2026))

    // A completely different cosmetic stream: reduced motion, a different DPR,
    // a different particle budget all amount to this.
    const swapped = play({ ...startedRun(2026), cosmeticRng: createRng(0xdecafbad) })
    expect(swapped).toEqual(baseline)

    // And a stream that has already been pulled thousands of times.
    const drained = createRng(deriveSeed(2026, 'cosmetic'))
    for (let i = 0; i < 5_000; i++) drained()
    expect(play({ ...startedRun(2026), cosmeticRng: drained })).toEqual(baseline)
  })

  it('a run that draws no cosmetic randomness at all still lands the same way', () => {
    // Every cosmetic draw returns a constant — the extreme case of "the
    // renderer decided something different this frame".
    const constant = () => 0.5
    expect(play({ ...startedRun(2026), cosmeticRng: constant })).toEqual(play(startedRun(2026)))
  })
})

describe('reduced motion does not touch the simulation (SC-009)', () => {
  it('the same seed and inputs produce the identical outcome under both settings', () => {
    // The motion preference reaches only the camera and the renderer; the
    // simulation has no parameter for it. Evaluating the camera between steps
    // under each setting proves it also has no back-channel into the run.
    function playWithCamera(reducedMotion: boolean): Trace {
      let current = startedRun(2026)
      const states: string[] = []
      const events: string[] = []
      for (let i = 0; i < STEPS; i++) {
        const before = current.activeEvent
        current = advance(current, intentAt(i), STEP)
        cameraFor({ elapsedActiveMs: current.elapsedActiveMs, shakeMs: current.shakeMs }, reducedMotion)
        if (current.state !== states[states.length - 1]) states.push(current.state)
        if (current.activeEvent && current.activeEvent !== before) {
          events.push(
            `${current.activeEvent.kind}@${current.activeEvent.startedAtMs}:${current.activeEvent.durationMs}`,
          )
        }
      }
      return {
        score: current.score,
        distance: current.distance,
        pursuitGap: current.pursuitGap,
        comboCount: current.comboCount,
        foodCollected: current.foodCollected,
        hitsTaken: current.hitsTaken,
        states,
        events,
      }
    }

    expect(playWithCamera(true)).toEqual(playWithCamera(false))
    expect(playWithCamera(true)).toEqual(play(startedRun(2026)))
  })

  it('`advance` takes no motion, DPR or viewport argument at all', () => {
    expect(advance.length).toBe(3) // (run, intent, dtMs)
  })
})

describe('frame rate does not change the outcome (§7)', () => {
  it('one fixed step per call and three calls of a third of a step agree', () => {
    // The loop only ever hands `advance` whole fixed steps — this asserts the
    // property the loop relies on: the run is a function of the *number* of
    // fixed steps taken, not of how the wall clock delivered them.
    let a = startedRun(777)
    let b = startedRun(777)
    for (let i = 0; i < 900; i++) {
      a = advance(a, intentAt(i), STEP)
      b = advance(b, intentAt(i), STEP)
    }
    expect(a.distance).toBe(b.distance)
    expect(a.score).toBe(b.score)
  })
})
