/**
 * The per-user weight goal shown on the `WeightTracker` summary card.
 *
 * Stored under `user_profiles.profile_data.weightGoal`, following ADR-009's
 * reuse of that JSONB column for free-form per-user fields — no migration and
 * no new RLS policy. Until a user edits it, every account shows the feature 009
 * starter goal ("lose 5kg", 70 -> 65), which is why the default lives here
 * rather than in the seeder.
 */

export interface WeightGoal {
  /** The weight the goal started from. */
  start: number
  /** The goal weight. Above `start` for a gain goal, below it for a loss goal. */
  target: number
}

export const WEIGHT_GOAL_PROFILE_KEY = 'weightGoal'

export const DEFAULT_WEIGHT_GOAL: WeightGoal = { start: 70, target: 65 }

function isWeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Validate a stored goal. A missing or malformed record reads as the starter
 * goal rather than as a NaN progress bar.
 */
export function parseWeightGoal(raw: unknown): WeightGoal {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_WEIGHT_GOAL
  const { start, target } = raw as { start?: unknown; target?: unknown }
  if (!isWeight(start) || !isWeight(target)) return DEFAULT_WEIGHT_GOAL
  return { start, target }
}

/**
 * Parse what the user typed into the inline goal editor. Accepts a decimal
 * comma, rounds to one decimal place, and rejects anything that is not a
 * positive weight.
 */
export function parseWeightInput(value: string): number | null {
  const parsed = parseFloat(value.trim().replace(',', '.'))
  if (!isWeight(parsed)) return null
  return Math.round(parsed * 10) / 10
}
