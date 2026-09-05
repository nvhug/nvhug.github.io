/**
 * The one versioned config module spec 015 §7 requires: every gameplay
 * tuning number lives here, and nowhere else in `src/lib/games/lost-dog/**`
 * or `app/games/lost-dog/**` may hardcode one (plan R8). Values are the
 * spec's own Release 1 acceptance baselines — starting points, tunable here
 * without touching any consuming module or its tests.
 */

/** Bumping this is a deliberate, visible reset of every run's outcome for the same seed (§13). */
export const GAMEPLAY_VERSION = 1

export type ObstacleFamily = 'lowFence' | 'planter' | 'puddle' | 'bicycle' | 'trashBin' | 'pothole'
export type FoodKind = 'bone' | 'sausage' | 'chickenLeg'
export type RequiredAction = 'jump' | 'duck' | 'jumpOrSlip' | 'timingOrJump'

/** The single source of truth for which action each family requires (§11) — shared by spawner.ts and collision.ts. */
export const OBSTACLE_ACTIONS: Readonly<Record<ObstacleFamily, RequiredAction>> = {
  lowFence: 'jump',
  planter: 'jump',
  puddle: 'jumpOrSlip',
  bicycle: 'duck',
  trashBin: 'timingOrJump',
  pothole: 'timingOrJump',
}

export interface DifficultyBand {
  readonly fromMs: number
  readonly toMs: number
  readonly speed: number
  readonly density: number
  readonly comboCap: 1 | 2 | 3 | 4 | 5
  readonly eventsAllowed: 'none' | 'foodBonus' | 'rain' | 'either'
  readonly pursuitAssistance: 'boosted' | 'normal' | 'recoveryAfterHit' | 'suppressCritical'
}

export interface ObstacleTuning {
  readonly family: ObstacleFamily
  readonly avoidance: 'jump' | 'duck' | 'jumpOrSlip' | 'timingOrJump'
  /** Collision-box delta from the dog's standing profile, in world units. */
  readonly collisionWidth: number
  readonly collisionHeight: number
}

export interface FoodTuning {
  readonly kind: FoodKind
  readonly rarity: number
  readonly basePoints: number
}

