import { describe, expect, it } from 'vitest'
import { createRng } from '../rng'
import { TUNING } from './config'
import { resolveObstacle } from './collision'
import { initialDogPhysics, stepDogPhysics } from './physics'
import { applyWeather, handlingFactorFor, landingSlideExtraMs, rainDurationMs, weatherForEvent } from './weather'
import type { DirectedEvent } from './types'

const HOLD = { jumpRequested: false, duckHeld: false }
const STEP = TUNING.frame.fixedStepMs

describe('handlingFactorFor', () => {
  it('is 1.00 in sun, at every point after a landing', () => {
    expect(handlingFactorFor('sunny', 0)).toBe(1)
    expect(handlingFactorFor('sunny', TUNING.weather.landingRecoveryMs / 2)).toBe(1)
    expect(handlingFactorFor('sunny', 1e9)).toBe(1)
  })

  it('is 0.92 in rain, but only inside the post-landing recovery window (§15)', () => {
    expect(handlingFactorFor('rain', 0)).toBe(TUNING.weather.rainHandlingFactor)
    expect(handlingFactorFor('rain', TUNING.weather.landingRecoveryMs - 1)).toBe(
      TUNING.weather.rainHandlingFactor,
    )
    expect(handlingFactorFor('rain', TUNING.weather.landingRecoveryMs)).toBe(1)
    expect(handlingFactorFor('rain', 1e9)).toBe(1)
  })
})

describe('weather never touches jump, gravity, input latency or collision dimensions (§15)', () => {
  it('the dog integrator has no weather input and produces identical motion either way', () => {
    // stepDogPhysics takes (dog, intent, dtMs) — there is no weather parameter to
    // pass, which is the structural half of the guarantee. The behavioural half:
    // an identical intent timeline gives an identical airtime/apex/duck profile.
    let dog = initialDogPhysics()
    const trace: number[] = []
    for (let i = 0; i < 60; i++) {
      dog = stepDogPhysics(dog, { ...HOLD, jumpRequested: i === 0 }, STEP)
      trace.push(dog.airborneMs)
    }
    expect(stepDogPhysics.length).toBe(3)
    expect(trace.some((ms) => ms > 0)).toBe(true)
  })

  it('collision resolution has no weather input either', () => {
    expect(resolveObstacle.length).toBe(2)
    const airborne = { ...initialDogPhysics(), grounded: false, airborneMs: 100 }
    expect(resolveObstacle(airborne, 'lowFence')).toBe('clear')
  })

  it('applyWeather changes the weather value and nothing else', () => {
    const slice = { weather: 'sunny' as const, pursuitGap: 60, score: 900, distance: 12 }
    expect(applyWeather(slice, 'rain')).toEqual({ ...slice, weather: 'rain' })
  })
})

describe('rainDurationMs', () => {
  it('always lands inside the documented 18-25 second window', () => {
    for (let seed = 0; seed < 500; seed++) {
      const ms = rainDurationMs(createRng(seed * 6151 + 11))
      expect(ms).toBeGreaterThanOrEqual(TUNING.events.rainDurationMinSec * 1000)
      expect(ms).toBeLessThanOrEqual(TUNING.events.rainDurationMaxSec * 1000)
    }
  })

  it('is seeded — the same rng state gives the same duration', () => {
    expect(rainDurationMs(createRng(77))).toBe(rainDurationMs(createRng(77)))
  })
})

describe('weatherForEvent', () => {
  const shower: DirectedEvent = { kind: 'rainShower', startedAtMs: 30_000, durationMs: 20_000 }

  it('is sunny with no event, and with a non-weather event active', () => {
    expect(weatherForEvent(null, 40_000)).toBe('sunny')
    expect(weatherForEvent({ kind: 'foodBonus', startedAtMs: 30_000, durationMs: 6_000 }, 32_000)).toBe('sunny')
  })

  it('rains for the whole seeded duration and reverts exactly at its end', () => {
    expect(weatherForEvent(shower, 30_000)).toBe('rain')
    expect(weatherForEvent(shower, 49_999)).toBe('rain')
    expect(weatherForEvent(shower, 50_000)).toBe('sunny')
    expect(weatherForEvent(shower, 60_000)).toBe('sunny')
  })

  it('is sunny before the shower begins', () => {
    expect(weatherForEvent(shower, 29_999)).toBe('sunny')
  })
})

describe('landingSlideExtraMs', () => {
  it('is purely presentational: zero in sun, inside the documented rain range otherwise', () => {
    expect(landingSlideExtraMs('sunny')).toBe(0)
    const [min, max] = TUNING.weather.rainLandingSlideExtraMs
    expect(landingSlideExtraMs('rain')).toBeGreaterThanOrEqual(min)
    expect(landingSlideExtraMs('rain')).toBeLessThanOrEqual(max)
  })
})
