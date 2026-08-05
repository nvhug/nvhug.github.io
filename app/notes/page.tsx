'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useCalorieGoal } from '@/lib/useCalorieGoal'
import { Note, Todo, Goal, GoalItem, BuyPick } from '@/types'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useLanguage } from '@/lib/i18n/language-context'
import { getTodayLocalISODate } from '@/lib/date'
import { NotesPageHeader } from './_components/NotesPageHeader'
import { NotesTabsNav } from './_components/NotesTabsNav'
import { useBuyPicksActions } from './_hooks/useBuyPicksActions'
import { useGoalsActions } from './_hooks/useGoalsActions'
import { useNotesData } from './_hooks/useNotesData'
import { useNotesPreferences } from './_hooks/useNotesPreferences'
import { useNotesViewModel } from './_hooks/useNotesViewModel'
import { useTodosActions } from './_hooks/useTodosActions'
import { CaloTab } from './_components/tabs/CaloTab'
import { CalendarTab } from './_components/tabs/CalendarTab'
import { GoalsTab } from './_components/tabs/GoalsTab'
import { HealthTab } from './_components/tabs/HealthTab'
import { NotesTab } from './_components/tabs/NotesTab'
import { StatsTab } from './_components/tabs/StatsTab'
import { TrackerTab } from './_components/tabs/TrackerTab'
import { TodosTab } from './_components/tabs/TodosTab'
import type { BuyPickFormState, GoalDraft, GoalItemDraft, NoteEditDraft, NotesDraft, TabType, TodoFilter } from './_components/tabs/types'

type Draft = NotesDraft
type EditDraft = NoteEditDraft

const VALID_TABS: TabType[] = ['notes', 'todos', 'goals', 'calo', 'health', 'stats', 'tracker', 'calendar']
const TAB_CHANGE_EVENT = 'tab-hash-change'

const NOTIFY_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

const WORK_HOURLY_NOTIFY_OPTION = '__work-hourly__'

