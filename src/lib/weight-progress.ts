/**
 * Progress of a weight goal, for the summary card in `WeightTracker`.
 *
 * Extracted from the component because the previous inline version was written
 * for one direction only and broke as soon as the goal pointed the other way:
 * first "+-4.0 kg" when a gain formula met a loss goal, then "Đã giảm 5.8 kg /
 * Còn lại 0.0 kg" when a loss formula met a 61 -> 75 gain goal. The direction
 * is derived from the goal itself, so neither the sign nor the clamping depends
 * on which way the user happens to be going.
 */

export type WeightGoalDirection = 'lose' | 'gain'

export interface WeightProgress {
  /** Which way the goal points: `target > start` is a gain goal. */
  direction: WeightGoalDirection
  /**
   * Kilograms moved from the starting weight *toward* the target. Negative if
   * the weight moved away from it (gained on a loss goal, or lost on a gain goal).
   */
  progressed: number
  /** Kilograms still to go to reach the target. Never negative. */
  remaining: number
  /** Share of the goal achieved, clamped to 0–100. */
  percent: number
}

function round1(value: number): number {
  // `+ 0` turns the -0 that `sign * 0` produces into +0, so a goal with no
  // movement yet renders as "0.0" rather than "-0.0".
  return Math.round(value * 10) / 10 + 0
}

/**
 * @param latest the most recently recorded weight
 * @param start  the weight the goal started from
 * @param target the goal weight
 */
export function weightProgress(latest: number, start: number, target: number): WeightProgress {
  const direction: WeightGoalDirection = target > start ? 'gain' : 'lose'
  // +1 when moving up is progress, -1 when moving down is.
  const sign = direction === 'gain' ? 1 : -1
  const goal = Math.abs(target - start)
  const progressed = sign * (latest - start)

  return {
    direction,
    progressed: round1(progressed),
    remaining: round1(Math.max(0, sign * (target - latest))),
    // A start equal to the target is a goal with nothing to do, which reads as
    // complete rather than as a division by zero.
    percent: goal === 0 ? 100 : Math.min(100, Math.max(0, (progressed / goal) * 100)),
  }
}
