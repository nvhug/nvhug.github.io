/**
 * The pure Run -> Snapshot projection (contracts/simulation.md). Every field
 * is read-only; the renderer and audio adapter receive only this, never Run
 * itself, so neither can reach `gameplayRng`/`cosmeticRng` or mutate state.
 */

import { bandForElapsed, catOffsetFor, comboMultiplierFor, pursuitBandFor } from './config'
import { instinctTarget } from './instinct'
import type { Run, Snapshot } from './types'

export function toSnapshot(run: Run, alpha: number): Snapshot {
  const band = bandForElapsed(run.elapsedActiveMs)
  return {
    state: run.state,
    alpha,
    elapsedActiveMs: run.elapsedActiveMs,
    distance: run.distance,
    score: run.score,
    // The band's combo cap (§10) clamps the threshold table's output, exactly
    // as combo.ts applies it when awarding points.
    comboMultiplier: Math.min(comboMultiplierFor(run.comboCount), band.comboCap) as 1 | 2 | 3 | 4 | 5,
    foodCollected: run.foodCollected,
    bestComboCount: run.bestComboCount,
    hitsTaken: run.hitsTaken,
    instinctTargetId: instinctTarget(run)?.id ?? null,
    pursuitGap: run.pursuitGap,
    pursuitBand: pursuitBandFor(run.pursuitGap),
    band,
    weather: run.weather,
    activeEvent: run.activeEvent,
    shakeMs: run.shakeMs,
    dog: run.dog,
    // The cat's rendered position is a pure function of the pursuit gap —
    // there is no `Run.cat` to read (see catOffsetFor's own doc for why).
    cat: { x: catOffsetFor(run.pursuitGap) },
    obstacles: run.obstacles,
    food: run.food,
    particles: run.particles,
  }
}
