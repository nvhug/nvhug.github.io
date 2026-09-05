/**
 * The dog's instinct cue (spec 015 §14's signature mechanic): a **read-only**
 * answer to "which food is the dog currently noticing".
 *
 * It never steers, jumps, changes speed or guarantees safety — nothing here
 * returns a new run state, and `run.ts` never calls it. The projection in
 * snapshot.ts is its only consumer, so the cue can only ever reach the
 * renderer, never the simulation.
 */

import { TUNING } from './config'
import type { GameState } from './state-machine'
import type { Food } from './types'

export interface InstinctSlice {
  state: GameState
  food: readonly Food[]
}

/** The cue exists only while the dog is actually running (§14 suppresses it during hit/catch). */
const ACTIVE_STATES: readonly GameState[] = ['RUNNING', 'CAT_WARNING', 'CAT_CHASE']

export function instinctTarget(run: InstinctSlice): Food | null {
  if (!ACTIVE_STATES.includes(run.state)) return null

  let best: Food | null = null
  for (const item of run.food) {
    // Behind or level with the dog is no longer safe to advertise; beyond the
    // range is outside the clear look-ahead zone.
    if (item.collected || item.x <= 0 || item.x > TUNING.instinct.rangeUnits) continue
    if (best === null || item.x < best.x) best = item
  }
  return best
}
