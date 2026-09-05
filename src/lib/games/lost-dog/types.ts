/**
 * The Run/Snapshot/Intent shapes from contracts/simulation.md. Kept as one
 * file so every pure module in this feature imports the same identities
 * instead of re-declaring structurally-similar types.
 */

import type { Rng } from '../rng'
import type { DifficultyBand, FoodKind, ObstacleFamily, PursuitBand } from './config'
import type { DogPhysics } from './physics'
import type { GameState } from './state-machine'

export type { PursuitBand }
export type Weather = 'sunny' | 'rain'
export type DirectedEventKind = 'rainShower' | 'foodBonus'

export interface DirectedEvent {
  readonly kind: DirectedEventKind
  readonly startedAtMs: number
  readonly durationMs: number
}

export interface Obstacle {
  readonly id: number
  readonly family: ObstacleFamily
  /** World-space x position; the world scrolls under a stationary dog lane. */
  readonly x: number
  readonly resolved: boolean
}

export interface Food {
  readonly id: number
  readonly kind: FoodKind
  readonly x: number
  readonly collected: boolean
}

/**
 * A cosmetic chain-reaction fragment (§16): a knocked bin lid, a rolling can.
 * It is drawn and nothing else — collision.ts never reads this array, so a
 * particle structurally cannot become a collider, move the pursuit gap or
 * award score. Its jitter comes from the cosmetic RNG stream only.
 */
export interface Particle {
  readonly id: number
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly ageMs: number
  readonly maxAgeMs: number
}

export interface CatState {
  readonly x: number
}

/** The pure, framework-free run state. Never touched by the renderer/audio adapter directly — they read only Snapshot. */
export interface Run {
  readonly runSeed: number
  readonly gameplayRng: Rng
  readonly cosmeticRng: Rng
  readonly state: GameState
  readonly pausedFrom: 'RUNNING' | 'CAT_WARNING' | 'CAT_CHASE' | null
  readonly pauseQueued: boolean
  readonly elapsedActiveMs: number
  readonly distance: number
  readonly score: number
  readonly comboCount: number
  readonly foodCollected: number
  readonly bestComboCount: number
  readonly hitsTaken: number
  readonly pursuitGap: number
  /** ms since the last hit landed; see pursuit.ts's sentinel for "never hit yet". */
  readonly msSinceLastHit: number
  /** Elapsed time in the current HIT_REACTION lock; 0 outside that state. */
  readonly hitReactionMs: number
  /** ms since the dog last touched down; drives rain's post-landing handling factor (§15). */
  readonly msSinceLanding: number
  /** ms since the event director last evaluated; it runs on a fixed interval, not every step (§15). */
  readonly msSinceEventEval: number
  /** ms remaining of the collision camera shake; presentation only, never a world coordinate (§18). */
  readonly shakeMs: number
  /** World-distance at which the next spawn is due. */
  readonly nextSpawnDistance: number
  /** Monotonic counter for assigning obstacle/food ids deterministically. */
  readonly nextEntityId: number
  readonly weather: Weather
  readonly activeEvent: DirectedEvent | null
  readonly lastEventEndedAtMs: number | null
  /** The previous event's kind, so the director can refuse a back-to-back repeat (§29). */
  readonly lastEventKind: DirectedEventKind | null
  readonly dog: DogPhysics
  // No `cat` field here on purpose: the cat's rendered position is a pure
  // function of `pursuitGap` (config.ts's `catOffsetFor`), computed fresh in
  // `toSnapshot` — there is nothing about it to store or mutate per tick.
  readonly obstacles: readonly Obstacle[]
  readonly food: readonly Food[]
  readonly particles: readonly Particle[]
}

export interface Intent {
  readonly jumpRequested: boolean
  readonly duckHeld: boolean
  readonly pauseRequested: boolean
}

export interface Snapshot {
  readonly state: GameState
  readonly alpha: number
  readonly elapsedActiveMs: number
  readonly distance: number
  readonly score: number
  readonly comboMultiplier: 1 | 2 | 3 | 4 | 5
  readonly foodCollected: number
  readonly bestComboCount: number
  readonly hitsTaken: number
  /** The food the instinct cue points at this frame, or null (instinct.ts — a pure read). */
  readonly instinctTargetId: number | null
  readonly pursuitGap: number
  readonly pursuitBand: PursuitBand
  readonly band: DifficultyBand
  readonly weather: Weather
  readonly activeEvent: DirectedEvent | null
  /** Presentation-only shake budget left this frame (§18); never a world coordinate. */
  readonly shakeMs: number
  readonly dog: DogPhysics
  readonly cat: CatState
  readonly obstacles: readonly Obstacle[]
  readonly food: readonly Food[]
  readonly particles: readonly Particle[]
}
