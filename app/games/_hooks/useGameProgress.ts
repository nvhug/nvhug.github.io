'use client'

/**
 * The one progress load the hub, a level map and a play page all need
 * (spec 013 FR-028): the rows, whether the answer is still unknown, whether it
 * failed, and a retry.
 *
 * `records` stays null until the answer is known. An empty array means "this
 * account has completed nothing"; a failure leaves it null, because a failed
 * load must never read as "nothing completed" — that would lock every level.
 *
 * Exactly one request per mount, and none on a language switch: `t` is a new
 * function on every provider render, so the toast reads it from a ref instead
 * of listing it as a dependency (FR-045).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { fetchGameProgress } from '@/lib/games/progress'
import { useLanguage } from '@/lib/i18n/language-context'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import type { GameProgressRecord } from '@/types'

export interface GameProgressState {
  /** null while unknown — including after a failed load. */
  records: GameProgressRecord[] | null
  loading: boolean
  loadFailed: boolean
  retry: () => void
  /**
   * Folds saved rows in without a second request: `record_game_completion`
   * returns the stored row, so the authoritative best is already known
   * (FR-045). Rows are keyed by level, so the caller passes only rows from the
   * game these records are scoped to.
   */
  merge: (rows: readonly GameProgressRecord[]) => void
}

export function useGameProgress(gameId?: string): GameProgressState {
  const { t } = useLanguage()
  const { user } = useRequireAuth()
  const [records, setRecords] = useState<GameProgressRecord[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchGameProgress(gameId)
      .then((rows) => {
        if (cancelled) return
        setLoadFailed(false)
        setRecords(rows)
      })
      .catch(() => {
        if (cancelled) return
        setLoadFailed(true)
        toast.error(tRef.current('games.errors.loadFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [user, gameId, reloadKey])

  const retry = useCallback(() => {
    setLoadFailed(false)
    setReloadKey((key) => key + 1)
  }, [])

  const merge = useCallback((rows: readonly GameProgressRecord[]) => {
    setRecords((current) => {
      const merged = new Map((current ?? []).map((row) => [row.level_key, row]))
      for (const row of rows) merged.set(row.level_key, row)
      return [...merged.values()]
    })
  }, [])

  return { records, loading: records === null && !loadFailed, loadFailed, retry, merge }
}
