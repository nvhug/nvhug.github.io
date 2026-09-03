'use client'

/**
 * The block puzzle's level map. Where a locked or malformed level URL lands,
 * with `?focus=<n>` naming the tile the player asked for so it takes focus
 * (FR-012, T037).
 */

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CAMPAIGN_LEVELS, parMsForLevel, parseLevelParam } from '@/lib/games/block-puzzle/tiers'
import { pendingFor } from '@/lib/games/pending-completions'
import { summarizeCampaign, withPending } from '@/lib/games/progress'
import { BLOCK_PUZZLE_ID } from '@/lib/games/registry'
import { useLanguage } from '@/lib/i18n/language-context'
import { CarvedText } from '../_components/CarvedText'
import { GamesShell } from '../_components/GamesShell'
import { LoadFailedCard } from '../_components/LoadFailedCard'
import { useGameProgress } from '../_hooks/useGameProgress'
import { LevelMap } from './_components/LevelMap'

export default function BlockPuzzleMapPage() {
  // `useSearchParams` needs a boundary in a prerendered client page; the focus
  // hint is the only thing that waits for it.
  return (
    <Suspense fallback={<GamesShell />}>
      <MapContent />
    </Suspense>
  )
}

function MapContent() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const focusLevel = parseLevelParam(searchParams.get('focus') ?? undefined)

  const { records, loading, loadFailed, retry } = useGameProgress(BLOCK_PUZZLE_ID)

  // A level solved but not yet saved shows as done, like it does on the play
  // page; before progress is known nothing shows as done at all (FR-028).
  const effective = records === null ? [] : withPending(records, pendingFor(BLOCK_PUZZLE_ID))
  const summary = summarizeCampaign(effective, CAMPAIGN_LEVELS, parMsForLevel)

  return (
    <GamesShell>
      <div className="games-oak-grain mx-auto w-fit rounded-xl px-5 py-2 shadow-[0_8px_18px_-10px_rgba(0,0,0,0.8)]">
        <CarvedText as="h1" className="text-base sm:text-lg">
          {t('games.blockPuzzle.map.title')}
        </CarvedText>
      </div>

      {loadFailed ? (
        <LoadFailedCard onRetry={retry} />
      ) : (
        <div className="mt-6">
          <LevelMap summary={summary} loading={loading} focusLevel={focusLevel} />
        </div>
      )}
    </GamesShell>
  )
}
