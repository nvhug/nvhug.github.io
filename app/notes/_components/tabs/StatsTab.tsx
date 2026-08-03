'use client'

import { CalorieAnalytics } from '@/components/CalorieAnalytics'
import { NotesAIInsights } from '@/components/NotesAIInsights'
import { NotesAnalytics } from '@/components/NotesAnalytics'
import type { Note } from '@/types'

type Translate = (key: string, vars?: Record<string, string | number>) => string

type StatsTabProps = {
  notes: Note[]
  pinnedNotes: Note[]
  t: Translate
}

export function StatsTab({ notes, pinnedNotes, t }: StatsTabProps) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
        <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3">
          <span className="text-xl">📊</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('notes.stats.notesHeading')}</span>
        </div>
        <NotesAnalytics notes={notes} />
      </section>
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
        <div className="border-b border-emerald-100 px-4 py-3.5">
          <h3 className="font-semibold text-zinc-900">{t('notes.stats.calorieHeading')}</h3>
          <p className="mt-1 text-xs text-zinc-600">{t('notes.stats.calorieSubtitle')}</p>
        </div>
        <div className="p-4">
          <CalorieAnalytics />
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-violet-200 bg-[linear-gradient(130deg,#f5f3ff_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(139,92,246,0.2)]">
        <div className="flex items-center gap-2 border-b border-violet-100 px-4 py-3">
          <span className="text-xl">🤖</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">{t('notes.stats.aiHeading')}</span>
        </div>
        <NotesAIInsights notes={notes} habits={pinnedNotes} />
      </section>
    </div>
  )
}