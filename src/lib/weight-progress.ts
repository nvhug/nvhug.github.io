/**
 * Progress of a weight-loss goal, for the summary card in `WeightTracker`.
 *
 * Extracted from the component because the previous inline version was written
 * for a weight-*gain* goal and produced "+-4.0 kg" as soon as the direction was
 * reversed: it computed `latest - start` and rendered it behind a hardcoded "+".
 * The sign belongs in the number, and the clamping belongs somewhere it can be
 * asserted — hence a pure function with tests rather than three expressions in
 * the middle of JSX.
 */

export interface WeightProgress {
  /** Kilograms lost from the starting weight. Negative if the weight went up. */
  lost: number
  /** Kilograms still to lose to reach the target. Never negative. */
  remaining: number
  /** Share of the goal achieved, clamped to 0–100. */
  percent: number
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * @param latest the most recently recorded weight
 * @param start  the weight the goal started from (above `target` for a loss goal)
 * @param target the goal weight
 */
export function weightProgress(latest: number, start: number, target: number): WeightProgress {
  const goal = start - target

  return {
    lost: round1(start - latest),
    remaining: round1(Math.max(0, latest - target)),
    // A start equal to the target is a goal with nothing to do, which reads as
    // complete rather than as a division by zero.
    percent: goal <= 0 ? 100 : Math.min(100, Math.max(0, ((start - latest) / goal) * 100)),
  }
}
