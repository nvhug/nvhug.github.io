/**
 * The top-level per-tick composition: physics -> collision -> pursuit ->
 * spawner -> state-machine, matching contracts/simulation.md's Run/advance
 * contract. `advance` is what `useGameLoop` calls once per fixed step;
 * discrete transitions outside the tick (START, PAUSE, REPLAY, ...) go
 * through `transition()` directly from the React shell.
 */

import { createRng, deriveSeed } from '../rng'
import { TUNING, bandForElapsed, pursuitBandFor, type DifficultyBand } from './config'
import { resolveEntities } from './collision'
import { applyComboReset, collectFood, distanceScore, initialCombo, metresTravelled } from './combo'
import { evaluateEvents } from './event-director'
import { initialDogPhysics, stepDogPhysics } from './physics'
import { applyHit, initialPursuit, tickPursuit } from './pursuit'
import { pickFoodKindFromRng, pickValidPattern } from './spawner'
import { transition, type PursuitRunningState } from './state-machine'
import { handlingFactorFor, weatherForEvent } from './weather'
import type { Food, Intent, Obstacle, Particle, Run } from './types'

/** "Never landed yet" — finite, so the recovery-window arithmetic never sees Infinity. */
const NEVER_LANDED_MS = 1e9

export function initialRun(runSeed: number): Run {
  const pursuit = initialPursuit()
  const combo = initialCombo()
  return {
    runSeed,
    gameplayRng: createRng(deriveSeed(runSeed, 'gameplay')),
    cosmeticRng: createRng(deriveSeed(runSeed, 'cosmetic')),
    state: 'BOOT',
    pausedFrom: null,
    pauseQueued: false,
    elapsedActiveMs: 0,
    distance: 0,
    score: combo.score,
    comboCount: combo.comboCount,
    foodCollected: combo.foodCollected,
    bestComboCount: combo.bestComboCount,
    hitsTaken: 0,
    pursuitGap: pursuit.pursuitGap,
    msSinceLastHit: pursuit.msSinceLastHit,
    hitReactionMs: 0,
    msSinceLanding: NEVER_LANDED_MS,
    msSinceEventEval: 0,
    shakeMs: 0,
    nextSpawnDistance: 0,
    nextEntityId: 1,
    weather: 'sunny',
    activeEvent: null,
    lastEventEndedAtMs: null,
    lastEventKind: null,
    dog: initialDogPhysics(),
    cat: { x: -20 },
    obstacles: [],
    food: [],
    particles: [],
  }
}

function currentBand(run: Run): DifficultyBand {
  return bandForElapsed(run.elapsedActiveMs)
}

function pursuitRunningStateFor(gap: number): PursuitRunningState | 'GAME_OVER' {
  const band = pursuitBandFor(gap)
  if (band === 'safe' || band === 'watch') return 'RUNNING'
  if (band === 'danger') return 'CAT_WARNING'
  if (band === 'critical') return 'CAT_CHASE'
  return 'GAME_OVER'
}

function prune<T extends { x: number }>(entities: readonly T[]): T[] {
  return entities.filter((e) => e.x >= TUNING.world.cleanupUnits)
}

/** World units travelled per second in the given band. */
function speedFor(band: DifficultyBand): number {
  return band.speed * TUNING.world.speedUnitsPerSec
}

/** Keeps the RUNNING/CAT_WARNING/CAT_CHASE machine state in step with the gap band
 *  when no hit occurred this tick (e.g. recovery moving it back down one step). Band
 *  spacing (25 points) is always larger than one tick's hit/recovery delta, so this is
 *  always a single-step transition. */
function syncPursuitState(run: Run): Run {
  const target = pursuitRunningStateFor(run.pursuitGap)
  if (target === 'GAME_OVER' || target === run.state) return run
  if (run.state === 'RUNNING' && target === 'CAT_WARNING') return transition(run, { type: 'GAP_WORSENED' })
  if (run.state === 'CAT_WARNING' && target === 'CAT_CHASE') return transition(run, { type: 'GAP_WORSENED' })
  if (run.state === 'CAT_CHASE' && target === 'CAT_WARNING') return transition(run, { type: 'GAP_RECOVERED' })
  if (run.state === 'CAT_WARNING' && target === 'RUNNING') return transition(run, { type: 'GAP_RECOVERED' })
  return run
}

