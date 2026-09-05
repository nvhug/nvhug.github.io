'use client'

import type { Dispatch, RefObject, SetStateAction } from 'react'

import { Bell, Check, Pin, Plus, X } from 'lucide-react'

import type { Note } from '@/types'

type Translate = (key: string, vars?: Record<string, string | number>) => string

type HabitsSectionProps = {
  addHabit: () => void
  addNotifyTime: (habit: Note) => Promise<void>
  cancelEditingHabit: () => void
  deleteHabit: (id: string) => Promise<void>
  deletingPinnedId: string | null
  editingHabitDraft: string
  editingHabitId: string | null
  habitInputRef: RefObject<HTMLInputElement | null>
  hasWorkHourlySchedule: (times: string[]) => boolean
  notifyDraftTime: string
  notifyEditId: string | null
  notifyTimeOptions: string[]
  pinnedDraft: string
  pinnedNotes: Note[]
  removeNotifyTime: (habit: Note, time: string) => Promise<void>
  removeWorkHourlyNotify: (habit: Note) => Promise<void>
  saveEditingHabit: (habit: Note) => Promise<void>
  savingHabit: boolean
  savingPinned: boolean
  setEditingHabitDraft: Dispatch<SetStateAction<string>>
  setNotifyDraftTime: Dispatch<SetStateAction<string>>
  setNotifyEditId: Dispatch<SetStateAction<string | null>>
  setPinnedDraft: Dispatch<SetStateAction<string>>
  startEditingHabit: (habit: Note) => void
  stripWorkHourlyTimes: (times: string[]) => string[]
  t: Translate
  notesStreak: number
  workHourlyNotifyOption: string
}