export const TUNING = Object.freeze({
  jump: Object.freeze({
    minAirtimeMs: 620,
    maxAirtimeMs: 720,
    /** The one value physics.ts actually uses — the range's midpoint. */
    airtimeMs: 670,
    apexMinFraction: 0.45,
    apexMaxFraction: 0.55,
    apexFraction: 0.5,
    bufferMs: 100,
    anticipationMs: 60,
    landingSquashMs: 90,
  }),
  duck: Object.freeze({
    minTransitionMs: 80,
    maxTransitionMs: 120,
    transitionMs: 100,
  }),
  hit: Object.freeze({
    reactionLockMinMs: 250,
    reactionLockMaxMs: 350,
    reactionLockMs: 300,
    invulnerabilityMs: 1100,
  }),
  frame: Object.freeze({
    /** Incoming real deltas above this are clamped before stepping (§7, §29). */
    maxDeltaMs: 50,
    fixedStepMs: 1000 / 60,
  }),
  pursuit: Object.freeze({
    startGap: 75,
    hitCosts: Object.freeze({ standard: 22, puddle: 16 }),
    /** Gap restored per food item collected (§14 follow-up, explicit user request:
     *  food now credits survival, not just score), scaled with each kind's rarity/
     *  basePoints ratio (10:25:50) but kept modest — two chicken legs undo one
     *  standard hit, never trivializing the chase. Capped at 100 by applyFoodHeal. */
    foodHeal: Object.freeze({ bone: 5, sausage: 10, chickenLeg: 18 }) satisfies Readonly<Record<FoodKind, number>>,
    recoveryPerSecond: 2,
    recoveryDelayMs: 1500,
    bands: Object.freeze({
      safe: [76, 100] as const,
      watch: [51, 75] as const,
      danger: [26, 50] as const,
      critical: [1, 25] as const,
      caught: [0, 0] as const,
    }),
  }),
  bands: [
    { fromMs: 0, toMs: 20_000, speed: 1.0, density: 1.5, comboCap: 1, eventsAllowed: 'none', pursuitAssistance: 'boosted' },
    { fromMs: 20_000, toMs: 45_000, speed: 1.1, density: 2.0, comboCap: 2, eventsAllowed: 'foodBonus', pursuitAssistance: 'normal' },
    { fromMs: 45_000, toMs: 75_000, speed: 1.2, density: 2.5, comboCap: 3, eventsAllowed: 'rain', pursuitAssistance: 'normal' },
    { fromMs: 75_000, toMs: 120_000, speed: 1.35, density: 3.0, comboCap: 4, eventsAllowed: 'either', pursuitAssistance: 'normal' },
    { fromMs: 120_000, toMs: 180_000, speed: 1.5, density: 3.5, comboCap: 5, eventsAllowed: 'either', pursuitAssistance: 'recoveryAfterHit' },
    { fromMs: 180_000, toMs: Infinity, speed: 1.65, density: 4.0, comboCap: 5, eventsAllowed: 'either', pursuitAssistance: 'suppressCritical' },
  ] satisfies readonly DifficultyBand[],
  reactionBudget: Object.freeze({
    normalMinSec: 0.85,
    atCapMinSec: 0.7,
    postActionNeutralSec: 0.45,
    eventWarningLeadSec: 1.25,
  }),
  obstacles: [
    { family: 'lowFence', avoidance: 'jump', collisionWidth: 0.9, collisionHeight: 1.0 },
    { family: 'planter', avoidance: 'jump', collisionWidth: 0.7, collisionHeight: 1.3 },
    { family: 'puddle', avoidance: 'jumpOrSlip', collisionWidth: 1.4, collisionHeight: 0.2 },
    { family: 'bicycle', avoidance: 'duck', collisionWidth: 1.2, collisionHeight: 1.5 },
    { family: 'trashBin', avoidance: 'timingOrJump', collisionWidth: 0.9, collisionHeight: 1.1 },
    { family: 'pothole', avoidance: 'timingOrJump', collisionWidth: 1.1, collisionHeight: 0.15 },
  ] satisfies readonly ObstacleTuning[],
  food: [
    { kind: 'bone', rarity: 0.6, basePoints: 10 },
    { kind: 'sausage', rarity: 0.3, basePoints: 25 },
    { kind: 'chickenLeg', rarity: 0.1, basePoints: 50 },
  ] satisfies readonly FoodTuning[],
  combo: Object.freeze({
    thresholds: [
      { minCount: 0, multiplier: 1 },
      { minCount: 3, multiplier: 2 },
      { minCount: 6, multiplier: 3 },
      { minCount: 10, multiplier: 4 },
      { minCount: 15, multiplier: 5 },
    ] as const,
  }),
  events: Object.freeze({
    minRunAgeMs: 20_000,
    minCooldownMs: 20_000,
    rainDurationMinSec: 18,
    rainDurationMaxSec: 25,
    foodBonusDurationSec: 6,
    /** How long the sky-band banner is shown (§18's motion table caps it at 1.5s). */
    bannerMs: 1500,
    /** The director evaluates on this fixed simulation interval, not every step (§15). */
    evaluateIntervalMs: 1000,
    /** Seeded weighted selection between the two Release-1 events (§15). */
    weights: Object.freeze({ rainShower: 1, foodBonus: 1 }),
  }),
  weather: Object.freeze({
    rainHandlingFactor: 0.92,
    rainLandingSlideExtraMs: [80, 120] as const,
    /** How long after a landing the reduced handling factor applies (§15). */
    landingRecoveryMs: 220,
  }),
  world: Object.freeze({
    /** World units travelled per second at 1.0x band speed. One world unit is one canvas pixel. */
    speedUnitsPerSec: 600,
    /**
     * Render/spawn-timing world units are pixel-scale (600/sec, tuned for a
     * believable on-screen scroll speed and the §12 reaction budget) — a
     * completely different scale from what "distance" should mean as a score
     * and a player-facing stat (§14: one point per whole metre; DESIGN's own
     * HUD note assumes ≈2,400 distance points across a full 3-minute run).
     * Anything computing score or a displayed distance/pace must multiply by
     * this factor first; anything driving spawn position, pruning, or
     * collision must never touch it and keep using raw `distance` (plan R8:
     * both scales live here, in one place, rather than as separate hidden
     * constants at each call site).
     */
    metresPerUnit: 0.0125,
    /**
     * How far ahead of the dog an entity enters the clear look-ahead zone — the
     * aperture's right edge (960 wide, dog at 180). Every spawn happens at or
     * beyond it, so nothing can appear inside the player's reaction window (§12).
     */
    lookAheadUnits: 780,
    /** Seconds between spawned patterns at density 1.0; divided by the band's density (§10). */
    patternIntervalBaseSec: 6,
    /** Entities this far behind the dog are pruned, keeping the pool bounded (§24). */
    cleanupUnits: -120,
    /** The cat's screen-space offset behind the dog at gap 100 (mostly off-frame, §9's Safe row). */
    catFarUnits: -170,
    /** The cat's screen-space offset behind the dog at gap 0 (caught). */
    catNearUnits: -6,
  }),
  instinct: Object.freeze({
    /** Food further ahead than this is outside the clear look-ahead zone and is never advertised (§14). */
    rangeUnits: 700,
  }),
  particles: Object.freeze({
    /** Cosmetic chain-reaction debris lifetime (§16) — bounded, never a collider. */
    maxAgeMs: 600,
    perImpact: 4,
  }),
  /**
   * The music mix (§18). Only the four layer gains and the crossfade constant
   * live here — they are the values §18 says must be a deterministic function
   * of game state, so they belong with the rest of the versioned tuning. The
   * oscillator frequencies stay inside AudioEngine, where they are an
   * instrument definition rather than a tunable.
   */
  audio: Object.freeze({
    layerGains: Object.freeze({ base: 0.15, speed: 0.1, danger: 0.12, chase: 0.14 }),
    crossfadeSec: 0.3,
  }),
  skyBandFraction: 0.18,
  entityCaps: Object.freeze({ obstacles: 12, food: 12, particles: 32 }),
  camera: Object.freeze({
    maxWidenFraction: 0.08,
    widenEaseMinMs: 400,
    shakeMaxMs: 180,
    shakeMaxPx: 6,
  }),
})

