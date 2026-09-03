import { describe, expect, it } from 'vitest'
import { Grid3x3 } from 'lucide-react'
import type { GameProgressRecord } from '@/types'
import { groupByGame } from './progress'
import { GAMES, type GameDefinition } from './registry'

function record(gameId: string, levelKey: string, extra: Partial<GameProgressRecord> = {}): GameProgressRecord {
  return {
    user_id: 'u1',
    game_id: gameId,
    level_key: levelKey,
    best_time_ms: 20_000,
    best_score: null,
    completions: 1,
    first_completed_at: '2026-09-03T00:00:00Z',
    updated_at: '2026-09-03T00:00:00Z',
    ...extra,
  }
}

// A score-based game that does not exist yet. It proves the registry and the
// progress record can carry one without a schema or hub change (spec SC-018).
const stubScoreGame: GameDefinition = {
  id: '2048',
  path: '/games/2048',
  icon: Grid3x3,
  category: 'numbers',
  i18nKey: 'games.catalog.twentyFortyEight',
  summarize(records) {
    const best = records.reduce<number | null>((acc, r) => (r.best_score !== null && (acc === null || r.best_score > acc) ? r.best_score : acc), null)
    return { completed: records.reduce((n, r) => n + r.completions, 0), bestScore: best, continueHref: '/games/2048' }
  },
}

describe('GAMES registry', () => {
  it('has unique ids and paths that follow /games/<id>', () => {
    const ids = GAMES.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const g of GAMES) expect(g.path).toBe(`/games/${g.id}`)
  })

  it('registers the block puzzle first', () => {
    expect(GAMES[0].id).toBe('block-puzzle')
    expect(GAMES[0].category).toBe('logic')
    expect(GAMES[0].i18nKey).toBe('games.catalog.blockPuzzle')
  })
})

describe('block puzzle summary', () => {
  const blockPuzzle = GAMES.find((g) => g.id === 'block-puzzle')!

  it('reports campaign standing and where to continue', () => {
    const s = blockPuzzle.summarize([record('block-puzzle', '1'), record('block-puzzle', '2')])
    expect(s.completed).toBe(2)
    expect(s.total).toBe(100)
    expect(s.stars).toBeGreaterThan(0)
    expect(s.continueHref).toBe('/games/block-puzzle/3')
  })

  it('sends a new account to level 1', () => {
    expect(blockPuzzle.summarize([]).continueHref).toBe('/games/block-puzzle/1')
  })
})

describe('the hub as a portal', () => {
  it('summarises a score-based game from the same record shape', () => {
    const s = stubScoreGame.summarize([record('2048', 'classic', { best_time_ms: null, best_score: 4096, completions: 3 })])
    expect(s).toMatchObject({ completed: 3, bestScore: 4096, continueHref: '/games/2048' })
  })

  it('hands each definition only its own rows, in registry order', () => {
    const registry: readonly GameDefinition[] = [...GAMES, stubScoreGame]
    const rows = groupByGame([
      record('2048', 'classic', { best_time_ms: null, best_score: 512 }),
      record('block-puzzle', '1'),
    ])
    const summaries = registry.map((g) => g.summarize(rows.get(g.id) ?? []))
    expect(summaries[0].completed).toBe(1)
    expect(summaries[0].total).toBe(100)
    expect(summaries[1].bestScore).toBe(512)
  })
})
