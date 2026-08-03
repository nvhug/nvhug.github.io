'use client'

import { CalendarDays, ListTodo, NotebookPen, Target } from 'lucide-react'
import type { TabType, Translate } from './tabs/types'

type NotesTabsNavProps = {
  currentTab: TabType
  onTabChange: (tab: TabType) => void
  t: Translate
}

export function NotesTabsNav({ currentTab, onTabChange, t }: NotesTabsNavProps) {
  return (
    <div className="flex overflow-x-auto border-b border-emerald-200">
      <button
        onClick={() => onTabChange('notes')}
        className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
          currentTab === 'notes' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-zinc-600 hover:text-zinc-900'
        }`}
      >
        <NotebookPen className="h-4 w-4" />
        <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.notes')}</span>
      </button>
      <button
        onClick={() => onTabChange('todos')}
        className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
          currentTab === 'todos' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-zinc-600 hover:text-zinc-900'
        }`}
      >
        <ListTodo className="h-4 w-4" />
        <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.todos')}</span>
      </button>
      <button
        onClick={() => onTabChange('calo')}
        className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
          currentTab === 'calo' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-zinc-600 hover:text-zinc-900'
        }`}
      >
        <span className="text-base leading-none">🔥</span>
        <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.calo')}</span>
      </button>
      <button
        onClick={() => onTabChange('tracker')}
        className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-base font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
          currentTab === 'tracker' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-zinc-600 hover:text-zinc-900'
        }`}
      >
        <span className="text-base leading-none">📊</span>
        <span className="whitespace-nowrap text-center text-sm leading-tight">{t('notes.tabs.tracker')}</span>
      </button>
      <button
        onClick={() => onTabChange('goals')}
        className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
          currentTab === 'goals' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-zinc-600 hover:text-zinc-900'
        }`}
      >
        <Target className="h-4 w-4" />
        <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.goals')}</span>
      </button>
      <button
        onClick={() => onTabChange('calendar')}
        className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
          currentTab === 'calendar' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-zinc-600 hover:text-zinc-900'
        }`}
      >
        <CalendarDays className="h-4 w-4" />
        <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.calendar')}</span>
      </button>
      <button
        onClick={() => onTabChange('health')}
        className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
          currentTab === 'health' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-zinc-600 hover:text-zinc-900'
        }`}
      >
        <span className="text-base leading-none">💪</span>
        <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.health')}</span>
      </button>
      <button
        onClick={() => onTabChange('stats')}
        className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
          currentTab === 'stats' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-zinc-600 hover:text-zinc-900'
        }`}
      >
        <span className="text-base leading-none">📊</span>
        <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.stats')}</span>
      </button>
    </div>
  )
}