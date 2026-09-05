import { beforeEach, describe, expect, it } from 'vitest'
import {
  ANALYTICS_BUFFER_LIMIT,
  bufferedLostDogEvents,
  durationBucket,
  flushLostDogEvents,
  resetLostDogAnalytics,
  scoreBucket,
  trackLostDogEvent,
} from './track'

beforeEach(() => {
  resetLostDogAnalytics()
})

describe('durationBucket / scoreBucket (§26 — coarse fields only)', () => {
  it('reports a bucket, never the raw value', () => {
    expect(durationBucket(0)).toBe('<30s')
    expect(durationBucket(29_999)).toBe('<30s')
    expect(durationBucket(30_000)).toBe('30-60s')
    expect(durationBucket(75_000)).toBe('1-2m')
    expect(durationBucket(150_000)).toBe('2-3m')
    expect(durationBucket(600_000)).toBe('3m+')
  })

  it('buckets scores the same way', () => {
    expect(scoreBucket(0)).toBe('0-500')
    expect(scoreBucket(499)).toBe('0-500')
    expect(scoreBucket(500)).toBe('500-1500')
    expect(scoreBucket(2_000)).toBe('1500-3000')
    expect(scoreBucket(4_000)).toBe('3000-5000')
    expect(scoreBucket(99_999)).toBe('5000+')
  })
})

describe('trackLostDogEvent', () => {
  it('buffers in memory and sends nothing — there is no delivery path (§26, plan R14)', () => {
    trackLostDogEvent('lost_dog_started', { gameplayVersion: 1, inputMode: 'keyboard' })
    expect(bufferedLostDogEvents()).toHaveLength(1)
    expect(bufferedLostDogEvents()[0].name).toBe('lost_dog_started')
  })

  it('drops every field that is not on §26\'s allowed list', () => {
    trackLostDogEvent('lost_dog_hit', {
      pursuitBand: 'danger',
      obstacleFamily: 'bicycle',
      // Everything below is explicitly forbidden and must not survive.
      runSeed: 12345,
      pointerX: 300,
      viewport: '390x844',
      note: 'user authored text',
    } as never)

    const [event] = bufferedLostDogEvents()
    expect(event.fields).toEqual({ pursuitBand: 'danger', obstacleFamily: 'bicycle' })
    expect(Object.keys(event.fields)).not.toContain('runSeed')
  })

  it('ignores a name that is not one of the eight allowed ones', () => {
    trackLostDogEvent('lost_dog_secretly_added' as never, {})
    expect(bufferedLostDogEvents()).toHaveLength(0)
  })

  it('is a bounded buffer — a long run cannot grow it without limit (§24)', () => {
    for (let i = 0; i < ANALYTICS_BUFFER_LIMIT * 3; i++) {
      trackLostDogEvent('lost_dog_food_collected', { difficultyBand: 2 })
    }
    expect(bufferedLostDogEvents()).toHaveLength(ANALYTICS_BUFFER_LIMIT)
  })
})

describe('flushLostDogEvents', () => {
  it('returns the batch and empties the buffer, so a run is never counted twice', () => {
    trackLostDogEvent('lost_dog_started', {})
    trackLostDogEvent('lost_dog_completed', { scoreBucket: '1500-3000' })

    const batch = flushLostDogEvents()
    expect(batch).toHaveLength(2)
    expect(bufferedLostDogEvents()).toHaveLength(0)
    expect(flushLostDogEvents()).toHaveLength(0)
  })
})