export function HabitsSection({
  addHabit,
  addNotifyTime,
  cancelEditingHabit,
  deleteHabit,
  deletingPinnedId,
  editingHabitDraft,
  editingHabitId,
  habitInputRef,
  hasWorkHourlySchedule,
  notifyDraftTime,
  notifyEditId,
  notifyTimeOptions,
  pinnedDraft,
  pinnedNotes,
  removeNotifyTime,
  removeWorkHourlyNotify,
  saveEditingHabit,
  savingHabit,
  savingPinned,
  setEditingHabitDraft,
  setNotifyDraftTime,
  setNotifyEditId,
  setPinnedDraft,
  startEditingHabit,
  stripWorkHourlyTimes,
  t,
  notesStreak,
  workHourlyNotifyOption,
}: HabitsSectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
      <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3">
        <Pin className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('notes.habits.heading')}</span>
        {notesStreak > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-600">
            🔥 {t('notes.habits.dayCount', { n: notesStreak })}
          </span>
        )}
      </div>
      <div className="px-4 py-3 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addHabit()
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={pinnedDraft}
            onChange={(e) => setPinnedDraft(e.target.value)}
            placeholder={t('notes.habits.addPlaceholder')}
            className="flex-1 rounded-lg border border-dashed border-emerald-200 bg-transparent px-3 py-1.5 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white"
          />
          <button
            type="submit"
            disabled={savingPinned || !pinnedDraft.trim()}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('common.add')}
          </button>
        </form>

        {pinnedNotes.length === 0 && !savingPinned && (
          <p className="text-xs text-zinc-400 italic">{t('notes.habits.empty')}</p>
        )}
        {pinnedNotes.map((habit) => (
          <div key={habit.id} className="group flex flex-col gap-2 rounded-xl border border-emerald-100 border-l-2 border-l-emerald-300 bg-white px-3 py-2.5 shadow-[0_1px_4px_0_rgba(16,185,129,0.06)] transition-shadow hover:shadow-[0_3px_10px_0_rgba(16,185,129,0.12)] sm:flex-row sm:items-start">
            {editingHabitId === habit.id ? (
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                <input
                  ref={habitInputRef}
                  type="text"
                  autoFocus
                  value={editingHabitDraft}
                  onChange={(e) => setEditingHabitDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void saveEditingHabit(habit)
                    } else if (e.key === 'Escape') {
                      cancelEditingHabit()
                    }
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500"
                  placeholder={t('notes.habits.placeholder')}
                />
                <div className="flex items-center gap-1 sm:ml-auto">
                  <button
                    type="button"
                    onClick={() => void saveEditingHabit(habit)}
                    disabled={savingHabit || !editingHabitDraft.trim()}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={t('notes.habits.saveAria')}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditingHabit}
                    disabled={savingHabit}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white hover:text-zinc-700 disabled:opacity-40"
                    aria-label={t('notes.habits.cancelAria')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <p
                onDoubleClick={() => startEditingHabit(habit)}
                className="min-w-0 cursor-pointer text-sm font-medium leading-6 text-zinc-700 wrap-break-word transition-colors hover:text-zinc-900 sm:flex-1 sm:pr-2"
              >
                {habit.content}
              </p>
            )}
            <div className="flex items-start gap-2 sm:ml-auto sm:max-w-[70%]">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:justify-end sm:overflow-x-auto sm:pb-0.5">
                {hasWorkHourlySchedule(habit.notify_times || []) && (
                  <span className="group/chip inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] whitespace-nowrap">
                    <Bell className="h-2.5 w-2.5" />
                    {t('notes.habits.hourlyChip')}
                    <button
                      type="button"
                      onClick={() => void removeWorkHourlyNotify(habit)}
                      className="ml-0.5 rounded-full text-emerald-300 opacity-0 transition-opacity group-hover/chip:opacity-100 hover:text-rose-400"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {stripWorkHourlyTimes(habit.notify_times || []).map((time) => (
                  <span key={time} className="group/chip inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] whitespace-nowrap">
                    <Bell className="h-2.5 w-2.5" />
                    {time}
                    <button
                      type="button"
                      onClick={() => void removeNotifyTime(habit, time)}
                      className="ml-0.5 rounded-full text-emerald-300 opacity-0 transition-opacity group-hover/chip:opacity-100 hover:text-rose-400"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {notifyEditId === habit.id ? (
                  <div className="inline-flex items-center gap-1 whitespace-nowrap">
                    <select
                      autoFocus
                      value={notifyDraftTime}
                      onChange={(e) => setNotifyDraftTime(e.target.value)}
                      className="h-8 min-w-28 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
                    >
                      <option value="">{t('notes.habits.chooseTimePlaceholder')}</option>
                      <option value={workHourlyNotifyOption} disabled={hasWorkHourlySchedule(habit.notify_times || [])}>
                        {t('notes.habits.hourlyChipExceptNoon')}
                      </option>
                      {notifyTimeOptions.map((time) => (
                        <option key={time} value={time} disabled={(habit.notify_times || []).includes(time)}>
                          {time}{(habit.notify_times || []).includes(time) ? ` ${t('notes.habits.alreadyAddedSuffix')}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void addNotifyTime(habit)}
                      disabled={!notifyDraftTime || (notifyDraftTime !== workHourlyNotifyOption && (habit.notify_times || []).includes(notifyDraftTime))}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                      aria-label={t('notes.habits.saveTimesAria')}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifyEditId(null)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white hover:text-zinc-700"
                      aria-label={t('notes.habits.cancelTimesAria')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNotifyEditId(habit.id)
                      setNotifyDraftTime('')
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-emerald-200 px-2.5 py-0.5 text-xs text-emerald-400 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 whitespace-nowrap"
                  >
                    <Bell className="h-2.5 w-2.5" />
                    {t('notes.habits.addTime')}
                  </button>
                )}
              </div>
              <button
                type="button"
                disabled={deletingPinnedId === habit.id}
                onClick={() => void deleteHabit(habit.id)}
                className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-300 opacity-20 transition-opacity group-hover:opacity-100 hover:text-rose-400 disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}