/**
 * Places one validated pattern into the world. Entity x is measured from the
 * dog (which never moves; the world scrolls under it), so a spawn coordinate
 * is a pure distance-ahead — mixing in the absolute `run.distance` would make
 * every pattern spawn further ahead than the last (see the note in 3-tasks.md
 * T043's entry).
 */
function maybeSpawn(run: Run): Run {
  if (run.distance < run.nextSpawnDistance) return run

  const band = currentBand(run)
  const speed = speedFor(band)
  const { lookAheadUnits, patternIntervalBaseSec } = TUNING.world
  const { pattern } = pickValidPattern(run.gameplayRng, band)

  // Every spawn happens at or beyond the look-ahead edge, so nothing can appear
  // inside the player's reaction window; a generous pattern lead only ever
  // pushes the first obstacle further out (§12).
  const firstX = Math.max(pattern.leadSec * speed, lookAheadUnits)

  let nextId = run.nextEntityId
  const newObstacles: Obstacle[] = []
  for (const [index, token] of pattern.obstacles.entries()) {
    if (run.obstacles.length + newObstacles.length >= TUNING.entityCaps.obstacles) break
    newObstacles.push({
      id: nextId++,
      family: token.family,
      x: firstX + index * pattern.gapSec * speed,
      resolved: false,
    })
  }

  const newFood: Food[] = []
  if (pattern.food && run.food.length < TUNING.entityCaps.food) {
    newFood.push({
      id: nextId++,
      kind: pattern.food.foodKind,
      x: firstX + pattern.food.offsetSec * speed,
      collected: false,
    })
  }

  const trailingUnits = Math.max(0, pattern.obstacles.length - 1) * pattern.gapSec * speed
  // Density (§10) sets the cadence: more patterns per minute as the run gets older.
  const intervalUnits = (patternIntervalBaseSec / band.density) * speed

  return {
    ...run,
    obstacles: [...run.obstacles, ...newObstacles],
    food: [...run.food, ...newFood],
    nextSpawnDistance: run.distance + trailingUnits + intervalUnits,
    nextEntityId: nextId,
  }
}

/**
 * Ages the cosmetic chain-reaction particles and drops the expired ones (§16,
 * §24). Nothing else in the tick reads this array, so a particle can never
 * become a collider or move the pursuit gap.
 */
function tickParticles(particles: readonly Particle[], dtMs: number, moveBy: number): Particle[] {
  const next: Particle[] = []
  for (const p of particles) {
    const ageMs = p.ageMs + dtMs
    if (ageMs >= p.maxAgeMs) continue
    next.push({
      ...p,
      ageMs,
      x: p.x + (p.vx * dtMs) / 1000 - moveBy,
      y: p.y + (p.vy * dtMs) / 1000,
    })
  }
  return next
}

/**
 * Spawns the bounded debris burst a collision knocks loose. Every value here
 * comes from the **cosmetic** stream — a reduced-motion or DPR decision that
 * suppressed these must not be able to shift a gameplay outcome (plan R6).
 */
function spawnImpactParticles(run: Run): Run {
  const room = TUNING.entityCaps.particles - run.particles.length
  if (room <= 0) return run

  const count = Math.min(room, TUNING.particles.perImpact)
  const particles = [...run.particles]
  let nextId = run.nextEntityId
  for (let i = 0; i < count; i++) {
    particles.push({
      id: nextId++,
      x: run.cosmeticRng() * 30,
      y: -10 - run.cosmeticRng() * 20,
      vx: 40 + run.cosmeticRng() * 120,
      vy: -60 + run.cosmeticRng() * 40,
      ageMs: 0,
      maxAgeMs: TUNING.particles.maxAgeMs,
    })
  }
  return { ...run, particles, nextEntityId: nextId }
}

