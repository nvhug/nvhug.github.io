'use client'

/**
 * One registered game as a wooden plaque — the box a puzzle comes in, not a
 * store tile (DESIGN § Layout).
 *
 * Everything it shows comes from the registry entry and the `GameSummary` that
 * entry produced, so a score-based game renders here with no edit (FR-050).
 * The progress line keeps its height while progress is unknown (FR-047).
 */

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/language-context'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GameDefinition, GameSummary } from '@/lib/games/registry'
import { CarvedText } from './CarvedText'

export function GameCard({
  definition,
  summary,
  loading,
}: {
  definition: GameDefinition
  summary: GameSummary
  loading: boolean
}) {
  const { t } = useLanguage()
  const Icon = definition.icon
  const started = summary.completed > 0

  const progressLine = () => {
    if (loading) return ''
    if (summary.total !== undefined) {
      const parts = [t('games.hub.progressLine', { completed: summary.completed, total: summary.total })]
      if (summary.stars !== undefined) parts.push(t('games.hub.starsLine', { stars: summary.stars }))
      return parts.join(' · ')
    }
    if (summary.bestScore !== null && summary.bestScore !== undefined) {
      return t('games.hub.bestScoreLine', { score: summary.bestScore })
    }
    // No campaign length and no score: the count is all there is. Reusing the
    // '{completed} / {total}' line here would render '4 / 4' and read as a
    // finished campaign.
    if (summary.completed > 0) return t('games.hub.completedLine', { completed: summary.completed })
    return ''
  }

  return (
    <article className="rounded-2xl bg-linear-to-b from-(--games-walnut) to-(--games-walnut-deep) p-1.5 shadow-[0_18px_36px_-22px_rgba(0,0,0,0.85)]">
      <div className="games-oak-grain flex h-full flex-col gap-3 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-black/10 p-2 text-(--games-cavity) shadow-[inset_0_1px_0_var(--games-oak-light)]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <CarvedText as="h2" className="text-base">
              {t(`${definition.i18nKey}.name`)}
            </CarvedText>
            <p className="mt-0.5 text-xs text-(--games-cavity)/70">
              {t(`games.categories.${definition.category}`)}
            </p>
          </div>
        </div>

        <p className="text-sm text-(--games-cavity)/85">{t(`${definition.i18nKey}.description`)}</p>

        <p className="font-tuvi-mono min-h-5 text-sm tabular-nums text-(--games-cavity)">
          {progressLine()}
        </p>

        <Link
          href={summary.continueHref}
          className={cn(
            buttonVariants({ variant: 'default' }),
            'mt-auto w-full bg-(--games-cavity) text-(--games-oak-light) shadow-[0_3px_0_rgba(0,0,0,0.35)] hover:bg-(--games-walnut-deep)',
          )}
        >
          {started ? t('games.hub.continue') : t('games.hub.start')}
        </Link>
      </div>
    </article>
  )
}
