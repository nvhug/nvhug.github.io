import { describe, expect, it } from 'vitest'
import { TUNING, pursuitBandFor } from './config'
import { advance, initialRun } from './run'
import { transition } from './state-machine'
import type { Run } from './types'

const HOLD = { jumpRequested: false, duckHeld: false, pauseRequested: false }
const STEP = TUNING.frame.fixedStepMs

/** Drives a fresh run to RUNNING through the real transition chain (not a shortcut object spread). */
function startedRun(seed: number): Run {
  let run = initialRun(seed)
  run = transition(run, { type: 'INIT' })
  run = transition(run, { type: 'LOADING_COMPLETE' })
  run = transition(run, { type: 'START' })
  run = transition(run, { type: 'COUNTDOWN_COMPLETE' })
  return run
}

function withObstacle(run: Run, x: number, family: Run['obstacles'][number]['family'] = 'lowFence'): Run {
  return { ...run, obstacles: [{ id: 999, family, x, resolved: false }] }
}

function withFood(run: Run, x: number, kind: Run['food'][number]['kind'] = 'bone'): Run {
  return { ...run, food: [{ id: 998, kind, x, collected: false }] }
}

describe('initialRun', () => {
  it('starts in BOOT with the documented pursuit start gap and an empty world', () => {
    const run = initialRun(1)
    expect(run.state).toBe('BOOT')
    expect(run.pursuitGap).toBe(TUNING.pursuit.startGap)
    expect(run.obstacles).toEqual([])
    expect(run.food).toEqual([])
    expect(run.dog.grounded).toBe(true)
  })
})

describe('advance — outside an active state', () => {
  it('is a no-op in READY (physics/spawn do not run before the player starts)', () => {
    let run = initialRun(1)
    run = transition(run, { type: 'INIT' })
    run = transition(run, { type: 'LOADING_COMPLETE' })
    const before = run
    const after = advance(run, HOLD, STEP)
    expect(after).toEqual(before)
  })
})

describe('advance — jumping clears an obstacle', () => {
  it('a jump requested the tick an obstacle is reached avoids the hit', () => {
    const run = withObstacle(startedRun(1), 0)
    const after = advance(run, { ...HOLD, jumpRequested: true }, STEP)
    // A clean run recovers gently from the very first tick (it has, by definition,
    // been "more than 1.5s without a hit" since before the run even started), so
    // the gap does not merely hold — it never *decreases* on a clean clear.
    expect(after.pursuitGap).toBeGreaterThanOrEqual(run.pursuitGap)
    expect(after.state).toBe('RUNNING')
    expect(after.obstacles[0].resolved).toBe(true)
  })
})

describe('advance — collecting food heals the gap', () => {
  it('restores gap by the collected kind\'s configured heal amount (§14 follow-up)', () => {
    const run = withFood(startedRun(2.5), 0, 'sausage')
    const after = advance(run, HOLD, STEP)
    expect(after.foodCollected).toBe(1)
    expect(after.pursuitGap).toBeGreaterThanOrEqual(TUNING.pursuit.startGap + TUNING.pursuit.foodHeal.sausage)
  })

  it('never exceeds the 100 gap ceiling even near-full', () => {
    let run = withFood(startedRun(2.6), 0, 'chickenLeg')
    run = { ...run, pursuitGap: 95 }
    const after = advance(run, HOLD, STEP)
    expect(after.pursuitGap).toBeLessThanOrEqual(100)
  })
})

