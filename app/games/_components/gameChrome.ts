/**
 * Small, generic chrome recipes shared by every game's HUD/panels — promoted
 * out of the block puzzle's own `_components` once a second game (Cún đi lạc,
 * spec 015) needed the same save-state vocabulary and button treatments
 * (plan R16). Nothing here is block-puzzle-specific.
 */

export type SaveState = 'idle' | 'saving' | 'saved' | 'unsaved'

export const CONTROL_CLASS = 'text-(--games-mat-text) hover:bg-white/10 hover:text-(--games-mat-text)'

export const OAK_BUTTON =
  'bg-(--games-oak) text-(--games-cavity) hover:bg-(--games-oak-light) shadow-[0_3px_0_var(--games-oak-edge)]'

export const QUIET_BUTTON =
  'border border-white/15 bg-white/5 text-(--games-mat-text) hover:bg-white/10 hover:text-(--games-mat-text)'
