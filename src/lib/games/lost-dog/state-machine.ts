/**
 * The one authoritative state machine (spec 015 §8). Derived visual states
 * (e.g. a steady post-hit invulnerability rim) do not create additional
 * gameplay states here — they read off `GameState` plus a timer, not a
 * distinct transition.
 *
 * `transition` is pure and generic over any object carrying at least
 * `StateSlice`'s fields, so the full `Run` type (types.ts) satisfies it
 * without this module needing to import `Run` and create a cycle.
 */

export type GameState =
  | 'BOOT'
  | 'LOADING'
  | 'READY'
  | 'COUNTDOWN'
  | 'RUNNING'
  | 'PAUSED'
  | 'HIT_REACTION'
  | 'CAT_WARNING'
  | 'CAT_CHASE'
  | 'GAME_OVER'
  | 'RESULT'

/** The three states PAUSED can resume back into. */
export type PursuitRunningState = 'RUNNING' | 'CAT_WARNING' | 'CAT_CHASE'

export type GameEvent =
  | { type: 'INIT' }
  | { type: 'LOADING_COMPLETE' }
  | { type: 'START' }
  | { type: 'COUNTDOWN_COMPLETE' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'HIT' }
  | { type: 'HIT_REACTION_END'; target: PursuitRunningState }
  | { type: 'GAP_WORSENED' }
  | { type: 'GAP_RECOVERED' }
  | { type: 'CAUGHT' }
  | { type: 'CATCH_RESOLVED' }
  | { type: 'REPLAY' }

export interface StateSlice {
  state: GameState
  /** Which running-pursuit state PAUSED should resume back into. */
  pausedFrom: PursuitRunningState | null
  /** A pause requested mid-HIT_REACTION applies once the reaction resolves (§8's transaction rule). */
  pauseQueued: boolean
}

export function initialStateSlice(): StateSlice {
  return { state: 'BOOT', pausedFrom: null, pauseQueued: false }
}

const PURSUIT_STATES: readonly PursuitRunningState[] = ['RUNNING', 'CAT_WARNING', 'CAT_CHASE']

function isPursuitState(state: GameState): state is PursuitRunningState {
  return (PURSUIT_STATES as readonly GameState[]).includes(state)
}

export function transition<T extends StateSlice>(run: T, event: GameEvent): T {
  const { state } = run

  switch (event.type) {
    case 'INIT':
      return state === 'BOOT' ? { ...run, state: 'LOADING' } : run

    case 'LOADING_COMPLETE':
      return state === 'LOADING' ? { ...run, state: 'READY' } : run

    case 'START':
      return state === 'READY' ? { ...run, state: 'COUNTDOWN' } : run

    case 'COUNTDOWN_COMPLETE':
      return state === 'COUNTDOWN' ? { ...run, state: 'RUNNING' } : run

    case 'PAUSE':
      if (state === 'HIT_REACTION') return { ...run, pauseQueued: true }
      if (isPursuitState(state)) return { ...run, state: 'PAUSED', pausedFrom: state }
      return run

    case 'RESUME':
      return state === 'PAUSED' && run.pausedFrom ? { ...run, state: run.pausedFrom } : run

    case 'HIT':
      return isPursuitState(state) ? { ...run, state: 'HIT_REACTION' } : run

    case 'HIT_REACTION_END':
      if (state !== 'HIT_REACTION') return run
      if (run.pauseQueued) return { ...run, state: 'PAUSED', pausedFrom: event.target, pauseQueued: false }
      return { ...run, state: event.target }

    case 'GAP_WORSENED':
      if (state === 'RUNNING') return { ...run, state: 'CAT_WARNING' }
      if (state === 'CAT_WARNING') return { ...run, state: 'CAT_CHASE' }
      return run

    case 'GAP_RECOVERED':
      if (state === 'CAT_WARNING') return { ...run, state: 'RUNNING' }
      if (state === 'CAT_CHASE') return { ...run, state: 'CAT_WARNING' }
      return run

    case 'CAUGHT':
      return state === 'CAT_WARNING' || state === 'CAT_CHASE' ? { ...run, state: 'GAME_OVER' } : run

    case 'CATCH_RESOLVED':
      return state === 'GAME_OVER' ? { ...run, state: 'RESULT' } : run

    case 'REPLAY':
      return state === 'RESULT' ? { ...run, state: 'READY', pausedFrom: null, pauseQueued: false } : run

    default:
      return run
  }
}
