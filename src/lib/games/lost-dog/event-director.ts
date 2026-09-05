/**
 * The directed-event director (spec 015 §15). Two events ship in Release 1 —
 * a rain shower and a friendly food bonus — and the whole point of this module
 * is that *when* they fire is a pure function of run state plus the gameplay
 * RNG stream, never a timer.
 *
 * It consumes only `gameplayRng`. The cosmetic stream is not in `EventSlice`
 * at all, so a renderer or audio decision structurally cannot perturb which
 * event fires or how long it lasts (plan R6).
 */

import type { Rng } from '../rng'
import { TUNING, bandForElapsed, pursuitBandFor } from './config'
import type { GameState } from './state-machine'
import { rainDurationMs } from './weather'
import type { DirectedEvent, DirectedEventKind } from './types'

export type IneligibilityReason =
  | 'transactionActive'
  | 'runTooYoung'
  | 'eventActive'
  | 'cooldown'
  | 'bandDisallows'
  | 'notDueYet'

export interface EventDecision {
  readonly event: DirectedEvent | null
  /** Why nothing fired, per §15's "records the reason when no event is eligible". */
  readonly reason: IneligibilityReason | null
}

export interface EventSlice {
  state: GameState
  elapsedActiveMs: number
  pursuitGap: number
  activeEvent: DirectedEvent | null
  lastEventEndedAtMs: number | null
  lastEventKind: DirectedEventKind | null
  gameplayRng: Rng
}

/** Events only fire while the dog is actually running; a hit/catch transaction blocks them (§15). */
const ACTIVE_STATES: readonly GameState[] = ['RUNNING', 'CAT_WARNING', 'CAT_CHASE']

/**
 * Chance of firing per evaluation once every eligibility rule has passed. It
 * exists so an event does not detonate the exact instant its cooldown expires
 * on every single run — the timing varies, and varies *seeded*, which a plain
 * "fire when eligible" rule could not do.
 */
const TRIGGER_CHANCE = 0.25

function allowedKinds(slice: EventSlice): DirectedEventKind[] {
  const band = bandForElapsed(slice.elapsedActiveMs)
  const byBand: DirectedEventKind[] =
    band.eventsAllowed === 'none'
      ? []
      : band.eventsAllowed === 'either'
        ? ['rainShower', 'foodBonus']
        : band.eventsAllowed === 'rain'
          ? ['rainShower']
          : ['foodBonus']

  const pursuitBand = pursuitBandFor(slice.pursuitGap)
  const underPressure = pursuitBand === 'danger' || pursuitBand === 'critical'

  return byBand.filter((kind) => {
    // No back-to-back repeat of the same event (§29).
    if (kind === slice.lastEventKind) return false
    // Rain raises difficulty, so it is additionally ineligible under pressure (§15).
    if (kind === 'rainShower' && underPressure) return false
    return true
  })
}

function weightFor(kind: DirectedEventKind): number {
  return TUNING.events.weights[kind]
}

function pickKind(rng: Rng, kinds: readonly DirectedEventKind[]): DirectedEventKind {
  const total = kinds.reduce((sum, kind) => sum + weightFor(kind), 0)
  let roll = rng() * total
  for (const kind of kinds) {
    roll -= weightFor(kind)
    if (roll < 0) return kind
  }
  return kinds[kinds.length - 1]
}

export function evaluateEvents(slice: EventSlice): EventDecision {
  if (!ACTIVE_STATES.includes(slice.state)) return { event: null, reason: 'transactionActive' }
  if (slice.elapsedActiveMs < TUNING.events.minRunAgeMs) return { event: null, reason: 'runTooYoung' }
  if (slice.activeEvent) return { event: null, reason: 'eventActive' }
  if (
    slice.lastEventEndedAtMs !== null &&
    slice.elapsedActiveMs - slice.lastEventEndedAtMs < TUNING.events.minCooldownMs
  ) {
    return { event: null, reason: 'cooldown' }
  }

  const kinds = allowedKinds(slice)
  if (kinds.length === 0) return { event: null, reason: 'bandDisallows' }

  // The roll happens after every cheaper check, so an ineligible evaluation
  // never consumes the gameplay stream — eligibility stays a pure predicate.
  if (slice.gameplayRng() >= TRIGGER_CHANCE) return { event: null, reason: 'notDueYet' }

  const kind = pickKind(slice.gameplayRng, kinds)
  const durationMs =
    kind === 'rainShower' ? rainDurationMs(slice.gameplayRng) : TUNING.events.foodBonusDurationSec * 1000

  return { event: { kind, startedAtMs: slice.elapsedActiveMs, durationMs }, reason: null }
}
