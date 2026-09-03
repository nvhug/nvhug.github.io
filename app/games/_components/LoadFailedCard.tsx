'use client'

/**
 * Progress could not be loaded: the error state with a retry control that
 * FR-028 requires, shared by the hub and every level map. The play page does
 * not use it — there the level is still playable, so a toast is the whole
 * report (FR-044).
 */

import { useLanguage } from '@/lib/i18n/language-context'
import { Button } from '@/components/ui/button'

export function LoadFailedCard({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage()

  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
      <p className="text-sm text-(--games-mat-text)">{t('games.errors.loadFailed')}</p>
      <Button
        type="button"
        variant="ghost"
        className="border border-white/15 text-(--games-mat-text) hover:bg-white/10 hover:text-(--games-mat-text)"
        onClick={onRetry}
      >
        {t('games.errors.retry')}
      </Button>
    </div>
  )
}
