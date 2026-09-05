/**
 * The analytics adapter (spec 015 §26; plan R14).
 *
 * **Delivery is deliberately not implemented.** §26 says that if no approved
 * telemetry path exists at IMPLEMENT time, analytics is instrumented locally
 * behind an adapter and server delivery is deferred rather than an endpoint
 * being created implicitly. Checked at IMPLEMENT: this repo's only telemetry is
 * `@vercel/analytics` and `@vercel/speed-insights` in `app/layout.tsx`, which
 * are page-view and Web-Vitals tools — there is no custom-event sink anywhere
 * in the codebase (no `track(` call site exists). So this is the deferred
 * branch: events are buffered in memory, `flushLostDogEvents()` hands the batch
 * to a caller that currently discards it, and **zero network requests** happen
 * at any point, during RUNNING or after.
 *
 * Two rules the shape enforces rather than documents:
 * - Only §26's eight event names are accepted; anything else is dropped.
 * - Only §26's coarse fields survive; the forbidden ones (run seed, raw input
 *   timeline, pointer coordinates, user-authored data, exact viewport) are
 *   stripped by an allow-list, so they cannot leak even by mistake later, when
 *   a delivery path does exist.
 */

import type { ObstacleFamily, PursuitBand } from '@/lib/games/lost-dog/config'
import type { DirectedEventKind } from '@/lib/games/lost-dog/types'

export type LostDogEventName =
  | 'lost_dog_started'
  | 'lost_dog_first_action'
  | 'lost_dog_food_collected'
  | 'lost_dog_hit'
  | 'lost_dog_event_triggered'
  | 'lost_dog_cat_catch'
  | 'lost_dog_completed'
  | 'lost_dog_replay'

const ALLOWED_NAMES: readonly LostDogEventName[] = [
  'lost_dog_started',
  'lost_dog_first_action',
  'lost_dog_food_collected',
  'lost_dog_hit',
  'lost_dog_event_triggered',
  'lost_dog_cat_catch',
  'lost_dog_completed',
  'lost_dog_replay',
]

/** §26's allowed fields, and nothing else. Jump/duck are aggregate counters in the post-run batch. */
export interface LostDogEventFields {
  gameplayVersion?: number
  inputMode?: 'keyboard' | 'touch'
  durationBucket?: string
  scoreBucket?: string
  difficultyBand?: number
  obstacleFamily?: ObstacleFamily
  eventKind?: DirectedEventKind
  pursuitBand?: PursuitBand
  jumpCount?: number
  duckCount?: number
}

const ALLOWED_FIELDS: readonly (keyof LostDogEventFields)[] = [
  'gameplayVersion',
  'inputMode',
  'durationBucket',
  'scoreBucket',
  'difficultyBand',
  'obstacleFamily',
  'eventKind',
  'pursuitBand',
  'jumpCount',
  'duckCount',
]

export interface LostDogEvent {
  readonly name: LostDogEventName
  readonly fields: LostDogEventFields
}

/** A run cannot grow the buffer without bound (§24's "no unbounded history"). */
export const ANALYTICS_BUFFER_LIMIT = 200

let buffer: LostDogEvent[] = []

export function durationBucket(ms: number): string {
  if (ms < 30_000) return '<30s'
  if (ms < 60_000) return '30-60s'
  if (ms < 120_000) return '1-2m'
  if (ms < 180_000) return '2-3m'
  return '3m+'
}

export function scoreBucket(score: number): string {
  if (score < 500) return '0-500'
  if (score < 1_500) return '500-1500'
  if (score < 3_000) return '1500-3000'
  if (score < 5_000) return '3000-5000'
  return '5000+'
}

export function trackLostDogEvent(name: LostDogEventName, fields: LostDogEventFields): void {
  if (!ALLOWED_NAMES.includes(name)) return

  const clean: LostDogEventFields = {}
  for (const key of ALLOWED_FIELDS) {
    const value = fields[key]
    if (value !== undefined) Object.assign(clean, { [key]: value })
  }

  // Oldest first: a long run keeps its most recent behaviour, which is the
  // half a difficulty-tuning question is about.
  if (buffer.length >= ANALYTICS_BUFFER_LIMIT) buffer.shift()
  buffer.push({ name, fields: clean })
}

/** Read-only view, for tests and for a future delivery path. */
export function bufferedLostDogEvents(): readonly LostDogEvent[] {
  return buffer
}

/**
 * Drains the batch. Today the caller has nowhere to send it, so the events are
 * simply dropped — the point of flushing anyway is that a finished run never
 * gets counted twice once a delivery path does exist.
 */
export function flushLostDogEvents(): LostDogEvent[] {
  const batch = buffer
  buffer = []
  return batch
}

export function resetLostDogAnalytics(): void {
  buffer = []
}