/**
 * Resolves the active directed event's lifetime and asks the director for a
 * new one on its fixed interval, then derives the weather from whatever is
 * active. Weather is never stored independently of the event that caused it,
 * so a shower cannot outlive its own seeded duration (§15).
 */
function tickEvents(run: Run, dtMs: number): Run {
  let next = run
  const active = next.activeEvent
  if (active && next.elapsedActiveMs >= active.startedAtMs + active.durationMs) {
    next = {
      ...next,
      activeEvent: null,
      lastEventEndedAtMs: next.elapsedActiveMs,
      lastEventKind: active.kind,
    }
  }

  const msSinceEventEval = next.msSinceEventEval + dtMs
  if (msSinceEventEval >= TUNING.events.evaluateIntervalMs) {
    next = { ...next, msSinceEventEval: msSinceEventEval - TUNING.events.evaluateIntervalMs }
    const decision = evaluateEvents(next)
    if (decision.event) {
      next = { ...next, activeEvent: decision.event }
      if (decision.event.kind === 'foodBonus') next = spawnFoodBonusArc(next)
    }
  } else {
    next = { ...next, msSinceEventEval }
  }

  return { ...next, weather: weatherForEvent(next.activeEvent, next.elapsedActiveMs) }
}

/**
 * The friendly food bonus (§15): a three-item arc placed on the clear line,
 * beyond the look-ahead edge and away from any hazard — every item has a
 * no-risk refusal path because refusing means simply running straight on.
 * Food kinds come from the gameplay stream, since they change the score.
 */
function spawnFoodBonusArc(run: Run): Run {
  const speed = speedFor(currentBand(run))
  const room = TUNING.entityCaps.food - run.food.length
  if (room <= 0) return run

  const food = [...run.food]
  let nextId = run.nextEntityId
  for (let i = 0; i < Math.min(3, room); i++) {
    food.push({
      id: nextId++,
      kind: pickFoodKindFromRng(run.gameplayRng),
      x: TUNING.world.lookAheadUnits + i * 0.45 * speed,
      collected: false,
    })
  }
  return { ...run, food, nextEntityId: nextId }
}

function advanceActive(run: Run, intent: Intent, dtMs: number): Run {
  const band = currentBand(run)
  const dog = stepDogPhysics(run.dog, intent, dtMs)
  const landed = !run.dog.grounded && dog.grounded
  const msSinceLanding = landed ? 0 : run.msSinceLanding + dtMs
  // Rain's only effect on the simulation: horizontal speed recovers a little
  // more slowly for a moment after touching down (§15).
  const moveBy = speedFor(band) * handlingFactorFor(run.weather, msSinceLanding) * (dtMs / 1000)

  const obstacles = prune(run.obstacles.map((o) => ({ ...o, x: o.x - moveBy })))
  const food = prune(run.food.map((f) => ({ ...f, x: f.x - moveBy })))

  const resolved = resolveEntities(dog, obstacles, food)
  const distance = run.distance + moveBy

  let next: Run = {
    ...run,
    dog,
    msSinceLanding,
    shakeMs: Math.max(0, run.shakeMs - dtMs),
    particles: tickParticles(run.particles, dtMs, moveBy),
    obstacles: resolved.obstacles,
    food: resolved.food,
    elapsedActiveMs: run.elapsedActiveMs + dtMs,
    distance,
    // Distance points are never multiplied (§14) — only the whole metres crossed this step.
    // distanceScore counts whole metres, not raw world-position units — see
    // metresTravelled's own doc for why the two must never be conflated.
    score: run.score + distanceScore(metresTravelled(distance)) - distanceScore(metresTravelled(run.distance)),
  }

  for (const id of resolved.collectedFoodIds) {
    const item = resolved.food.find((f) => f.id === id)
    if (item) next = collectFood(next, item.kind, band.comboCap)
  }

  let landedHits = 0
  for (const hit of resolved.hits) {
    const before = next.pursuitGap
    next = applyHit(next, hit.result === 'slip' ? 'puddle' : 'standard')
    // The combo resets, the hit is counted and the reaction lock is entered only
    // when the collision actually landed — a collision absorbed by the
    // invulnerability window is not a hit transaction at all (§9, §14).
    if (next.pursuitGap === before) continue
    landedHits += 1
    next = { ...applyComboReset(next), hitsTaken: next.hitsTaken + 1, shakeMs: TUNING.camera.shakeMaxMs }
    next = spawnImpactParticles(next)
  }
  next = tickPursuit(next, dtMs)

  if (landedHits > 0) {
    next = pursuitRunningStateFor(next.pursuitGap) === 'GAME_OVER'
      ? transition(next, { type: 'CAUGHT' })
      : transition(next, { type: 'HIT' })
  } else {
    next = syncPursuitState(next)
  }

  // Events are evaluated after the state is settled, so the director sees the
  // pursuit band and machine state this tick actually ended in (§15).
  return maybeSpawn(tickEvents(next, dtMs))
}

