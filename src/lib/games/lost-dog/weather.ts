/**
 * Weather (spec 015 §15). Rain changes exactly one thing in the simulation —
 * how quickly horizontal speed recovers after a landing — and everything else
 * about it is presentation.
 *
 * What rain must NOT change is the point of this module's shape: jump impulse,
 * gravity, input latency and collision dimensions all live in physics.ts and
 * collision.ts, neither of which takes a `Weather` argument or imports this
 * file. The dependency direction is the guarantee; weather.test.ts asserts it.
 */

import type { Rng } from '../rng'
import { TUNING } from './config'
import type { DirectedEvent, Weather } from './types'

export type { Weather }

export interface WeatherSlice {
  weather: Weather
}

/**
 * The horizontal-recovery factor to apply to world speed this step: 0.92 in
 * rain for the first `landingRecoveryMs` after touching down, 1.00 everywhere
 * else (§15).
 */
export function handlingFactorFor(weather: Weather, msSinceLanding: number): number {
  if (weather !== 'rain') return 1
  return msSinceLanding < TUNING.weather.landingRecoveryMs ? TUNING.weather.rainHandlingFactor : 1
}

/** Seeded shower length inside §15's 18-25 second window. */
export function rainDurationMs(rng: Rng): number {
  const { rainDurationMinSec, rainDurationMaxSec } = TUNING.events
  return Math.round((rainDurationMinSec + rng() * (rainDurationMaxSec - rainDurationMinSec)) * 1000)
}

/**
 * The weather implied by the active event. Weather is derived, not stored as a
 * second source of truth, so a shower can never outlive its own event or end
 * early — it reverts exactly when the event's seeded duration elapses (§15).
 */
export function weatherForEvent(event: DirectedEvent | null, elapsedActiveMs: number): Weather {
  if (!event || event.kind !== 'rainShower') return 'sunny'
  const ended = elapsedActiveMs >= event.startedAtMs + event.durationMs
  return elapsedActiveMs >= event.startedAtMs && !ended ? 'rain' : 'sunny'
}

export function applyWeather<T extends WeatherSlice>(slice: T, weather: Weather): T {
  return { ...slice, weather }
}

/**
 * The extra landing slide rain adds (§15). Purely presentational — the renderer
 * may hold the landing-squash pose this much longer; nothing in the simulation
 * reads it, which is why it returns one fixed value rather than a seeded one.
 */
export function landingSlideExtraMs(weather: Weather): number {
  if (weather !== 'rain') return 0
  const [min, max] = TUNING.weather.rainLandingSlideExtraMs
  return (min + max) / 2
}