export type PursuitBand = 'safe' | 'watch' | 'danger' | 'critical' | 'caught'

/** The band whose [fromMs, toMs) range contains the elapsed active run time. */
export function bandForElapsed(elapsedMs: number): DifficultyBand {
  for (const band of TUNING.bands) {
    if (elapsedMs >= band.fromMs && elapsedMs < band.toMs) return band
  }
  return TUNING.bands[TUNING.bands.length - 1]
}

/** The 0-based index of that band in `TUNING.bands` — the coarse "difficulty band" identifier. */
export function bandIndexForElapsed(elapsedMs: number): number {
  const band = bandForElapsed(elapsedMs)
  return TUNING.bands.findIndex((b) => b.fromMs === band.fromMs)
}

/** Classifies a 0-100 pursuit gap into its §9 band. */
export function pursuitBandFor(gap: number): PursuitBand {
  const { bands } = TUNING.pursuit
  if (gap <= bands.caught[1]) return 'caught'
  if (gap <= bands.critical[1]) return 'critical'
  if (gap <= bands.danger[1]) return 'danger'
  if (gap <= bands.watch[1]) return 'watch'
  return 'safe'
}

/**
 * The cat's screen-space offset behind the dog, purely a function of the
 * pursuit gap — linear from `catFarUnits` at gap 100 (mostly off-frame) to
 * `catNearUnits` at gap 0 (caught). Not stored gameplay state: deriving it
 * fresh every frame is what makes the cat actually visible closing the
 * distance as the gap shrinks, instead of sitting at one fixed position for
 * the whole run (§9's "cat mostly off-frame" / "visible behind dog" rows
 * describe a moving relationship, not a static one).
 */
export function catOffsetFor(gap: number): number {
  const clamped = Math.max(0, Math.min(100, gap))
  const { catFarUnits, catNearUnits } = TUNING.world
  return catFarUnits + (catNearUnits - catFarUnits) * (1 - clamped / 100)
}

/** Classifies a consecutive-collection count into its §14 combo multiplier. */
export function comboMultiplierFor(count: number): 1 | 2 | 3 | 4 | 5 {
  const { thresholds } = TUNING.combo
  let multiplier: 1 | 2 | 3 | 4 | 5 = 1
  for (const t of thresholds) {
    if (count >= t.minCount) multiplier = t.multiplier
  }
  return multiplier
}
