import { describe, expect, it } from 'vitest'
import { createRng, deriveSeed } from '../rng'
import { initialDogPhysics } from './physics'
import { toSnapshot } from './snapshot'
import type { Run } from './types'

function makeRun(overrides: Partial<Run> = {}): Run {
  const runSeed = 42
  return {
    runSeed,
    gameplayRng: createRng(deriveSeed(runSeed, 'gameplay')),
    cosmeticRng: createRng(deriveSeed(runSeed, 'cosmetic')),
    state: 'RUNNING',
    pausedFrom: null,
    pauseQueued: false,
    elapsedActiveMs: 21_000,
    distance: 210,
    score: 1234,
    comboCount: 4,
    foodCollected: 4,
    bestComboCount: 4,
    hitsTaken: 0,
    pursuitGap: 40,
    msSinceLastHit: 1e9,
    hitReactionMs: 0,
    msSinceLanding: 1e9,
    msSinceEventEval: 0,
    shakeMs: 0,
    nextSpawnDistance: 0,
    nextEntityId: 1,
    weather: 'sunny',
    activeEvent: null,
    lastEventEndedAtMs: null,
    lastEventKind: null,
    dog: initialDogPhysics(),
    cat: { x: 0 },
    obstacles: [],
    food: [],
    particles: [],
    ...overrides,
  }
}

describe('toSnapshot', () => {
  it('projects the run into a read-only snapshot with derived band/multiplier/pursuit-band fields', () => {
    const run = makeRun()
    const snap = toSnapshot(run, 0.5)

    expect(snap.state).toBe('RUNNING')
    expect(snap.alpha).toBe(0.5)
    expect(snap.score).toBe(1234)
    expect(snap.comboMultiplier).toBe(2) // comboCount 4 -> x2 per §14
    expect(snap.pursuitBand).toBe('danger') // gap 40 -> danger per §9
    expect(snap.band.fromMs).toBe(20_000) // 21s elapsed -> band index 1
  })

  it('never exposes gameplayRng/cosmeticRng — the renderer/audio boundary (plan R6)', () => {
    const snap = toSnapshot(makeRun(), 0) as unknown as Record<string, unknown>
    expect(snap.gameplayRng).toBeUndefined()
    expect(snap.cosmeticRng).toBeUndefined()
  })

  it('carries the entity arrays through unchanged', () => {
    const obstacles = [{ id: 1, family: 'lowFence' as const, x: 100, resolved: false }]
    const snap = toSnapshot(makeRun({ obstacles }), 0)
    expect(snap.obstacles).toBe(obstacles)
  })
})
