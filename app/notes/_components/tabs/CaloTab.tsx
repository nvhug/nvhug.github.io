'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'

import { CalorieTracker } from '@/components/CalorieTracker'
import { MealScheduleTracker } from '@/components/MealScheduleTracker'

type Translate = (key: string, vars?: Record<string, string | number>) => string

type CaloTabProps = {
  isMealsExpanded: boolean
  onToggleMeals: () => void
  t: Translate
}

export function CaloTab({ isMealsExpanded, onToggleMeals, t }: CaloTabProps) {
  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
        <div className="border-b border-emerald-100 px-4 py-3.5">
          <h3 className="font-semibold text-zinc-900">{t('notes.calo.heading')}</h3>
          <p className="mt-1 text-xs text-zinc-600">{t('notes.calo.subtitle')}</p>
        </div>
        <div className="p-4">
          <CalorieTracker />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-[0_4px_20px_-8px_rgba(234,88,12,0.25)]">
        <div className="flex items-center gap-2 border-b border-orange-100 px-4 py-3.5">
          <span className="text-xl">🍽️</span>
          <h3 className="font-semibold text-zinc-900">{t('notes.meals.heading')}</h3>
          <button
            type="button"
            onClick={onToggleMeals}
            aria-label={isMealsExpanded ? t('notes.meals.collapse') : t('notes.meals.expand')}
            title={isMealsExpanded ? t('notes.meals.collapse') : t('notes.meals.expand')}
            className="ml-auto rounded p-1.5 sm:p-1 text-orange-600 hover:bg-orange-100"
          >
            {isMealsExpanded ? (
              <ChevronUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            ) : (
              <ChevronDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            )}
          </button>
        </div>
        {isMealsExpanded && (
          <div className="p-4">
            <MealScheduleTracker />
          </div>
        )}
      </section>
    </>
  )
}