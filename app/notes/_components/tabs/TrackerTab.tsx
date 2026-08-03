'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'

import { BowelTracker } from '@/components/BowelTracker'
import { GymTracker } from '@/components/GymTracker'
import { GymVideoLibrary } from '@/components/GymVideoLibrary'
import { WeightTracker } from '@/components/WeightTracker'

type Translate = (key: string, vars?: Record<string, string | number>) => string

type TrackerSubTab = 'logs' | 'videos'

type TrackerTabProps = {
  isBowelExpanded: boolean
  isGymExpanded: boolean
  isWeightExpanded: boolean
  onToggleBowel: () => void
  onToggleGym: () => void
  onToggleWeight: () => void
  onTrackerSubTabChange: (tab: TrackerSubTab) => void
  t: Translate
  trackerSubTab: TrackerSubTab
}

export function TrackerTab({
  isBowelExpanded,
  isGymExpanded,
  isWeightExpanded,
  onToggleBowel,
  onToggleGym,
  onToggleWeight,
  onTrackerSubTabChange,
  t,
  trackerSubTab,
}: TrackerTabProps) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_20px_40px_-34px_rgba(15,23,42,0.35)]">
        <div className="border-b border-zinc-100 px-3 py-3 sm:px-4">
          <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-50 p-1">
            <button
              type="button"
              onClick={() => onTrackerSubTabChange('logs')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                trackerSubTab === 'logs' ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.1)]' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>🏋️</span>
              {t('notes.tracker.tabLogs')}
            </button>
            <button
              type="button"
              onClick={() => onTrackerSubTabChange('videos')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                trackerSubTab === 'videos' ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.1)]' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>🎬</span>
              {t('notes.tracker.tabVideos')}
            </button>
          </div>
        </div>
      </section>

      {trackerSubTab === 'logs' && (
        <>
          <section className="overflow-hidden rounded-2xl border border-orange-200 bg-[linear-gradient(130deg,#fff7ed_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(234,88,12,0.2)]">
            <div className="flex items-center gap-2 border-b border-orange-100 px-4 py-3">
              <span className="text-xl">🏋️</span>
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">{t('notes.tracker.gymHeading')}</span>
              <button
                type="button"
                onClick={onToggleGym}
                aria-label={isGymExpanded ? t('notes.tracker.collapse') : t('notes.tracker.expand')}
                title={isGymExpanded ? t('notes.tracker.collapse') : t('notes.tracker.expand')}
                className="ml-auto rounded p-1.5 sm:p-1 text-orange-600 hover:bg-orange-100"
              >
                {isGymExpanded ? <ChevronUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <ChevronDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
              </button>
            </div>
            {isGymExpanded && (
              <div className="p-4">
                <GymTracker />
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
            <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3">
              <span className="text-xl">⚖️</span>
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('notes.weight.heading')}</span>
              <button
                type="button"
                onClick={onToggleWeight}
                aria-label={isWeightExpanded ? t('notes.weight.collapse') : t('notes.weight.expand')}
                title={isWeightExpanded ? t('notes.weight.collapse') : t('notes.weight.expand')}
                className="ml-auto rounded p-1.5 sm:p-1 text-emerald-600 hover:bg-emerald-100"
              >
                {isWeightExpanded ? <ChevronUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <ChevronDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
              </button>
            </div>
            {isWeightExpanded && (
              <div className="p-4">
                <WeightTracker />
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-teal-200 bg-[linear-gradient(130deg,#f0fdfa_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(20,184,166,0.2)]">
            <div className="flex items-center gap-2 border-b border-teal-100 px-4 py-3">
              <span className="text-xl">🚽</span>
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">{t('notes.bowel.heading')}</span>
              <button
                type="button"
                onClick={onToggleBowel}
                aria-label={isBowelExpanded ? t('notes.bowel.collapse') : t('notes.bowel.expand')}
                title={isBowelExpanded ? t('notes.bowel.collapse') : t('notes.bowel.expand')}
                className="ml-auto rounded p-1.5 sm:p-1 text-teal-600 hover:bg-teal-100"
              >
                {isBowelExpanded ? <ChevronUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <ChevronDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
              </button>
            </div>
            {isBowelExpanded && (
              <div className="p-4">
                <BowelTracker />
              </div>
            )}
          </section>
        </>
      )}

      {trackerSubTab === 'videos' && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-[linear-gradient(140deg,#f8fafc_0%,#ffffff_100%)] shadow-[0_4px_20px_-10px_rgba(15,23,42,0.24)]">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
            <span className="text-xl">🎬</span>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-700">{t('notes.trackerVideos.heading')}</span>
          </div>
          <div className="p-4">
            <GymVideoLibrary />
          </div>
        </section>
      )}
    </div>
  )
}