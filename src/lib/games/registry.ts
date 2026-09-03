/**
 * The Games Hub registry (spec 013 FR-049..FR-051).
 *
 * The hub renders from this list and nothing else. Adding a game is one entry
 * here plus its pages under app/games/<id>/ — the hub page, the header entry,
 * the /games route key and the permission rows do not change. Progress rows
 * are game-agnostic (see GameProgressRecord), so a score-based game summarises
 * from the same record shape as a level-based one.
 */

import { Puzzle, type LucideIcon } from 'lucide-react'
import type { GameProgressRecord } from '@/types'
import { CAMPAIGN_LEVELS, parMsForLevel } from './block-puzzle/tiers'
import { summarizeCampaign } from './progress'

export type GameCategory = 'logic' | 'numbers' | 'memory'

export interface GameSummary {
  /** Levels done, or games finished. */
  completed: number
  /** Campaign length, when the game has one. */
  total?: number
  /** Stars earned, when the game rates play. */
  stars?: number
  /** Highest score, when the game is score-based. */
  bestScore?: number | null
  /** Where the card's control goes. */
  continueHref: string
}

export interface GameDefinition {
  /** Equals game_progress.game_id. */
  id: string
  /** '/games/<id>' */
  path: string
  icon: LucideIcon
  category: GameCategory
  /** `games.catalog.<key>` → { name, description } in the dictionaries. */
  i18nKey: string
  /** Receives only this game's rows. */
  summarize(records: readonly GameProgressRecord[]): GameSummary
}

export const BLOCK_PUZZLE_ID = 'block-puzzle'
/** The game's own root. Every link into it — the card, the map, the HUD — hangs off this. */
export const BLOCK_PUZZLE_PATH = `/games/${BLOCK_PUZZLE_ID}`

const blockPuzzle: GameDefinition = {
  id: BLOCK_PUZZLE_ID,
  path: BLOCK_PUZZLE_PATH,
  icon: Puzzle,
  category: 'logic',
  i18nKey: 'games.catalog.blockPuzzle',
  summarize(records) {
    const s = summarizeCampaign(records, CAMPAIGN_LEVELS, parMsForLevel)
    return {
      completed: s.completed,
      total: CAMPAIGN_LEVELS,
      stars: s.stars,
      continueHref: `${BLOCK_PUZZLE_PATH}/${s.nextLevel}`,
    }
  },
}

export const GAMES: readonly GameDefinition[] = [blockPuzzle]
