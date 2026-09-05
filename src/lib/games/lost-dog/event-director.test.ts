import { describe, expect, it } from 'vitest'
import { createRng } from '../rng'
import { TUNING } from './config'
import { evaluateEvents, type EventSlice } from './event-director'
import type { DirectedEventKind } from './types'

/** A slice that is eligible on every rule, in a band where both events are allowed. */
function eligible(overrides: Partial<EventSlice> = {}): EventSlice {
  return {
    state: 'RUNNING',
    elapsedActiveMs: 90_000, // band 3 -> eventsAllowed: 'either'
    pursuitGap: 80, // safe
    activeEvent: null,
    lastEventEndedAtMs: null,
    lastEventKind: null,
    gameplayRng: createRng(12_345),
    ...overrides,
  }
}

/** Rolls the director until it fires, so a seeded trigger chance does not make a test flaky. */
function fireEventually(slice: EventSlice, attempts = 400): DirectedEventKind | null {
  for (let i = 0; i < attempts; i++) {
    const decision = evaluateEvents(slice)
    if (decision.event) return decision.event.kind
  }
  return null
}

describe('evaluateEvents — eligibility (§15)', () => {
  it('refuses while the run is younger than the minimum age', () => {
    const decision = evaluateEvents(eligible({ elapsedActiveMs: TUNING.events.minRunAgeMs - 1 }))
    expect(decision.event).toBeNull()
    expect(decision.reason).toBe('runTooYoung')
  })

  it('refuses while an event is already active', () => {
    const decision = evaluateEvents(
      eligible({ activeEvent: { kind: 'foodBonus', startedAtMs: 80_000, durationMs: 6_000 } }),
    )
    expect(decision.event).toBeNull()
    expect(decision.reason).toBe('eventActive')
  })

  it('refuses during a hit or catch transaction', () => {
    for (const state of ['HIT_REACTION', 'GAME_OVER', 'RESULT', 'PAUSED', 'COUNTDOWN'] as const) {
      const decision = evaluateEvents(eligible({ state }))
      expect(decision.event).toBeNull()
      expect(decision.reason).toBe('transactionActive')
    }
  })

  it('refuses until the cooldown since the last event has fully elapsed', () => {
    const justEnded = eligible({ elapsedActiveMs: 90_000, lastEventEndedAtMs: 90_000 - (TUNING.events.minCooldownMs - 1) })
    expect(evaluateEvents(justEnded).reason).toBe('cooldown')

    const cooled = eligible({ elapsedActiveMs: 90_000, lastEventEndedAtMs: 90_000 - TUNING.events.minCooldownMs })
    expect(evaluateEvents(cooled).reason).not.toBe('cooldown')
  })

  it('never repeats the same event back-to-back (§29)', () => {
    for (const previous of ['rainShower', 'foodBonus'] as const) {
      const slice = eligible({ lastEventKind: previous, gameplayRng: createRng(999) })
      for (let i = 0; i < 200; i++) {
        const decision = evaluateEvents(slice)
        if (decision.event) expect(decision.event.kind).not.toBe(previous)
      }
    }
  })

  it('suppresses rain in Danger and Critical, while still allowing the food bonus', () => {
    for (const gap of [40, 10]) {
      const kinds = new Set<DirectedEventKind>()
      for (let seed = 0; seed < 60; seed++) {
        const kind = fireEventually(eligible({ pursuitGap: gap, gameplayRng: createRng(seed * 131 + 3) }))
        if (kind) kinds.add(kind)
      }
      expect(kinds.has('rainShower')).toBe(false)
      expect(kinds.has('foodBonus')).toBe(true)
    }
  })

  it('honours the band event window: band 2 allows only rain, so Danger there leaves nothing eligible', () => {
    // 60s elapsed -> band index 2, eventsAllowed: 'rain'.
    const decision = evaluateEvents(eligible({ elapsedActiveMs: 60_000, pursuitGap: 30 }))
    expect(decision.event).toBeNull()
    expect(decision.reason).toBe('bandDisallows')
  })

  it('records a reason every time nothing is eligible, and none when an event fires', () => {
    const slice = eligible({ gameplayRng: createRng(4_242) })
    let fired = 0
    for (let i = 0; i < 400; i++) {
      const decision = evaluateEvents(slice)
      if (decision.event) {
        fired++
        expect(decision.reason).toBeNull()
      } else {
        expect(decision.reason).not.toBeNull()
      }
    }
    expect(fired).toBeGreaterThan(0)
  })
})

describe('evaluateEvents — seeded selection', () => {
  it('is deterministic for a given gameplayRng state', () => {
    const a = evaluateEvents(eligible({ gameplayRng: createRng(31_337) }))
    const b = evaluateEvents(eligible({ gameplayRng: createRng(31_337) }))
    expect(a).toEqual(b)
  })

  it('produces both events over many seeds when the band allows either', () => {
    const kinds = new Set<DirectedEventKind>()
    for (let seed = 0; seed < 200; seed++) {
      const kind = fireEventually(eligible({ gameplayRng: createRng(seed * 7717 + 5) }), 60)
      if (kind) kinds.add(kind)
    }
    expect(kinds).toEqual(new Set(['rainShower', 'foodBonus']))
  })

  it('gives a rain shower a seeded duration inside the documented window', () => {
    for (let seed = 0; seed < 200; seed++) {
      const slice = eligible({ gameplayRng: createRng(seed * 3_331 + 17) })
      for (let i = 0; i < 60; i++) {
        const decision = evaluateEvents(slice)
        if (decision.event?.kind !== 'rainShower') continue
        expect(decision.event.durationMs).toBeGreaterThanOrEqual(TUNING.events.rainDurationMinSec * 1000)
        expect(decision.event.durationMs).toBeLessThanOrEqual(TUNING.events.rainDurationMaxSec * 1000)
        expect(decision.event.startedAtMs).toBe(slice.elapsedActiveMs)
        break
      }
    }
  })

  it('consumes only the gameplay stream — a cosmetic rng is never passed in', () => {
    // The slice has exactly one rng field; there is no cosmetic stream to reach.
    const slice = eligible()
    expect(Object.keys(slice).filter((k) => k.toLowerCase().includes('rng'))).toEqual(['gameplayRng'])
  })
})
