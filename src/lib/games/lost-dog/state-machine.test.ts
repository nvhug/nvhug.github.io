import { describe, expect, it } from 'vitest'
import { initialStateSlice, transition, type StateSlice } from './state-machine'

function at(state: StateSlice['state'], extra: Partial<StateSlice> = {}): StateSlice {
  return { ...initialStateSlice(), state, ...extra }
}

describe('legal transitions (spec 015 §8)', () => {
  it('BOOT -> LOADING on INIT', () => {
    expect(transition(at('BOOT'), { type: 'INIT' }).state).toBe('LOADING')
  })

  it('LOADING -> READY on LOADING_COMPLETE', () => {
    expect(transition(at('LOADING'), { type: 'LOADING_COMPLETE' }).state).toBe('READY')
  })

  it('READY -> COUNTDOWN on START', () => {
    expect(transition(at('READY'), { type: 'START' }).state).toBe('COUNTDOWN')
  })

  it('COUNTDOWN -> RUNNING on COUNTDOWN_COMPLETE', () => {
    expect(transition(at('COUNTDOWN'), { type: 'COUNTDOWN_COMPLETE' }).state).toBe('RUNNING')
  })

  it('RUNNING -> PAUSED on PAUSE, remembering RUNNING', () => {
    const next = transition(at('RUNNING'), { type: 'PAUSE' })
    expect(next.state).toBe('PAUSED')
    expect(next.pausedFrom).toBe('RUNNING')
  })

  it('CAT_WARNING -> PAUSED on PAUSE, remembering CAT_WARNING', () => {
    const next = transition(at('CAT_WARNING'), { type: 'PAUSE' })
    expect(next.state).toBe('PAUSED')
    expect(next.pausedFrom).toBe('CAT_WARNING')
  })

  it('CAT_CHASE -> PAUSED on PAUSE, remembering CAT_CHASE', () => {
    const next = transition(at('CAT_CHASE'), { type: 'PAUSE' })
    expect(next.state).toBe('PAUSED')
    expect(next.pausedFrom).toBe('CAT_CHASE')
  })

  it('PAUSED -> the specific pursuit state it interrupted, on RESUME', () => {
    expect(transition(at('PAUSED', { pausedFrom: 'CAT_CHASE' }), { type: 'RESUME' }).state).toBe('CAT_CHASE')
    expect(transition(at('PAUSED', { pausedFrom: 'RUNNING' }), { type: 'RESUME' }).state).toBe('RUNNING')
  })

  it('RUNNING/CAT_WARNING/CAT_CHASE -> HIT_REACTION on HIT', () => {
    for (const s of ['RUNNING', 'CAT_WARNING', 'CAT_CHASE'] as const) {
      expect(transition(at(s), { type: 'HIT' }).state).toBe('HIT_REACTION')
    }
  })

  it('HIT_REACTION -> the target state named by HIT_REACTION_END', () => {
    for (const target of ['RUNNING', 'CAT_WARNING', 'CAT_CHASE'] as const) {
      expect(transition(at('HIT_REACTION'), { type: 'HIT_REACTION_END', target }).state).toBe(target)
    }
  })

  it('RUNNING -> CAT_WARNING, CAT_WARNING -> CAT_CHASE on GAP_WORSENED', () => {
    expect(transition(at('RUNNING'), { type: 'GAP_WORSENED' }).state).toBe('CAT_WARNING')
    expect(transition(at('CAT_WARNING'), { type: 'GAP_WORSENED' }).state).toBe('CAT_CHASE')
  })

  it('CAT_WARNING -> RUNNING, CAT_CHASE -> CAT_WARNING on GAP_RECOVERED', () => {
    expect(transition(at('CAT_WARNING'), { type: 'GAP_RECOVERED' }).state).toBe('RUNNING')
    expect(transition(at('CAT_CHASE'), { type: 'GAP_RECOVERED' }).state).toBe('CAT_WARNING')
  })

  it('CAT_WARNING/CAT_CHASE -> GAME_OVER on CAUGHT', () => {
    expect(transition(at('CAT_WARNING'), { type: 'CAUGHT' }).state).toBe('GAME_OVER')
    expect(transition(at('CAT_CHASE'), { type: 'CAUGHT' }).state).toBe('GAME_OVER')
  })

  it('GAME_OVER -> RESULT on CATCH_RESOLVED', () => {
    expect(transition(at('GAME_OVER'), { type: 'CATCH_RESOLVED' }).state).toBe('RESULT')
  })

  it('RESULT -> READY on REPLAY, with a fresh (cleared) pausedFrom', () => {
    const next = transition(at('RESULT', { pausedFrom: 'CAT_CHASE' }), { type: 'REPLAY' })
    expect(next.state).toBe('READY')
    expect(next.pausedFrom).toBeNull()
  })
})

describe('illegal transitions are no-ops', () => {
  it('RUNNING ignores a second START', () => {
    expect(transition(at('RUNNING'), { type: 'START' })).toEqual(at('RUNNING'))
  })

  it('READY ignores COUNTDOWN_COMPLETE', () => {
    expect(transition(at('READY'), { type: 'COUNTDOWN_COMPLETE' })).toEqual(at('READY'))
  })

  it('GAME_OVER ignores every gameplay/pause event', () => {
    for (const event of [{ type: 'PAUSE' }, { type: 'HIT' }, { type: 'GAP_WORSENED' }] as const) {
      expect(transition(at('GAME_OVER'), event).state).toBe('GAME_OVER')
    }
  })

  it('RESULT ignores PAUSE (Escape is inert — nothing behind it to return to)', () => {
    expect(transition(at('RESULT'), { type: 'PAUSE' }).state).toBe('RESULT')
  })
})

describe('pause is unavailable during COUNTDOWN, HIT_REACTION and RESULT (§6)', () => {
  it('COUNTDOWN ignores PAUSE outright', () => {
    expect(transition(at('COUNTDOWN'), { type: 'PAUSE' }).state).toBe('COUNTDOWN')
  })

  it('a pause requested during HIT_REACTION is queued, not applied immediately', () => {
    const next = transition(at('HIT_REACTION'), { type: 'PAUSE' })
    expect(next.state).toBe('HIT_REACTION')
    expect(next.pauseQueued).toBe(true)
  })

  it('a queued pause is applied once the reaction resolves, instead of the normal target', () => {
    const queued = at('HIT_REACTION', { pauseQueued: true })
    const next = transition(queued, { type: 'HIT_REACTION_END', target: 'CAT_WARNING' })
    expect(next.state).toBe('PAUSED')
    expect(next.pausedFrom).toBe('CAT_WARNING')
    expect(next.pauseQueued).toBe(false)
  })

  it('the current fixed step completes first — HIT_REACTION_END always lands on a real pursuit state before any pause is applied', () => {
    // i.e. pauseQueued never short-circuits straight from RUNNING/CAT_WARNING/CAT_CHASE
    // without the reaction resolving; this is exercised by the case above, and this
    // test guards against a regression that applies PAUSE mid-reaction directly.
    const midReaction = at('HIT_REACTION')
    expect(transition(midReaction, { type: 'PAUSE' }).state).toBe('HIT_REACTION')
  })
})

describe('an object carrying extra fields keeps them untouched', () => {
  it('spreads through fields the state machine does not own', () => {
    const withExtra = { ...at('READY'), score: 42 }
    expect(transition(withExtra, { type: 'START' })).toMatchObject({ state: 'COUNTDOWN', score: 42 })
  })
})
