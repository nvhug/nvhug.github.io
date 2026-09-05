'use client'

/**
 * The one quiet line under the frame (docs/DESIGN.md § Secondary line):
 * `Kỷ lục 06730 · 412 m · 01:47 · đã lưu`. Every slot reserves its width in
 * `ch` so nothing reflows mid-run, and the best-score slot shows `—` both
 * while progress is loading and after a failed load — never a fabricated 0
 * (FR-004). The two cases are told apart by the retry button, not by the slot.
 */

import { RotateCcw } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/games/progress'
import { CONTROL_CLASS, type SaveState } from '../../_components/gameChrome'

const UNKNOWN = '—'

export function SecondaryLine({
  bestScore,
  distance,
  elapsedMs,
  saveState,
  loadFailed,
  onRetryLoad,
}: {
  bestScore: number | null
  distance: number
  elapsedMs: number
  saveState: SaveState
  loadFailed: boolean
  onRetryLoad: () => void
}) {
  const { t } = useLanguage()

  const saveWord =
    saveState === 'saving'
      ? t('games.lostDog.hud.saving')
      : saveState === 'saved'
        ? t('games.lostDog.hud.saved')
        : saveState === 'unsaved'
          ? t('games.lostDog.hud.unsaved')
          : ''

  return (
    <p className="font-tuvi-mono flex w-full max-w-[1120px] items-center justify-center gap-2 text-xs tabular-nums text-(--games-mat-muted)">
      <span className="inline-block min-w-[10ch] text-right">
        {t('games.lostDog.hud.best')} {bestScore === null ? UNKNOWN : bestScore}
      </span>
      {loadFailed && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className={CONTROL_CLASS}
          aria-label={t('games.lostDog.hud.retryLoad')}
          onClick={onRetryLoad}
        >
          <RotateCcw className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </Button>
      )}
      <span aria-hidden>·</span>
      <span className="inline-block min-w-[5ch]">{Math.floor(distance)} m</span>
      <span aria-hidden>·</span>
      <span className="inline-block min-w-[5ch]">{formatTime(elapsedMs)}</span>
      <span aria-hidden>·</span>
      <span className={`inline-block min-w-[8ch] ${saveState === 'unsaved' ? 'text-(--games-ember)' : ''}`}>
        {saveWord}
      </span>
    </p>
  )
}
