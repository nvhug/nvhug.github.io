/**
 * The one parser for a numeric level key.
 *
 * Both the `[level]` route segment and a stored `game_progress.level_key` are
 * the same thing written down, so they are read the same way: only the
 * canonical decimal form of a positive integer is a level, which is what makes
 * '07', '7.5' and '1e2' fall through to the level map rather than resolving to
 * 7, 7 and 100 (contracts/routing.md § Level URL rules).
 *
 * A game whose keys are not levels at all (a score game's 'classic') gets null,
 * which is how the campaign helpers skip its rows.
 */
export function parseLevelKey(key: string | string[] | undefined, max?: number): number | null {
  if (typeof key !== 'string') return null
  const n = Number.parseInt(key, 10)
  if (!Number.isInteger(n) || String(n) !== key || n < 1) return null
  return max !== undefined && n > max ? null : n
}
