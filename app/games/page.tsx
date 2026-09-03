'use client'

/**
 * The Games Hub. It renders `GAMES` and nothing else: adding a game is one
 * registry entry plus that game's pages, with no edit here (FR-049, FR-051).
 *
 * One progress query serves every card — the rows are grouped by `game_id` and
 * each entry summarises only its own (FR-050).
 */

import { groupByGame, withPending } from '@/lib/games/progress'
import { list } from '@/lib/games/pending-completions'
import { GAMES } from '@/lib/games/registry'
import { useLanguage } from '@/lib/i18n/language-context'
import { CarvedText } from './_components/CarvedText'
import { GameCard } from './_components/GameCard'
import { GamesShell } from './_components/GamesShell'
import { LoadFailedCard } from './_components/LoadFailedCard'
import { useGameProgress } from './_hooks/useGameProgress'

export default function GamesHubPage() {
  const { t } = useLanguage()
  const { records, loading, loadFailed, retry } = useGameProgress()

  // A completion still queued for saving counts on its card; while progress is
  // unknown nothing counts at all (FR-028).
  const grouped = groupByGame(records === null ? [] : withPending(records, list()))

  return (
    <GamesShell>
      <div className="games-oak-grain mx-auto w-fit rounded-xl px-5 py-2 shadow-[0_8px_18px_-10px_rgba(0,0,0,0.8)]">
        <CarvedText as="h1" className="text-lg sm:text-xl">
          {t('games.hub.title')}
        </CarvedText>
      </div>
      <p className="mt-3 text-center text-sm text-(--games-mat-muted)">{t('games.hub.subtitle')}</p>

      {loadFailed && <LoadFailedCard onRetry={retry} />}

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GAMES.map((definition) => (
          <GameCard
            key={definition.id}
            definition={definition}
            summary={definition.summarize(grouped.get(definition.id) ?? [])}
            loading={loading}
          />
        ))}
      </div>
    </GamesShell>
  )
}
