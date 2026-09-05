/**
 * The cat pursuit system (spec 015 §9): a normalized 0-100 gap, hit costs,
 * an invulnerability window, and time-gated recovery. Pure and generic over
 * any object carrying at least `PursuitSlice`'s two fields, the same pattern
 * state-machine.ts uses, so `Run` satisfies it without a circular import.
 */

import { TUNING } from './config'

export interface PursuitSlice {
  pursuitGap: number
  /** ms since the last hit landed; a large sentinel means "never hit yet". */
  msSinceLastHit: number
}

/** Large enough that no acceptance-scenario run ever reaches it; finite, so tickPursuit's
 *  arithmetic (which subtracts from it) never produces NaN the way Infinity - Infinity would. */
const NEVER_HIT_SENTINEL_MS = 1e9

export function initialPursuit(): PursuitSlice {
  return { pursuitGap: TUNING.pursuit.startGap, msSinceLastHit: NEVER_HIT_SENTINEL_MS }
}

/** A new collision may only apply once the invulnerability window has fully elapsed. */
export function canApplyHit(msSinceLastHit: number): boolean {
  return msSinceLastHit >= TUNING.hit.invulnerabilityMs
}

export function applyHit<T extends PursuitSlice>(run: T, kind: 'standard' | 'puddle'): T {
  if (!canApplyHit(run.msSinceLastHit)) return run
  const cost = TUNING.pursuit.hitCosts[kind]
  return { ...run, pursuitGap: Math.max(0, run.pursuitGap - cost), msSinceLastHit: 0 }
}

/**
 * Advances the invulnerability/recovery clock and applies recovery for
 * whatever portion of `dtMs` falls after the recovery delay has elapsed —
 * not the whole tick, if this tick is the one that crosses the threshold
 * (otherwise a single large tick straddling the boundary would over-grant
 * recovery for time still inside the delay window).
 */
export function tickPursuit<T extends PursuitSlice>(run: T, dtMs: number): T {
  const msBefore = run.msSinceLastHit
  const msSinceLastHit = msBefore + dtMs
  const { recoveryDelayMs, recoveryPerSecond } = TUNING.pursuit
  const recoverableMs =
    msSinceLastHit > recoveryDelayMs ? msSinceLastHit - Math.max(msBefore, recoveryDelayMs) : 0
  const recovered = (recoveryPerSecond * recoverableMs) / 1000
  const pursuitGap = Math.min(100, run.pursuitGap + recovered)
  return { ...run, pursuitGap, msSinceLastHit }
}