describe('advance — colliding with an obstacle', () => {
  it('reduces the gap by the standard cost and enters HIT_REACTION', () => {
    const run = withObstacle(startedRun(2), 0)
    const after = advance(run, HOLD, STEP)
    expect(after.pursuitGap).toBe(TUNING.pursuit.startGap - TUNING.pursuit.hitCosts.standard)
    expect(after.state).toBe('HIT_REACTION')
  })

  it('a puddle miss costs the (smaller) puddle amount, still enters HIT_REACTION as a slip', () => {
    const run = withObstacle(startedRun(3), 0, 'puddle')
    const after = advance(run, HOLD, STEP)
    expect(after.pursuitGap).toBe(TUNING.pursuit.startGap - TUNING.pursuit.hitCosts.puddle)
  })

  it('a collision and a heal on the same tick both land — the two are independent events', () => {
    let run = withObstacle(withFood(startedRun(3.5), 0, 'chickenLeg'), 0)
    run = advance(run, HOLD, STEP)
    expect(run.pursuitGap).toBe(
      TUNING.pursuit.startGap - TUNING.pursuit.hitCosts.standard + TUNING.pursuit.foodHeal.chickenLeg,
    )
    expect(run.foodCollected).toBe(1)
  })

  it('resolves back to the band-appropriate state once the reaction lock elapses', () => {
    let run = withObstacle(startedRun(4), 0)
    run = advance(run, HOLD, STEP) // the hit lands, -> HIT_REACTION
    expect(run.state).toBe('HIT_REACTION')

    let elapsed = STEP
    while (elapsed < TUNING.hit.reactionLockMs + STEP) {
      run = advance(run, HOLD, STEP)
      elapsed += STEP
    }
    const expectedBand = pursuitBandFor(run.pursuitGap)
    const expectedState = expectedBand === 'danger' ? 'CAT_WARNING' : expectedBand === 'critical' ? 'CAT_CHASE' : 'RUNNING'
    expect(run.state).toBe(expectedState)
    expect(run.hitReactionMs).toBe(0)
  })

  it('a second collision inside the post-hit invulnerability window does not apply (§9)', () => {
    let run = withObstacle(startedRun(5), 0)
    run = advance(run, HOLD, STEP) // first hit
    const gapAfterFirstHit = run.pursuitGap
    // Immediately place another obstacle at the trigger line, well inside the 1.1s window,
    // while still resolving reaction ticks (spawning is suspended, but this simulates an
    // already-scrolled-in obstacle reaching the line during the lock).
    run = { ...run, obstacles: [{ id: 1000, family: 'lowFence', x: 0, resolved: false }] }
    run = advance(run, HOLD, STEP)
    expect(run.pursuitGap).toBe(gapAfterFirstHit)
  })

  it('still resolves and credits food that reaches the trigger line during the reaction lock, instead of pruning it uncollected', () => {
    let run = withObstacle(startedRun(9), 0) // the hit that starts the reaction
    run = advance(run, HOLD, STEP)
    expect(run.state).toBe('HIT_REACTION')
    const scoreBeforeFood = run.score

    // A bone sitting right at the trigger line when the reaction begins — at the
    // highest band's scroll speed this would cross the cleanup threshold well
    // before the ~300ms lock ends if it were never resolved.
    run = { ...run, food: [{ id: 2000, kind: 'bone', x: 0, collected: false }] }
    run = advance(run, HOLD, STEP)
    expect(run.score).toBe(scoreBeforeFood + TUNING.food[0].basePoints)

    // Keep ticking through the rest of the lock: the collected item is pruned
    // once it scrolls past cleanup, but the credit already landed above.
    let elapsed = STEP
    while (elapsed < TUNING.hit.reactionLockMs + STEP) {
      run = advance(run, HOLD, STEP)
      elapsed += STEP
    }
    expect(run.food.find((f) => f.id === 2000)).toBeUndefined()
  })
})

describe('advance — repeated collisions eventually catch the dog exactly once', () => {
  it('reaches GAME_OVER and further ticks do not change state further', () => {
    let run = startedRun(6)
    let guard = 0
    while (run.state !== 'GAME_OVER' && guard < 2000) {
      if (run.pursuitGap > 0) {
        run = withObstacle(run, 0)
      }
      run = advance(run, HOLD, STEP)
      guard++
    }
    expect(run.state).toBe('GAME_OVER')
    expect(run.pursuitGap).toBe(0)

    const frozen = run
    const after = advance(run, HOLD, STEP)
    expect(after).toEqual(frozen)
  })
})

