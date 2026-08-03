'use client'

import type { Lang } from '@/lib/i18n/language-context'
import type { Note } from '@/types'
import { HabitsSection } from '../notes/HabitsSection'
import { NotesComposer } from '../notes/NotesComposer'
import { NotesList } from '../notes/NotesList'
import type {
  GroupedTabProps,
  InputRef,
  NoteEditDraft,
  NotesDraft,
  NotesGroup,
  SetState,
  Translate,
  TypeFilter,
  TypeTabCount,
  TextareaRef,
} from './types'

type NotesTabState = {
  allTags: string[]
  busyId: string | null
  deletingPinnedId: string | null
  draft: NotesDraft | null
  editingDraft: NoteEditDraft | null
  editingHabitDraft: string
  editingHabitId: string | null
  editingId: string | null
  lang: Lang
  loading: boolean
  noteGroups: NotesGroup[]
  notesStreak: number
  notifyDraftTime: string
  notifyEditId: string | null
  notifyTimeOptions: string[]
  percentEditId: string | null
  percentEditValue: string
  pinnedDraft: string
  pinnedNotes: Note[]
  savingDraft: boolean
  savingHabit: boolean
  savingPinned: boolean
  searchQuery: string
  typeFilter: TypeFilter
  typeTabs: TypeTabCount[]
  workHourlyNotifyOption: string
}

type NotesTabActions = {
  addHabit: () => void
  addNotifyTime: (habit: Note) => Promise<void>
  cancelDraft: () => void
  cancelEdit: () => void
  cancelEditingHabit: () => void
  deleteHabit: (id: string) => Promise<void>
  openDraft: () => void
  removeNotifyTime: (habit: Note, time: string) => Promise<void>
  removeWorkHourlyNotify: (habit: Note) => Promise<void>
  saveDraft: () => void
  saveEdit: (note: Note) => void
  saveEditingHabit: (habit: Note) => Promise<void>
  savePercentage: (note: Note) => Promise<void>
  setDeleteTarget: SetState<Note | null>
  setEditingHabitDraft: SetState<string>
  setNotifyDraftTime: SetState<string>
  setNotifyEditId: SetState<string | null>
  setPercentEditId: SetState<string | null>
  setPercentEditValue: SetState<string>
  setPinnedDraft: SetState<string>
  setSearchQuery: SetState<string>
  setTypeFilter: SetState<TypeFilter>
  startEdit: (note: Note) => void
  startEditingHabit: (habit: Note) => void
  updateDraft: (patch: Partial<NotesDraft>) => void
  updateEditingDraft: (patch: Partial<NoteEditDraft>) => void
  updatePriority: (note: Note, priority: number) => Promise<void>
}

type NotesTabRefs = {
  editTextareaRef: TextareaRef
  habitInputRef: InputRef
}

type NotesTabUi = {
  autoTextareaClass: string
  hasWorkHourlySchedule: (times: string[]) => boolean
  stripWorkHourlyTimes: (times: string[]) => string[]
  t: Translate
  textareaClass: string
}

type NotesTabProps = GroupedTabProps<NotesTabState, NotesTabActions, NotesTabRefs, NotesTabUi>

export function NotesTab({ actions, refs, state, ui }: NotesTabProps) {
  return (
    <>
      <HabitsSection
        addHabit={actions.addHabit}
        addNotifyTime={actions.addNotifyTime}
        cancelEditingHabit={actions.cancelEditingHabit}
        deleteHabit={actions.deleteHabit}
        deletingPinnedId={state.deletingPinnedId}
        editingHabitDraft={state.editingHabitDraft}
        editingHabitId={state.editingHabitId}
        habitInputRef={refs.habitInputRef}
        hasWorkHourlySchedule={ui.hasWorkHourlySchedule}
        notifyDraftTime={state.notifyDraftTime}
        notifyEditId={state.notifyEditId}
        notifyTimeOptions={state.notifyTimeOptions}
        pinnedDraft={state.pinnedDraft}
        pinnedNotes={state.pinnedNotes}
        removeNotifyTime={actions.removeNotifyTime}
        removeWorkHourlyNotify={actions.removeWorkHourlyNotify}
        saveEditingHabit={actions.saveEditingHabit}
        savingHabit={state.savingHabit}
        savingPinned={state.savingPinned}
        setEditingHabitDraft={actions.setEditingHabitDraft}
        setNotifyDraftTime={actions.setNotifyDraftTime}
        setNotifyEditId={actions.setNotifyEditId}
        setPinnedDraft={actions.setPinnedDraft}
        startEditingHabit={actions.startEditingHabit}
        stripWorkHourlyTimes={ui.stripWorkHourlyTimes}
        t={ui.t}
        notesStreak={state.notesStreak}
        workHourlyNotifyOption={state.workHourlyNotifyOption}
      />
      <NotesComposer
        allTags={state.allTags}
        cancelDraft={actions.cancelDraft}
        draft={state.draft}
        openDraft={actions.openDraft}
        saveDraft={actions.saveDraft}
        savingDraft={state.savingDraft}
        t={ui.t}
        textareaClass={ui.textareaClass}
        updateDraft={actions.updateDraft}
      />
      <NotesList
        allTags={state.allTags}
        autoTextareaClass={ui.autoTextareaClass}
        busyId={state.busyId}
        cancelEdit={actions.cancelEdit}
        editTextareaRef={refs.editTextareaRef}
        editingDraft={state.editingDraft}
        editingId={state.editingId}
        lang={state.lang}
        loading={state.loading}
        noteGroups={state.noteGroups}
        percentEditId={state.percentEditId}
        percentEditValue={state.percentEditValue}
        saveEdit={actions.saveEdit}
        savePercentage={actions.savePercentage}
        searchQuery={state.searchQuery}
        setDeleteTarget={actions.setDeleteTarget}
        setPercentEditId={actions.setPercentEditId}
        setPercentEditValue={actions.setPercentEditValue}
        setSearchQuery={actions.setSearchQuery}
        setTypeFilter={actions.setTypeFilter}
        startEdit={actions.startEdit}
        t={ui.t}
        typeFilter={state.typeFilter}
        typeTabs={state.typeTabs}
        updateEditingDraft={actions.updateEditingDraft}
        updatePriority={actions.updatePriority}
      />
    </>
  )
}