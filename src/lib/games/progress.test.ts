import { describe, expect, it } from 'vitest'
import type { GameProgressRecord } from '@/types'
import {
  bestFor,
  formatTime,
  groupByGame,
  isUnlocked,
  starsFor,
  summarizeCampaign,
  toCompletionArgs,
  withPending,
} from './progress'

function record(level: number, bestMs: number | null, gameId = 'block-puzzle'): GameProgressRecord {
  return {
    user_id: 'u1',
    game_id: gameId,
    level_key: String(level),
    best_time_ms: bestMs,
    best_score: null,
    completions: 1,
    first_completed_at: '2026-09-03T00:00:00Z',
    updated_at: '2026-09-03T00:00:00Z',
  }
}

describe('starsFor', () => {
  it('gives three stars at or under par', () => {
    expect(starsFor(30_000, 30_000)).toBe(3)
    expect(starsFor(1, 30_000)).toBe(3)
  })

  it('gives two stars at or under twice par', () => {
    expect(starsFor(30_001, 30_000)).toBe(2)
    expect(starsFor(60_000, 30_000)).toBe(2)
  })

  it('gives one star for any slower completion', () => {
    expect(starsFor(60_001, 30_000)).toBe(1)
    expect(starsFor(10 * 60_000, 30_000)).toBe(1)
  })
})

describe('isUnlocked', () => {
  it('always unlocks level 1', () => {
    expect(isUnlocked(1, [])).toBe(true)
  })

  it('unlocks level N only when level N-1 has a record', () => {
    const records = [record(1, 5000), record(2, 5000)]
    expect(isUnlocked(2, records)).toBe(true)
    expect(isUnlocked(3, records)).toBe(true)
    expect(isUnlocked(4, records)).toBe(false)
  })

  it('does not unlock through a skipped level', () => {
    expect(isUnlocked(6, [record(1, 5000), record(4, 5000)])).toBe(false)
  })
})

describe('bestFor', () => {
  it('returns the stored best or null', () => {
    expect(bestFor([record(3, 4200)], 3)).toBe(4200)
    expect(bestFor([record(3, 4200)], 4)).toBeNull()
  })
})

describe('summarizeCampaign', () => {
  const par = () => 30_000
  it('counts completions, sums stars and points at the lowest unsolved level', () => {
    const s = summarizeCampaign([record(1, 10_000), record(2, 45_000), record(3, 90_000)], 100, par)
    expect(s.completed).toBe(3)
    expect(s.stars).toBe(3 + 2 + 1)
    expect(s.nextLevel).toBe(4)
    expect(s.byLevel.get(2)).toEqual({ bestMs: 45_000, stars: 2 })
  })

  it('starts a new account at level 1 with nothing done', () => {
    const s = summarizeCampaign([], 100, par)
    expect(s).toMatchObject({ completed: 0, stars: 0, nextLevel: 1 })
  })

  it('caps nextLevel at the campaign length when everything is done', () => {
    const all = Array.from({ length: 100 }, (_, i) => record(i + 1, 1000))
    expect(summarizeCampaign(all, 100, par).nextLevel).toBe(100)
  })

  it('treats a gap as the next level even when later levels are done', () => {
    const s = summarizeCampaign([record(1, 1000), record(3, 1000)], 100, par)
    expect(s.nextLevel).toBe(2)
  })

  it('ignores records from other games and unparseable keys', () => {
    const s = summarizeCampaign([record(1, 1000), record(1, 1000, '2048'), { ...record(1, 1000), level_key: 'classic' }], 100, par)
    expect(s.completed).toBe(1)
  })
})

describe('formatTime', () => {
  it('renders mm:ss, zero-padded', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(41_230)).toBe('00:41')
    expect(formatTime(61_000)).toBe('01:01')
  })

  it('holds at 99:59+ beyond the display range', () => {
    expect(formatTime(100 * 60_000)).toBe('99:59+')
  })
})

describe('groupByGame', () => {
  it('splits records by game id', () => {
    const grouped = groupByGame([record(1, 1000), record(2, 1000), record(1, 1000, '2048')])
    expect(grouped.get('block-puzzle')).toHaveLength(2)
    expect(grouped.get('2048')).toHaveLength(1)
    expect(grouped.has('memory')).toBe(false)
  })
})

describe('toCompletionArgs', () => {
  it('rounds a fractional time, which the INT column would reject', () => {
    expect(toCompletionArgs({ gameId: 'block-puzzle', levelKey: '3', timeMs: 12_345.678 })).toEqual({
      p_game_id: 'block-puzzle',
      p_level_key: '3',
      p_time_ms: 12_346,
      p_score: null,
    })
  })

  it('rounds a fractional score too', () => {
    expect(toCompletionArgs({ gameId: '2048', levelKey: 'classic', score: 2047.6 })).toEqual({
      p_game_id: '2048',
      p_level_key: 'classic',
      p_time_ms: null,
      p_score: 2048,
    })
  })

  it('keeps an absent or null value null instead of rounding it to zero', () => {
    const args = toCompletionArgs({ gameId: 'g', levelKey: '1', timeMs: null, score: null })
    expect(args.p_time_ms).toBeNull()
    expect(args.p_score).toBeNull()
    expect(toCompletionArgs({ gameId: 'g', levelKey: '1' }).p_time_ms).toBeNull()
  })
})

describe('withPending', () => {
  const pending = (level: number, timeMs: number, gameId = 'block-puzzle') => ({
    gameId,
    levelKey: String(level),
    timeMs,
  })

  it('returns the loaded records when nothing is queued', () => {
    const records = [record(1, 5000)]
    expect(withPending(records, [])).toEqual(records)
  })

  it('counts an unsaved completion as done, so the next level opens', () => {
    const effective = withPending([], [pending(1, 5000)])
    expect(isUnlocked(2, [])).toBe(false)
    expect(isUnlocked(2, effective)).toBe(true)
    expect(bestFor(effective, 1)).toBe(5000)
  })

  it('narrows an existing best time and never widens it', () => {
    expect(bestFor(withPending([record(1, 5000)], [pending(1, 4000)]), 1)).toBe(4000)
    expect(bestFor(withPending([record(1, 5000)], [pending(1, 9000)]), 1)).toBe(5000)
  })

  it('labels the synthetic record with the queued game id', () => {
    const effective = withPending([], [pending(1, 5000, '2048')])
    expect(effective[0].game_id).toBe('2048')
  })
})