const WORK_HOURLY_NOTIFY_TIMES = Array.from({ length: 10 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`).filter(
  (time) => time !== '12:00' && time !== '17:00'
)

function subscribeToTabHash(callback: () => void) {
  window.addEventListener(TAB_CHANGE_EVENT, callback)
  window.addEventListener('hashchange', callback)
  return () => {
    window.removeEventListener(TAB_CHANGE_EVENT, callback)
    window.removeEventListener('hashchange', callback)
  }
}

function getTabFromHash(): TabType {
  const hash = window.location.hash.slice(1)
  if (hash === 'meals') return 'calo'
  if ((VALID_TABS as readonly string[]).includes(hash)) {
    return hash as TabType
  }
  return 'notes'
}

function todayDate() {
  return getTodayLocalISODate()
}

function hasWorkHourlySchedule(times: string[]) {
  return WORK_HOURLY_NOTIFY_TIMES.every((time) => times.includes(time))
}

function stripWorkHourlyTimes(times: string[]) {
  return times.filter((time) => !WORK_HOURLY_NOTIFY_TIMES.includes(time))
}

const textareaClass =
  'w-full resize-y rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400'

const autoTextareaClass =
  'w-full min-h-24 resize-none overflow-y-hidden rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400'

export default function NotesPage() {
  const { t, lang } = useLanguage()
  const currentTab = useSyncExternalStore(
    subscribeToTabHash,
    getTabFromHash,
    () => 'notes' as TabType,
  )

  const handleTabChange = (tab: TabType) => {
    window.history.pushState(null, '', `#${tab}`)
    window.dispatchEvent(new Event(TAB_CHANGE_EVENT))
  }

  const [pinnedDraft, setPinnedDraft] = useState('')
  const [savingPinned, setSavingPinned] = useState(false)
  const [deletingPinnedId, setDeletingPinnedId] = useState<string | null>(null)
  const [notifyEditId, setNotifyEditId] = useState<string | null>(null)
  const [notifyDraftTime, setNotifyDraftTime] = useState('')
  const { goal: dailyCalorieGoal } = useCalorieGoal()

  const [todoDraft, setTodoDraft] = useState('')
  const [savingTodo, setSavingTodo] = useState(false)
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('all')
  const [deleteTodo, setDeleteTodo] = useState<Todo | null>(null)
  const [deletingTodo, setDeletingTodo] = useState(false)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editingTodoDraft, setEditingTodoDraft] = useState('')

  const [addingBuyPick, setAddingBuyPick] = useState(false)
  const [editingBuyPickId, setEditingBuyPickId] = useState<string | null>(null)
  const [buyPickForm, setBuyPickForm] = useState<BuyPickFormState>({ category: '', emoji: '🛒', brands: [], note: '', brandInput: '' })
  const [deleteBuyPick, setDeleteBuyPick] = useState<BuyPick | null>(null)
  const [deletingBuyPick, setDeletingBuyPick] = useState(false)
  const [savingBuyPick, setSavingBuyPick] = useState(false)

  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null)
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalFilter, setGoalFilter] = useState<'active' | 'completed' | 'all'>('active')
  const [deleteGoal, setDeleteGoal] = useState<Goal | null>(null)
  const [deletingGoal, setDeletingGoal] = useState(false)
  const [goalItemDraft, setGoalItemDraft] = useState<{ [goalId: string]: GoalItemDraft }>({})
  const [savingGoalItem, setSavingGoalItem] = useState(false)
  const [deleteGoalItem, setDeleteGoalItem] = useState<GoalItem | null>(null)
  const [deletingGoalItem, setDeletingGoalItem] = useState(false)
  const [editingGoalItemId, setEditingGoalItemId] = useState<string | null>(null)
  const [editingGoalItemDraft, setEditingGoalItemDraft] = useState<GoalItemDraft | null>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editingGoalDraft, setEditingGoalDraft] = useState<GoalDraft | null>(null)

  const [editingHabitId, setEditingHabitId] = useState<string | null>(null)
  const [editingHabitDraft, setEditingHabitDraft] = useState('')
  const [savingHabit, setSavingHabit] = useState(false)
  const habitInputRef = useRef<HTMLInputElement | null>(null)
  const {
    collapsedGoalIds,
    expandedGoal,
    isBowelExpanded,
    isGymExpanded,
    isMealsExpanded,
    isWeightExpanded,
    setCollapsedGoalIds,
    setExpandedGoal,
    setIsBowelExpanded,
    setIsGymExpanded,
    setIsMealsExpanded,
    setIsWeightExpanded,
    setTrackerSubTab,
    trackerSubTab,
  } = useNotesPreferences()

  const {
    buyPicks,
    calendarEvents,
    fetchCalendarEvents,
    fetchGoalItems,
    fetchNotes,
    fetchTodos,
    goalItems,
    goals,
    healthPosts,
    initializeData,
    loading,
    notes,
    pinnedNotes,
    setBuyPicks,
    setGoalItems,
    setGoals,
    setNotes,
    setPinnedNotes,
    setTodos,
    todayCalories,
    todos,
  } = useNotesData()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<EditDraft | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [percentEditId, setPercentEditId] = useState<string | null>(null)
  const [percentEditValue, setPercentEditValue] = useState('')
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const goalDescriptionRef = useRef<HTMLTextAreaElement | null>(null)
  const editingGoalDescriptionRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const el = editTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editingId, editingDraft?.content])

  useLayoutEffect(() => {
    const el = goalDescriptionRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [goalDraft?.description])

  useLayoutEffect(() => {
    const el = editingGoalDescriptionRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editingGoalDraft?.description])

  const {
    allTags,
    counts,
    noteGroups,
    notesStreak,
    searchQuery,
    setSearchQuery,
    setTypeFilter,
    typeFilter,
    typeTabs,
  } = useNotesViewModel({ notes, t, todos })


  const { addTodo, confirmDeleteTodo, saveEditingTodo, toggleTodo } = useTodosActions({
    deleteTodo,
    editingTodoDraft,
    fetchTodos,
    setDeleteTodo,
    setDeletingTodo,
    setEditingTodoId,
    setSavingTodo,
    setTodoDraft,
    setTodos,
    t,
    todoDraft,
  })

  const { cancelBuyPickForm, confirmDeleteBuyPick, openAddBuyPick, saveBuyPick, startEditBuyPick, toggleBuyPickPurchased, updateBuyPickDetails } = useBuyPicksActions({
    buyPickForm,
    buyPicks,
    deleteBuyPick,
    editingBuyPickId,
    setAddingBuyPick,
    setBuyPickForm,
    setBuyPicks,
    setDeleteBuyPick,
    setDeletingBuyPick,
    setEditingBuyPickId,
    setSavingBuyPick,
    t,
  })

  const {
    addGoal,
    addGoalItem,
    cancelEditingGoal,
    cancelEditingGoalItem,
    cancelGoalDraft,
    confirmDeleteGoal,
    confirmDeleteGoalItem,
    openGoalDraft,
    reorderGoalItems,
    saveEditingGoal,
    saveEditingGoalItem,
    startEditingGoal,
    startEditingGoalItem,
    toggleGoalItem,
    updateGoalStatus,
  } = useGoalsActions({
    deleteGoal,
    deleteGoalItem,
    editingGoalDraft,
    editingGoalItemDraft,
    expandedGoal,
    fetchGoalItems,
    goalDraft,
    goalItemDraft,
    goalItems,
    setCollapsedGoalIds,
    setDeleteGoal,
    setDeleteGoalItem,
    setDeletingGoal,
    setDeletingGoalItem,
    setEditingGoalDraft,
    setEditingGoalId,
    setEditingGoalItemDraft,
    setEditingGoalItemId,
    setExpandedGoal,
    setGoalDraft,
    setGoalItemDraft,
    setGoalItems,
    setGoals,
    setSavingGoal,
    setSavingGoalItem,
    t,
  })

  useEffect(() => {
    void initializeData()
  }, [initializeData])

  useEffect(() => {
    if (expandedGoal && !goalItems[expandedGoal]) {
      void (async () => {
        const items = await fetchGoalItems(expandedGoal)
        setGoalItems((prev) => ({ ...prev, [expandedGoal]: items }))
      })()
    }
  }, [expandedGoal, goalItems, fetchGoalItems, setGoalItems])

  useEffect(() => {
    if (goals.length === 0) return
    const validIds = new Set(goals.map((g) => g.id))
    setCollapsedGoalIds((prev) => {
      const filtered = prev.filter((id) => validIds.has(id))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [goals, setCollapsedGoalIds])

  function openDraft() {
    setDraft({
      note_date: todayDate(),
      content: '',
      type: 'good',
      priority: 3,
      completion_percentage: 0,
      tags: [],
      hide_meta: true,
    })
  }

  function cancelDraft() {
    setDraft(null)
  }

  async function addHabit() {
    const content = pinnedDraft.trim()
    if (!content) return
    setSavingPinned(true)
    try {
      const { error } = await supabase.from('notes').insert([{
        note_date: todayDate(),
        content,
        type: 'good',
        status: 'in_progress',
        priority: 5,
        completion_percentage: 0,
        tags: [],
        hide_meta: true,
        pinned: true,
      }])
      if (error) throw error
      setPinnedDraft('')
      await fetchNotes(false)
    } catch {
      toast.error(t('notes.habits.addError'))
    } finally {
      setSavingPinned(false)
    }
  }

  async function deleteHabit(id: string) {
    setDeletingPinnedId(id)
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
      setPinnedNotes((prev) => prev.filter((n) => n.id !== id))
    } catch {
      toast.error(t('notes.habits.deleteError'))
    } finally {
      setDeletingPinnedId(null)
    }
  }

  function startEditingHabit(habit: Note) {
    setEditingHabitId(habit.id)
    setEditingHabitDraft(habit.content)
  }

  function cancelEditingHabit() {
    setEditingHabitId(null)
    setEditingHabitDraft('')
  }

  async function saveEditingHabit(habit: Note) {
    const content = editingHabitDraft.trim()
    if (!content) {
      toast.error(t('notes.toasts.contentEmptyError'))
      return
    }

    setSavingHabit(true)
    try {
      const { error } = await supabase.from('notes').update({ content }).eq('id', habit.id)
      if (error) throw error
      setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, content } : n)))
      setEditingHabitId(null)
      setEditingHabitDraft('')
      toast.success(t('notes.habits.updateSuccess'))
    } catch {
      toast.error(t('notes.habits.updateError'))
    } finally {
      setSavingHabit(false)
    }
  }

  async function addNotifyTime(habit: Note) {
    if (!notifyDraftTime) return
    const currentTimes = habit.notify_times || []
    const nextTimes =
      notifyDraftTime === WORK_HOURLY_NOTIFY_OPTION
        ? [...currentTimes, ...WORK_HOURLY_NOTIFY_TIMES]
        : [...currentTimes, notifyDraftTime]

    const updated = [...new Set(nextTimes)].sort()

    if (updated.length === currentTimes.length) {
      setNotifyEditId(null)
      setNotifyDraftTime('')
      toast.error(t('notes.habits.timeSlotAlreadyAdded'))
      return
    }

    setNotifyEditId(null)
    setNotifyDraftTime('')
    setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: updated } : n)))
    try {
      const { error } = await supabase.from('notes').update({ notify_times: updated }).eq('id', habit.id)
      if (error) throw error
    } catch {
      toast.error(t('notes.habits.notifyUpdateError'))
      setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: habit.notify_times } : n)))
    }
  }

  async function removeNotifyTime(habit: Note, time: string) {
    const updated = (habit.notify_times || []).filter((t) => t !== time)
    setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: updated } : n)))
    try {
      const { error } = await supabase.from('notes').update({ notify_times: updated }).eq('id', habit.id)
      if (error) throw error
    } catch {
      toast.error(t('notes.toasts.updateError'))
      setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: habit.notify_times } : n)))
    }
  }

  async function removeWorkHourlyNotify(habit: Note) {
    const updated = stripWorkHourlyTimes(habit.notify_times || [])
    setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: updated } : n)))
    try {
      const { error } = await supabase.from('notes').update({ notify_times: updated }).eq('id', habit.id)
      if (error) throw error
    } catch {
      toast.error(t('notes.toasts.updateError'))
      setPinnedNotes((prev) => prev.map((n) => (n.id === habit.id ? { ...n, notify_times: habit.notify_times } : n)))
    }
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  async function saveDraft() {
    if (!draft) return
    const content = draft.content.trim()
    if (!content) return

    setSavingDraft(true)
    try {
      const { error } = await supabase.from('notes').insert([
        {
          note_date: draft.note_date,
          content,
          type: draft.type,
          status: 'in_progress',
          priority: draft.priority,
          completion_percentage: draft.completion_percentage,
          tags: draft.tags,
          hide_meta: draft.hide_meta,
        },
      ])
      if (error) throw error
      setDraft(null)
      await fetchNotes()
    } catch (error) {
      console.error('Error creating note:', error)
      toast.error(t('notes.list.addError'))
    } finally {
      setSavingDraft(false)
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id)
    setEditingDraft({
      content: note.content,
      type: note.type,
      priority: note.priority ?? 3,
      completion_percentage: note.completion_percentage ?? 0,
      tags: note.tags ?? [],
      hide_meta: note.hide_meta ?? false,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingDraft(null)
  }

  function updateEditingDraft(patch: Partial<EditDraft>) {
    setEditingDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  async function saveEdit(note: Note) {
    if (!editingDraft) return
    const content = editingDraft.content.trim()
    if (!content) return

    const update = {
      content,
      type: editingDraft.type,
      priority: editingDraft.priority,
      completion_percentage: editingDraft.completion_percentage,
      tags: editingDraft.tags,
      hide_meta: editingDraft.hide_meta,
    }

    setBusyId(note.id)
    try {
      const { error } = await supabase.from('notes').update(update).eq('id', note.id)
      if (error) throw error
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, ...update } : n)))
      cancelEdit()
    } catch (error) {
      console.error('Error updating note:', error)
      toast.error(t('notes.list.updateError'))
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('notes').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success(t('notes.list.deleteSuccess'))
    } catch (error) {
      console.error('Error deleting note:', error)
      toast.error(t('notes.list.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  async function updatePriority(note: Note, priority: number) {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, priority } : n)))
    try {
      const { error } = await supabase.from('notes').update({ priority }).eq('id', note.id)
      if (error) throw error
    } catch {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, priority: note.priority } : n)))
      toast.error(t('notes.toasts.updateError'))
    }
  }

  async function savePercentage(note: Note) {
    const pct = Math.min(100, Math.max(0, Number(percentEditValue) || 0))
    setPercentEditId(null)
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, completion_percentage: pct } : n)))
    try {
      const { error } = await supabase.from('notes').update({ completion_percentage: pct }).eq('id', note.id)
      if (error) throw error
    } catch {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, completion_percentage: note.completion_percentage } : n)))
      toast.error(t('notes.toasts.updateError'))
    }
  }

  return (
    <main className="notes-page min-h-svh bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_35%),radial-gradient(circle_at_80%_18%,rgba(52,211,153,0.16),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f6fef9_100%)] px-4 pb-10 pt-24 text-zinc-900 sm:px-6 sm:pt-28">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#ffffff_0%,#f7fef9_45%,#ecfdf5_100%)] p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.45)]">
          <NotesPageHeader counts={counts} todayCalories={todayCalories} dailyCalorieGoal={dailyCalorieGoal} t={t} />
        </section>

        <NotesTabsNav currentTab={currentTab} onTabChange={handleTabChange} t={t} />

        {currentTab === 'notes' && (
        <NotesTab
          state={{
            allTags,
            busyId,
            deletingPinnedId,
            draft,
            editingDraft,
            editingHabitDraft,
            editingHabitId,
            editingId,
            lang,
            loading,
            noteGroups,
            notesStreak,
            notifyDraftTime,
            notifyEditId,
            notifyTimeOptions: NOTIFY_TIME_OPTIONS,
            percentEditId,
            percentEditValue,
            pinnedDraft,
            pinnedNotes,
            savingDraft,
            savingHabit,
            savingPinned,
            searchQuery,
            typeFilter,
            typeTabs,
            workHourlyNotifyOption: WORK_HOURLY_NOTIFY_OPTION,
          }}
          actions={{
            addHabit,
            addNotifyTime,
            cancelDraft,
            cancelEdit,
            cancelEditingHabit,
            deleteHabit,
            openDraft,
            removeNotifyTime,
            removeWorkHourlyNotify,
            saveDraft,
            saveEdit,
            saveEditingHabit,
            savePercentage,
            setDeleteTarget,
            setEditingHabitDraft,
            setNotifyDraftTime,
            setNotifyEditId,
            setPercentEditId,
            setPercentEditValue,
            setPinnedDraft,
            setSearchQuery,
            setTypeFilter,
            startEdit,
            startEditingHabit,
            updateDraft,
            updateEditingDraft,
            updatePriority,
          }}
          refs={{
            editTextareaRef,
            habitInputRef,
          }}
          ui={{
            autoTextareaClass,
            hasWorkHourlySchedule,
            stripWorkHourlyTimes,
            t,
            textareaClass,
          }}
        />
        )}

        {currentTab === 'todos' && (
        <TodosTab
          state={{
            addingBuyPick,
            buyPickForm,
            buyPicks,
            editingBuyPickId,
            editingTodoDraft,
            editingTodoId,
            savingBuyPick,
            savingTodo,
            todoDraft,
            todoFilter,
            todos,
          }}
          actions={{
            addTodo,
            cancelBuyPickForm,
            openAddBuyPick,
            saveBuyPick,
            saveEditingTodo,
            setBuyPickForm,
            setDeleteBuyPick,
            setDeleteTodo,
            setEditingTodoDraft,
            setEditingTodoId,
            setTodoDraft,
            setTodoFilter,
            startEditBuyPick,
            toggleBuyPickPurchased,
            updateBuyPickDetails,
            toggleTodo,
          }}
          refs={{}}
          ui={{ t }}
        />
        )}

        {currentTab === 'goals' && (
        <GoalsTab
          state={{
            collapsedGoalIds,
            deleteGoalItem,
            draggedItemId,
            dragOverItemId,
            editingGoalDraft,
            editingGoalId,
            editingGoalItemDraft,
            editingGoalItemId,
            expandedGoal,
            goalDraft,
            goalFilter,
            goalItemDraft,
            goalItems,
            goals,
            lang,
            savingGoal,
            savingGoalItem,
          }}
          actions={{
            addGoal,
            addGoalItem,
            cancelEditingGoal,
            cancelEditingGoalItem,
            cancelGoalDraft,
            openGoalDraft,
            reorderGoalItems,
            saveEditingGoal,
            saveEditingGoalItem,
            setCollapsedGoalIds,
            setDeleteGoal,
            setDeleteGoalItem,
            setDraggedItemId,
            setDragOverItemId,
            setEditingGoalDraft,
            setEditingGoalItemDraft,
            setExpandedGoal,
            setGoalDraft,
            setGoalFilter,
            setGoalItemDraft,
            startEditingGoal,
            startEditingGoalItem,
            toggleGoalItem,
            updateGoalStatus,
          }}
          refs={{
            editingGoalDescriptionRef,
            goalDescriptionRef,
          }}
          ui={{
            autoTextareaClass,
            t,
          }}
        />
        )}

        {currentTab === 'calo' && (
        <CaloTab isMealsExpanded={isMealsExpanded} onToggleMeals={() => setIsMealsExpanded((prev) => !prev)} t={t} />
        )}

        {currentTab === 'health' && (
        <HealthTab healthPosts={healthPosts} t={t} />
        )}

        {currentTab === 'tracker' && (
        <TrackerTab
          isBowelExpanded={isBowelExpanded}
          isGymExpanded={isGymExpanded}
          isWeightExpanded={isWeightExpanded}
          onToggleBowel={() => setIsBowelExpanded((prev) => !prev)}
          onToggleGym={() => setIsGymExpanded((prev) => !prev)}
          onToggleWeight={() => setIsWeightExpanded((prev) => !prev)}
          onTrackerSubTabChange={setTrackerSubTab}
          t={t}
          trackerSubTab={trackerSubTab}
        />
        )}

        {currentTab === 'stats' && (
        <StatsTab notes={notes} pinnedNotes={pinnedNotes} t={t} />
        )}

        {currentTab === 'calendar' && (
        <CalendarTab calendarEvents={calendarEvents} onEventsChange={fetchCalendarEvents} t={t} />
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        itemContent={deleteTarget?.content}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={!!deleteTodo}
        itemContent={deleteTodo?.content}
        loading={deletingTodo}
        onConfirm={confirmDeleteTodo}
        onCancel={() => setDeleteTodo(null)}
      />
      <ConfirmModal
        open={!!deleteGoal}
        itemContent={deleteGoal?.title}
        loading={deletingGoal}
        onConfirm={confirmDeleteGoal}
        onCancel={() => setDeleteGoal(null)}
      />
      <ConfirmModal
        open={!!deleteGoalItem}
        itemContent={deleteGoalItem?.content}
        loading={deletingGoalItem}
        onConfirm={confirmDeleteGoalItem}
        onCancel={() => setDeleteGoalItem(null)}
      />
      <ConfirmModal
        open={!!deleteBuyPick}
        itemContent={deleteBuyPick?.category}
        loading={deletingBuyPick}
        onConfirm={() => void confirmDeleteBuyPick()}
        onCancel={() => setDeleteBuyPick(null)}
      />
    </main>
  )
}