function advanceHitReaction(run: Run, dtMs: number): Run {
  const band = currentBand(run)
  const moveBy = speedFor(band) * (dtMs / 1000)
  const hitReactionMs = run.hitReactionMs + dtMs

  // Spawning is suspended here (§8), but entities already in flight keep
  // scrolling and must still be resolved before cleanup prunes them — without
  // this, food crossing the trigger line during the lock vanished uncollected
  // instead of being credited, and an obstacle could be pruned unresolved.
  const obstacles = prune(run.obstacles.map((o) => ({ ...o, x: o.x - moveBy })))
  const food = prune(run.food.map((f) => ({ ...f, x: f.x - moveBy })))
  const resolved = resolveEntities(run.dog, obstacles, food)

  let next: Run = {
    ...run,
    hitReactionMs,
    msSinceLanding: run.msSinceLanding + dtMs,
    shakeMs: Math.max(0, run.shakeMs - dtMs),
    particles: tickParticles(run.particles, dtMs, moveBy),
    obstacles: resolved.obstacles,
    food: resolved.food,
    elapsedActiveMs: run.elapsedActiveMs + dtMs,
    distance: run.distance + moveBy,
  }

  for (const id of resolved.collectedFoodIds) {
    const item = resolved.food.find((f) => f.id === id)
    if (item) next = collectFood(next, item.kind, band.comboCap)
  }
  // Any obstacle resolved here is still within the invulnerability window from
  // the hit that caused this very reaction (invulnerabilityMs > reactionLockMs),
  // so applyHit is a harmless no-op for it — it must still be called, though,
  // so the entity's resolution isn't silently skipped for one that happens to
  // be a hit rather than a clean pass.
  for (const hit of resolved.hits) {
    next = applyHit(next, hit.result === 'slip' ? 'puddle' : 'standard')
  }

  // The invulnerability/recovery clock keeps running during the reaction lock —
  // freezing it here would let it under-count real elapsed time and could block
  // a legitimately-later hit from ever applying once back in an active state.
  next = tickPursuit(next, dtMs)

  if (hitReactionMs >= TUNING.hit.reactionLockMs) {
    const target = pursuitRunningStateFor(next.pursuitGap)
    // A hit that reaches gap 0 is caught directly (never enters HIT_REACTION —
    // see advanceActive), so `target` here is always a real pursuit-running state.
    next = transition({ ...next, hitReactionMs: 0 }, { type: 'HIT_REACTION_END', target: target as PursuitRunningState })
  }

  // An already-running shower keeps running through the lock and still ends on
  // time; the director itself refuses to *start* anything here ('transactionActive').
  return tickEvents(next, dtMs)
}

export function advance(run: Run, intent: Intent, dtMs: number): Run {
  switch (run.state) {
    case 'RUNNING':
    case 'CAT_WARNING':
    case 'CAT_CHASE':
      return advanceActive(run, intent, dtMs)
    case 'HIT_REACTION':
      return advanceHitReaction(run, dtMs)
    default:
      return run
  }
}