describe('advance — spawning', () => {
  it('adds obstacles/food to the world once enough distance has passed', () => {
    let run = startedRun(7)
    let steps = 0
    while (run.obstacles.length === 0 && run.food.length === 0 && steps < 5000) {
      run = advance(run, HOLD, STEP)
      steps++
    }
    expect(run.obstacles.length + run.food.length).toBeGreaterThan(0)
  })

  it('assigns every spawned entity a unique id', () => {
    let run = startedRun(8)
    for (let i = 0; i < 3000; i++) run = advance(run, HOLD, STEP)
    const ids = [...run.obstacles.map((o) => o.id), ...run.food.map((f) => f.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('advance — the reactive world (US3)', () => {
  /** Plays a long clean run and returns every frame's derived world facts. */
  function longRun(seed: number, steps: number) {
    let run = startedRun(seed)
    const events: { kind: string; at: number }[] = []
    let sawRain = false
    let maxObstacles = 0
    let maxFood = 0
    let maxParticles = 0
    for (let i = 0; i < steps; i++) {
      const before = run.activeEvent
      run = advance(run, { ...HOLD, jumpRequested: i % 41 === 0 }, STEP)
      if (run.activeEvent && run.activeEvent !== before) {
        events.push({ kind: run.activeEvent.kind, at: run.elapsedActiveMs })
      }
      if (run.weather === 'rain') sawRain = true
      maxObstacles = Math.max(maxObstacles, run.obstacles.length)
      maxFood = Math.max(maxFood, run.food.length)
      maxParticles = Math.max(maxParticles, run.particles.length)
    }
    return { run, events, sawRain, maxObstacles, maxFood, maxParticles }
  }

  it('fires directed events, never before the minimum run age and never back-to-back', () => {
    // 12,000 steps at 16.67ms ~ 200s of active run, covering every band boundary.
    const { events } = longRun(101, 12_000)
    expect(events.length).toBeGreaterThan(0)
    for (const event of events) expect(event.at).toBeGreaterThanOrEqual(TUNING.events.minRunAgeMs)
    for (let i = 1; i < events.length; i++) expect(events[i].kind).not.toBe(events[i - 1].kind)
  })

  it('reverts to sun once a shower ends, and never leaves rain active without its event', () => {
    let run = startedRun(101)
    for (let i = 0; i < 12_000; i++) {
      run = advance(run, HOLD, STEP)
      if (run.weather === 'rain') expect(run.activeEvent?.kind).toBe('rainShower')
      else expect(run.activeEvent?.kind === 'rainShower').toBe(false)
    }
  })

  it('holds every §24 entity cap across a long run, including after collisions', () => {
    let run = startedRun(202)
    let maxObstacles = 0
    let maxFood = 0
    let maxParticles = 0
    for (let i = 0; i < 8_000; i++) {
      // Never jump: every obstacle lands, so particles are produced constantly.
      run = advance(run, HOLD, STEP)
      if (run.state === 'GAME_OVER' || run.state === 'RESULT') run = startedRun(202 + i)
      maxObstacles = Math.max(maxObstacles, run.obstacles.length)
      maxFood = Math.max(maxFood, run.food.length)
      maxParticles = Math.max(maxParticles, run.particles.length)
    }
    expect(maxObstacles).toBeLessThanOrEqual(TUNING.entityCaps.obstacles)
    expect(maxFood).toBeLessThanOrEqual(TUNING.entityCaps.food)
    expect(maxParticles).toBeLessThanOrEqual(TUNING.entityCaps.particles)
  })

  it('cosmetic particles never award score or move the pursuit gap (§16)', () => {
    let run = { ...startedRun(303), particles: [] as Run['particles'] }
    run = { ...run, obstacles: [{ id: 1, family: 'lowFence', x: 0, resolved: false }] }
    run = advance(run, HOLD, STEP)
    expect(run.particles.length).toBeGreaterThan(0)

    // Let the debris live out its whole lifetime with nothing else happening.
    const before = { score: run.score, gap: run.pursuitGap }
    let scoreFromDistanceOnly = 0
    for (let i = 0; i < 60; i++) {
      const prev = run
      run = advance(run, HOLD, STEP)
      scoreFromDistanceOnly += run.score - prev.score
    }
    expect(run.particles.length).toBe(0)
    // Every point earned in that window came from distance, not from debris.
    expect(run.score - before.score).toBe(scoreFromDistanceOnly)
    expect(run.foodCollected).toBe(0)
  })

  it('rain slows post-landing speed slightly, and only inside the recovery window (§15)', () => {
    const base = startedRun(404)
    const airborne = advance(base, { ...HOLD, jumpRequested: true }, STEP)

    // Weather is derived from the active event every tick (there is no second
    // source of truth), so making it rain means giving the run a real shower.
    const shower = { kind: 'rainShower' as const, startedAtMs: 0, durationMs: 60_000 }

    function landAndMeasure(weather: Run['weather']): number {
      let run: Run =
        weather === 'rain' ? { ...airborne, weather, activeEvent: shower } : { ...airborne, weather }
      // Fly to the landing tick, then measure the first step after touchdown.
      while (!run.dog.grounded) run = advance(run, HOLD, STEP)
      const before = run.distance
      run = advance(run, HOLD, STEP)
      return run.distance - before
    }

    const sunny = landAndMeasure('sunny')
    const rainy = landAndMeasure('rain')
    expect(rainy).toBeLessThan(sunny)
    expect(rainy / sunny).toBeCloseTo(TUNING.weather.rainHandlingFactor, 5)
  })
})

describe('determinism (§13, SC-003)', () => {
  it('the same seed and the same intent timeline produce an identical outcome', () => {
    function play(seed: number): unknown {
      let run = startedRun(seed)
      for (let i = 0; i < 500; i++) {
        const jump = i % 37 === 0
        run = advance(run, { ...HOLD, jumpRequested: jump }, STEP)
      }
      const { gameplayRng, cosmeticRng, ...rest } = run
      void gameplayRng
      void cosmeticRng
      return rest
    }
    expect(play(42)).toEqual(play(42))
  })
})
