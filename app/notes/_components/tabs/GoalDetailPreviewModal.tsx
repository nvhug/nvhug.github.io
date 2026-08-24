'use client'

import { useEffect } from 'react'

import { CheckCircle2, Circle, Pencil, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getIntlLocale } from '@/lib/i18n/locale'
import { computeGoalDisplayStatus, computeGoalProgress, formatLocalDateString, parseLocalDate } from '../../_lib/goalsUtils'
import type { Lang } from '@/lib/i18n/language-context'
import type { Goal, GoalItem } from '@/types'
import type { Translate } from './types'

type Props = {
  goal: Goal
  items: GoalItem[]
  lang: Lang
  onClose: () => void
  onEdit: (goal: Goal) => void
  t: Translate
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-rose-100 text-rose-700',
  completed: 'bg-zinc-100 text-zinc-700',
  archived: 'bg-zinc-100 text-zinc-500',
}

export function GoalDetailPreviewModal({ goal, items, lang, onClose, onEdit, t }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const now = new Date()
  const displayStatus = computeGoalDisplayStatus(goal.status, goal.target_date, formatLocalDateString(now))
  const statusLabel =
    displayStatus === 'overdue' ? t('notes.goals.statusOverdue') : t(`notes.goals.statusOptions.${displayStatus}`)
  const progress = computeGoalProgress(goal.start_date, goal.target_date, now)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-preview-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <h2 id="goal-preview-title" className="truncate font-poppins text-sm font-semibold text-zinc-900">
              {goal.title}
            </h2>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[displayStatus] || STATUS_BADGE_CLASS.active}`}>
              {statusLabel}
            </span>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label={t('notes.goals.previewClose')}
            className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 sm:p-1"
          >
            <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {(goal.start_date || goal.target_date) && (
            <div className="mb-3 space-y-1 text-sm text-zinc-600">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                {goal.start_date && (
                  <span>
                    📅 <span className="font-medium text-zinc-700">{parseLocalDate(goal.start_date).toLocaleDateString(getIntlLocale(lang))}</span>
                  </span>
                )}
                {goal.target_date && (
                  <span>
                    🎯 <span className="font-medium text-zinc-700">{parseLocalDate(goal.target_date).toLocaleDateString(getIntlLocale(lang))}</span>
                  </span>
                )}
              </div>
              {progress && (
                <div>
                  ⏱️{' '}
                  {t('notes.goals.previewDaysLabel', {
                    elapsed: Math.max(0, progress.elapsedDays),
                    total: progress.totalDays,
                  })}
                </div>
              )}
            </div>
          )}

          <p className="mb-4 whitespace-pre-wrap text-sm text-zinc-600">
            {goal.description || <span className="text-zinc-400">{t('notes.goals.previewNoDescription')}</span>}
          </p>

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-zinc-400">{t('notes.goals.previewNoItems')}</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-start gap-2 rounded-lg border border-emerald-50 bg-emerald-50/50 p-2">
                  <span className="mt-0.5 shrink-0 text-emerald-600">
                    {item.is_completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </span>
                  <p className="text-sm text-zinc-700">{item.content}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-zinc-100 px-5 py-4">
          <Button variant="ghost" className="flex-1 border border-zinc-200 text-zinc-700 hover:bg-zinc-50" onClick={onClose}>
            {t('notes.goals.previewClose')}
          </Button>
          <Button
            variant="ghost"
            className="flex-1 border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={() => onEdit(goal)}
          >
            <Pencil className="mr-1.5 h-4 w-4 sm:h-3.5 sm:w-3.5" />
            {t('notes.goals.previewEdit')}
          </Button>
        </div>
      </div>
    </div>
  )
}
