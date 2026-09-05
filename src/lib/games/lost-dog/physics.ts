/**
 * Fixed-step dog movement (jump/duck) and the frame-delta clamp/bounded-step
 * runner every tick goes through (spec 015 §7, §29; plan R5).
 *
 * Determinism, not realism, is the point: the same intent sequence at the
 * same fixed step always produces the same airtime/apex/duck timing,
 * independent of the caller's actual render frame rate.
 */

import { TUNING } from './config'

export interface DogPhysics {
  readonly grounded: boolean
  /** Elapsed time into the current jump; meaningful only while !grounded. A
   *  buffered jump can start a new jump with this at exactly 0 the same tick
   *  it lands, so `grounded` — not this value — is the airborne/grounded flag. */
  readonly airborneMs: number
  /** ms remaining that an early jump request stays valid; 0 = none pending. */
  readonly jumpBufferMs: number
  /** 0 (standing) .. 1 (fully ducked). */
  readonly duckProgress: number
}

export interface Intent {
  readonly jumpRequested: boolean
  readonly duckHeld: boolean
}

export function initialDogPhysics(): DogPhysics {
  return { grounded: true, airborneMs: 0, jumpBufferMs: 0, duckProgress: 0 }
}

export function isAirborne(dog: DogPhysics): boolean {
  return !dog.grounded
}

/**
 * A smooth 0..1 height fraction over the jump, peaking at TUNING.jump.apexFraction
 * of the airtime — anticipation, upward accel, apex, downward accel (§7). Never a
 * position snap and never frame-rate-dependent, since it is purely a function of
 * `airborneMs` (itself advanced only in fixed steps).
 */
export function jumpHeightFraction(dog: DogPhysics): number {
  if (!isAirborne(dog)) return 0
  const progress = dog.airborneMs / TUNING.jump.airtimeMs
  const apex = TUNING.jump.apexFraction
  // Two eased halves meeting at the apex, each reaching 1 at `apex`/`1-apex` respectively.
  if (progress <= apex) {
    const t = progress / apex
    return Math.sin((t * Math.PI) / 2)
  }
  const t = (progress - apex) / (1 - apex)
  return Math.cos((t * Math.PI) / 2)
}

export function stepDogPhysics(dog: DogPhysics, intent: Intent, dtMs: number): DogPhysics {
  const { jump, duck } = TUNING

  let grounded = dog.grounded
  let airborneMs = dog.airborneMs
  let jumpBufferMs = dog.jumpBufferMs

  if (!grounded) {
    const timeToLandMs = jump.airtimeMs - airborneMs
    if (intent.jumpRequested && timeToLandMs <= jump.bufferMs) {
      jumpBufferMs = jump.bufferMs
    }
    airborneMs += dtMs
    if (airborneMs >= jump.airtimeMs) {
      const overshootMs = airborneMs - jump.airtimeMs
      if (jumpBufferMs > 0) {
        // A buffered request fires the instant the dog lands, carrying any
        // overshoot from this same step into the new jump — still airborne
        // even when that overshoot is exactly 0.
        airborneMs = overshootMs
        jumpBufferMs = 0
      } else {
        grounded = true
        airborneMs = 0
      }
    }
  } else if (intent.jumpRequested) {
    grounded = false
    airborneMs = dtMs
  }

  const duckStep = duck.transitionMs > 0 ? dtMs / duck.transitionMs : 1
  const duckProgress = intent.duckHeld
    ? Math.min(1, dog.duckProgress + duckStep)
    : Math.max(0, dog.duckProgress - duckStep)

  return { grounded, airborneMs, jumpBufferMs, duckProgress }
}

export interface ClampedAdvanceResult<T> {
  readonly state: T
  /** Sub-fixed-step remainder to feed back into the next call. */
  readonly accumulator: number
  readonly stepsRun: number
}

/**
 * Clamps a real elapsed delta to `maxDeltaMs` (so a stalled tab or a debugger
 * pause cannot demand dozens of catch-up steps in one call — §7, §29), then
 * advances `step` through as many whole `fixedStepMs` increments as the
 * clamped delta plus any carried-over `accumulator` contain. The leftover
 * remainder is returned for the caller to carry into its next call, so no
 * time is silently dropped or double-counted across calls.
 */
export function advanceClamped<T>(
  state: T,
  realDeltaMs: number,
  step: (state: T, dtMs: number) => T,
  accumulator = 0,
  fixedStepMs: number = TUNING.frame.fixedStepMs,
  maxDeltaMs: number = TUNING.frame.maxDeltaMs,
): ClampedAdvanceResult<T> {
  // A tiny epsilon absorbs float rounding from repeated addition/subtraction
  // across calls (e.g. thirds of a fixed step) — without it, an accumulator
  // that should read exactly one fixed step can land a hair under it and
  // silently drop a step it earned.
  const EPSILON_MS = 1e-6
  const clampedDelta = Math.min(realDeltaMs, maxDeltaMs)
  let acc = accumulator + clampedDelta
  let next = state
  let stepsRun = 0
  while (acc >= fixedStepMs - EPSILON_MS) {
    next = step(next, fixedStepMs)
    acc -= fixedStepMs
    stepsRun++
  }
  return { state: next, accumulator: acc, stepsRun }
}
