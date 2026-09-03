/**
 * Per-account game progress: the pure helpers the hub, map and play page share,
 * plus the two Supabase calls (read rows, record a completion through the
 * `record_game_completion` function — see sql/30.games.sql).
 *
 * Stars are derived here from best time vs par and never stored (spec 013
 * FR-013). Nothing in this module touches browser storage (FR-027).
 */

import { supabase } from '@/lib/supabase'
import type { GameProgressRecord } from '@/types'
import { parseLevelKey } from './level-key'
import type { PendingCompletion } from './pending-completions'

export function starsFor(timeMs: number, parMs: number): 1 | 2 | 3 {
  if (timeMs <= parMs) return 3
  if (timeMs <= parMs * 2) return 2
  return 1
}

function levelOf(record: GameProgressRecord): number | null {
  return parseLevelKey(record.level_key)
}

function levelRecords(records: readonly GameProgressRecord[]): Map<number, GameProgressRecord> {
  const byLevel = new Map<number, GameProgressRecord>()
  for (const r of records) {
    const level = levelOf(r)
    if (level !== null) byLevel.set(level, r)
  }
  return byLevel
}

/** Level 1 is always open; level N opens once level N−1 has a record. */
export function isUnlocked(level: number, records: readonly GameProgressRecord[]): boolean {
  if (level <= 1) return true
  return levelRecords(records).has(level - 1)
}

export function bestFor(records: readonly GameProgressRecord[], level: number): number | null {
  return levelRecords(records).get(level)?.best_time_ms ?? null
}

/**
 * The loaded records plus the completions still queued for saving, so a level
 * solved while the save was failing counts as done: without this the next level
 * re-locks the moment the player leaves the page (FR-012 against FR-028).
 *
 * A queued entry for a level that already has a row only narrows that row's
 * best time — never widens it, matching what the database would do (FR-025).
 * One with no row becomes a synthetic row; its identity and timestamp fields
 * are placeholders, because every consumer here reads only the game id, the
 * level key and the best time.
 */
export function withPending(
  records: readonly GameProgressRecord[],
  pending: readonly Pick<PendingCompletion, 'gameId' | 'levelKey' | 'timeMs'>[],
): GameProgressRecord[] {
  if (pending.length === 0) return [...records]
  const merged = new Map(records.map((row) => [`${row.game_id}/${row.level_key}`, row]))
  for (const entry of pending) {
    const key = `${entry.gameId}/${entry.levelKey}`
    const existing = merged.get(key)
    if (existing) {
      merged.set(key, {
        ...existing,
        best_time_ms:
          existing.best_time_ms === null
            ? entry.timeMs
            : Math.min(existing.best_time_ms, entry.timeMs),
      })
      continue
    }
    merged.set(key, {
      user_id: '',
      game_id: entry.gameId,
      level_key: entry.levelKey,
      best_time_ms: entry.timeMs,
      best_score: null,
      completions: 1,
      first_completed_at: '',
      updated_at: '',
    })
  }
  return [...merged.values()]
}

export interface CampaignSummary {
  completed: number
  stars: number
  /** The lowest unsolved level, capped at the campaign length. */
  nextLevel: number
  byLevel: Map<number, { bestMs: number; stars: 1 | 2 | 3 }>
}

export function summarizeCampaign(
  records: readonly GameProgressRecord[],
  totalLevels: number,
  parMsFor: (level: number) => number,
): CampaignSummary {
  const byLevel = new Map<number, { bestMs: number; stars: 1 | 2 | 3 }>()
  let stars = 0
  for (const [level, r] of levelRecords(records)) {
    if (level > totalLevels || r.best_time_ms === null) continue
    const s = starsFor(r.best_time_ms, parMsFor(level))
    byLevel.set(level, { bestMs: r.best_time_ms, stars: s })
    stars += s
  }
  let nextLevel = 1
  while (nextLevel < totalLevels && byLevel.has(nextLevel)) nextLevel++
  return { completed: byLevel.size, stars, nextLevel, byLevel }
}

/** mm:ss, holding at 99:59+ past the display range. */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  if (totalSeconds > 99 * 60 + 59) return '99:59+'
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function groupByGame(records: readonly GameProgressRecord[]): Map<string, GameProgressRecord[]> {
  const grouped = new Map<string, GameProgressRecord[]>()
  for (const r of records) {
    const list = grouped.get(r.game_id)
    if (list) list.push(r)
    else grouped.set(r.game_id, [r])
  }
  return grouped
}

// ---------------------------------------------------------------------------
// I/O — not unit-tested (project convention). RLS scopes every read to the
// signed-in user; the write goes through the atomic upsert function.

export async function fetchGameProgress(gameId?: string): Promise<GameProgressRecord[]> {
  let query = supabase.from('game_progress').select('*')
  if (gameId) query = query.eq('game_id', gameId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as GameProgressRecord[]
}

export interface CompletionInput {
  gameId: string
  levelKey: string
  timeMs?: number | null
  score?: number | null
}

/** A type alias, not an interface: `supabase.rpc` takes a `Record<string, unknown>`. */
export type CompletionArgs = {
  p_game_id: string
  p_level_key: string
  p_time_ms: number | null
  p_score: number | null
}

/**
 * The `record_game_completion` arguments. Both numbers are rounded here, at the
 * one boundary they cross: the clock reports fractional milliseconds and the
 * columns are INT, so an unrounded '12345.678' is rejected outright (22P02) and
 * the completion is never stored. Rounding at the gateway means no call site
 * has to remember to.
 */
export function toCompletionArgs(input: CompletionInput): CompletionArgs {
  const time = input.timeMs ?? null
  const score = input.score ?? null
  return {
    p_game_id: input.gameId,
    p_level_key: input.levelKey,
    p_time_ms: time === null ? null : Math.round(time),
    p_score: score === null ? null : Math.round(score),
  }
}

export async function recordCompletion(input: CompletionInput): Promise<GameProgressRecord> {
  const { data, error } = await supabase.rpc('record_game_completion', toCompletionArgs(input))
  if (error) throw error
  return data as GameProgressRecord
}
