'use client'

import { CalendarDays } from 'lucide-react'

import { CalendarView } from '@/components/CalendarView'
import type { CalendarEvent } from '@/types'

type Translate = (key: string, vars?: Record<string, string | number>) => string

type CalendarTabProps = {
  calendarEvents: CalendarEvent[]
  onEventsChange: () => Promise<void>
  t: Translate
}

export function CalendarTab({ calendarEvents, onEventsChange, t }: CalendarTabProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)] sm:w-[66vw] sm:relative sm:left-1/2 sm:-translate-x-1/2">
      <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3">
        <CalendarDays className="h-4 w-4 text-emerald-600" />
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('notes.calendar.heading')}</span>
      </div>
      <div className="p-4">
        <CalendarView events={calendarEvents} onEventsChange={onEventsChange} />
      </div>
    </section>
  )
}