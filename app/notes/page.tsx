'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useCalorieGoal } from '@/lib/useCalorieGoal'
import { Note, Todo, Goal, GoalItem, BuyPick } from '@/types'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useLanguage } from '@/lib/i18n/language-context'
import { NotesPageHeader } from './_components/NotesPageHeader'
import { NotesTabsNav } from './_components/NotesTabsNav'
import { useNotesData } from './_hooks/useNotesData'
import { useNotesPreferences } from './_hooks/useNotesPreferences'
import { CaloTab } from './_components/tabs/CaloTab'
import { CalendarTab } from './_components/tabs/CalendarTab'
import { GoalsTab } from './_components/tabs/GoalsTab'
import { HealthTab } from './_components/tabs/HealthTab'
import { NotesTab } from './_components/tabs/NotesTab'
import { StatsTab } from './_components/tabs/StatsTab'
import { TrackerTab } from './_components/tabs/TrackerTab'
import { TodosTab } from './_components/tabs/TodosTab'
import type { GoalDraft, GoalItemDraft, NoteEditDraft, NotesDraft, TabType, TypeFilter, TypeTabCount } from './_components/tabs/types'

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
  return new Date().toISOString().slice(0, 10)
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const { goal: dailyCalorieGoal } = useCalorieGoal()

  const [todoDraft, setTodoDraft] = useState('')
  const [savingTodo, setSavingTodo] = useState(false)
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'done'>('all')
  const [deleteTodo, setDeleteTodo] = useState<Todo | null>(null)
  const [deletingTodo, setDeletingTodo] = useState(false)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editingTodoDraft, setEditingTodoDraft] = useState('')

  const [addingBuyPick, setAddingBuyPick] = useState(false)
  const [editingBuyPickId, setEditingBuyPickId] = useState<string | null>(null)
  const [buyPickForm, setBuyPickForm] = useState({ category: '', emoji: '🛒', brands: [] as string[], note: '', brandInput: '' })
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
    fetchBuyPicks,
    fetchCalendarEvents,
    fetchGoalItems,
    fetchGoals,
    fetchHealthPosts,
    fetchNotes,
    fetchTodayCalories,
    fetchTodos,
    goalItems,
    goals,
    healthPosts,
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

  // Count consecutive days from today (or yesterday) that have at least one note
  const notesStreak = useMemo(() => {
    const dates = new Set(notes.map((n) => n.note_date))
    let streak = 0
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const todayStr = cursor.toISOString().slice(0, 10)
    if (!dates.has(todayStr)) cursor.setDate(cursor.getDate() - 1)
    while (true) {
      const d = cursor.toISOString().slice(0, 10)
      if (!dates.has(d)) break
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    return streak
  }, [notes])

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


  async function addTodo() {
    const content = todoDraft.trim()
    if (!content) return

    setSavingTodo(true)
    try {
      const { error } = await supabase.from('todos').insert([{
        content,
        is_done: false,
        priority: 3,
      }])
      if (error) throw error
      setTodoDraft('')
      await fetchTodos()
      toast.success(t('notes.todos.addSuccess'))
    } catch {
      toast.error(t('notes.todos.addError'))
    } finally {
      setSavingTodo(false)
    }
  }

  async function toggleTodo(todo: Todo) {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ is_done: !todo.is_done })
        .eq('id', todo.id)

      if (error) throw error
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !todo.is_done } : t)))
    } catch {
      toast.error(t('notes.toasts.updateError'))
    }
  }

  async function saveEditingTodo(id: string) {
    const content = editingTodoDraft.trim()
    if (!content) return
    try {
      const { error } = await supabase.from('todos').update({ content }).eq('id', id)
      if (error) throw error
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, content } : t)))
      setEditingTodoId(null)
    } catch {
      toast.error(t('notes.toasts.updateError'))
    }
  }

  async function confirmDeleteTodo() {
    if (!deleteTodo) return
    setDeletingTodo(true)
    try {
      const { error } = await supabase.from('todos').delete().eq('id', deleteTodo.id)
      if (error) throw error
      setTodos((prev) => prev.filter((t) => t.id !== deleteTodo.id))
      setDeleteTodo(null)
      toast.success(t('notes.todos.deleted'))
    } catch {
      toast.error(t('notes.toasts.deleteError'))
    } finally {
      setDeletingTodo(false)
    }
  }

  function startEditBuyPick(pick: BuyPick) {
    setAddingBuyPick(false)
    setEditingBuyPickId(pick.id)
    setBuyPickForm({ category: pick.category, emoji: pick.emoji, brands: [...pick.brands], note: pick.note ?? '', brandInput: '' })
  }

  function cancelBuyPickForm() {
    setEditingBuyPickId(null)
    setAddingBuyPick(false)
    setBuyPickForm({ category: '', emoji: '🛒', brands: [], note: '', brandInput: '' })
  }

  function openAddBuyPick() {
    setEditingBuyPickId(null)
    setBuyPickForm({ category: '', emoji: '🛒', brands: [], note: '', brandInput: '' })
    setAddingBuyPick(true)
  }

  async function saveBuyPick() {
    const { category, emoji, brands, brandInput, note } = buyPickForm
    if (!category.trim()) return
    // Flush any uncommitted text in brandInput (supports comma-separated)
    const pending = brandInput.split(',').map(b => b.trim()).filter(b => b && !brands.includes(b))
    const finalBrands = [...brands, ...pending]
    setSavingBuyPick(true)
    try {
      if (editingBuyPickId) {
        const { error } = await supabase
          .from('buy_picks')
          .update({ category: category.trim(), emoji: emoji || '🛒', brands: finalBrands, note: note.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', editingBuyPickId)
        if (error) { toast.error(t('notes.buyPicks.updateError')); return }
        setBuyPicks(prev => prev.map(p => p.id === editingBuyPickId ? { ...p, category: category.trim(), emoji: emoji || '🛒', brands: finalBrands, note: note.trim() || undefined } : p))
        toast.success(t('notes.buyPicks.updateSuccess'))
        cancelBuyPickForm()
      } else {
        const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
        const { data, error } = await supabase
          .from('buy_picks')
          .insert([{ user_id: user?.id, category: category.trim(), emoji: emoji || '🛒', brands: finalBrands, note: note.trim() || null, order_index: buyPicks.length }])
          .select()
          .single()
        if (error || !data) { toast.error(t('notes.buyPicks.addError')); return }
        setBuyPicks(prev => [...prev, data as BuyPick])
        toast.success(t('notes.buyPicks.addSuccess'))
        cancelBuyPickForm()
      }
    } finally {
      setSavingBuyPick(false)
    }
  }

  async function confirmDeleteBuyPick() {
    if (!deleteBuyPick) return
    setDeletingBuyPick(true)
    const { error } = await supabase.from('buy_picks').delete().eq('id', deleteBuyPick.id)
    setDeletingBuyPick(false)
    if (error) { toast.error(t('notes.buyPicks.deleteError')); return }
    setBuyPicks(prev => prev.filter(p => p.id !== deleteBuyPick.id))
    toast.success(t('notes.buyPicks.deleteSuccess'))
    setDeleteBuyPick(null)
  }

  function openGoalDraft() {
    setGoalDraft({
      title: '',
      type: 'health',
      description: '',
      target_date: '',
      status: 'active',
      completion_percentage: 0,
    })
  }

  function cancelGoalDraft() {
    setGoalDraft(null)
  }

  async function addGoal() {
    if (!goalDraft || !goalDraft.title.trim()) return
    setSavingGoal(true)
    try {
      const { error } = await supabase.from('goals').insert([goalDraft])
      if (error) throw error
      setGoalDraft(null)
      await fetchGoals()
      toast.success(t('notes.goals.addSuccess'))
    } catch {
      toast.error(t('notes.goals.addError'))
    } finally {
      setSavingGoal(false)
    }
  }

  async function confirmDeleteGoal() {
    if (!deleteGoal) return
    setDeletingGoal(true)
    try {
      const { error } = await supabase.from('goals').delete().eq('id', deleteGoal.id)
      if (error) throw error
      setGoals((prev) => prev.filter((g) => g.id !== deleteGoal.id))
      setCollapsedGoalIds((prev) => prev.filter((id) => id !== deleteGoal.id))
      if (expandedGoal === deleteGoal.id) {
        setExpandedGoal(null)
      }
      setDeleteGoal(null)
      toast.success(t('notes.goals.deleteSuccess'))
    } catch {
      toast.error(t('notes.toasts.deleteError'))
    } finally {
      setDeletingGoal(false)
    }
  }

  async function updateGoalStatus(goal: Goal, newStatus: Goal['status']) {
    try {
      const { error } = await supabase.from('goals').update({ status: newStatus }).eq('id', goal.id)
      if (error) throw error
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status: newStatus } : g)))
      toast.success(t('notes.goals.statusUpdateSuccess'))
    } catch {
      toast.error(t('notes.goals.statusUpdateError'))
    }
  }

  async function addGoalItem(goal: Goal) {
    const draft = goalItemDraft[goal.id]
    if (!draft || !draft.content?.trim()) return

    setSavingGoalItem(true)
    try {
      const { error } = await supabase.from('goal_items').insert([{
        goal_id: goal.id,
        content: draft.content,
        item_type: draft.item_type,
        metadata: draft.metadata || {},
        is_completed: false,
      }])
      if (error) throw error
      const items = await fetchGoalItems(goal.id)
      setGoalItems((prev) => ({ ...prev, [goal.id]: items }))
      setGoalItemDraft((prev) => ({ ...prev, [goal.id]: { content: '', item_type: draft.item_type, metadata: {} } }))
      toast.success(t('notes.goals.itemAddSuccess'))
    } catch {
      toast.error(t('notes.goals.itemAddError'))
    } finally {
      setSavingGoalItem(false)
    }
  }

  async function confirmDeleteGoalItem() {
    if (!deleteGoalItem) return
    setDeletingGoalItem(true)
    try {
      const { error } = await supabase.from('goal_items').delete().eq('id', deleteGoalItem.id)
      if (error) throw error
      setGoalItems((prev) => ({
        ...prev,
        [deleteGoalItem.goal_id]: prev[deleteGoalItem.goal_id]?.filter((i) => i.id !== deleteGoalItem.id) || []
      }))
      setDeleteGoalItem(null)
      toast.success(t('notes.toasts.deleteSuccess'))
    } catch {
      toast.error(t('notes.toasts.deleteError'))
    } finally {
      setDeletingGoalItem(false)
    }
  }

  async function toggleGoalItem(item: GoalItem) {
    try {
      const { error } = await supabase.from('goal_items').update({ is_completed: !item.is_completed }).eq('id', item.id)
      if (error) throw error
    } catch {
      toast.error(t('notes.toasts.updateError'))
    }
  }

  async function reorderGoalItems(goalId: string, fromIndex: number, toIndex: number) {
    const items = goalItems[goalId]
    if (!items || fromIndex === toIndex) return

    const newItems = [...items]
    const [movedItem] = newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, movedItem)

    // Update local state immediately
    setGoalItems((prev) => ({ ...prev, [goalId]: newItems }))

    // Update order in database
    try {
      const updates = newItems.map((item, idx) => ({
        id: item.id,
        order: idx + 1
      }))

      for (const update of updates) {
        const { error } = await supabase
          .from('goal_items')
          .update({ order: update.order })
          .eq('id', update.id)
        if (error) throw error
      }
    } catch {
      toast.error(t('notes.goals.reorderError'))
      // Revert to previous state on error
      const items = await fetchGoalItems(goalId)
      setGoalItems((prev) => ({ ...prev, [goalId]: items }))
    }
  }

  function startEditingGoalItem(item: GoalItem) {
    setEditingGoalItemId(item.id)
    setEditingGoalItemDraft({
      content: item.content,
      item_type: item.item_type,
      metadata: item.metadata || {}
    })
  }

  function cancelEditingGoalItem() {
    setEditingGoalItemId(null)
    setEditingGoalItemDraft(null)
  }

  async function saveEditingGoalItem(item: GoalItem) {
    if (!editingGoalItemDraft || !editingGoalItemDraft.content.trim()) {
      toast.error(t('notes.toasts.contentEmptyError'))
      return
    }

    // Validate metadata JSON
    try {
      if (editingGoalItemDraft.metadata && typeof editingGoalItemDraft.metadata === 'object') {
        JSON.stringify(editingGoalItemDraft.metadata)
      }
    } catch {
      toast.error(t('notes.goals.itemMetadataInvalid'))
      return
    }

    setSavingGoalItem(true)
    try {
      const { error } = await supabase.from('goal_items').update({
        content: editingGoalItemDraft.content,
        item_type: editingGoalItemDraft.item_type,
        result: editingGoalItemDraft.result || null,
        metadata: editingGoalItemDraft.metadata || {},
        is_completed: editingGoalItemDraft.is_completed || false
      }).eq('id', item.id)
      if (error) throw error

      // Update local state only (no full reload)
      setGoalItems((prev) => ({
        ...prev,
        [item.goal_id]: prev[item.goal_id]?.map((i) =>
          i.id === item.id
            ? { ...i, content: editingGoalItemDraft.content, item_type: editingGoalItemDraft.item_type, result: editingGoalItemDraft.result, metadata: editingGoalItemDraft.metadata, is_completed: editingGoalItemDraft.is_completed }
            : i
        ) || []
      }))

      setEditingGoalItemId(null)
      setEditingGoalItemDraft(null)
      toast.success(t('notes.toasts.updateSuccess'))
    } catch {
      toast.error(t('notes.toasts.updateError'))
    } finally {
      setSavingGoalItem(false)
    }
  }

  function startEditingGoal(goal: Goal) {
    setCollapsedGoalIds((prev) => prev.filter((id) => id !== goal.id))
    setEditingGoalId(goal.id)
    setEditingGoalDraft({
      title: goal.title,
      type: goal.type,
      description: goal.description || '',
      start_date: goal.start_date || '',
      target_date: goal.target_date || '',
      status: goal.status,
      completion_percentage: goal.completion_percentage || 0
    })
  }

  function cancelEditingGoal() {
    setEditingGoalId(null)
    setEditingGoalDraft(null)
  }

  async function saveEditingGoal(goal: Goal) {
    if (!editingGoalDraft || !editingGoalDraft.title.trim()) {
      toast.error(t('notes.goals.nameEmptyError'))
      return
    }

    setSavingGoal(true)
    try {
      const { error } = await supabase.from('goals').update({
        title: editingGoalDraft.title,
        type: editingGoalDraft.type,
        description: editingGoalDraft.description,
        start_date: editingGoalDraft.start_date,
        target_date: editingGoalDraft.target_date,
        completion_percentage: editingGoalDraft.completion_percentage
      }).eq('id', goal.id)
      if (error) throw error

      // Update local state only (no full reload)
      setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, ...editingGoalDraft } : g))

      setEditingGoalId(null)
      setEditingGoalDraft(null)
      toast.success(t('notes.goals.updateSuccess'))
    } catch {
      toast.error(t('notes.goals.updateError'))
    } finally {
      setSavingGoal(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      // Ensure Supabase session is loaded from cookies before any query.
      // Without this, queries may fire with anon role and bypass RLS isolation.
      await getSupabaseBrowserClient().auth.getSession()
      void fetchNotes(false)
      void fetchTodos()
      void fetchGoals()
      void fetchBuyPicks()
      void fetchHealthPosts()
      void fetchCalendarEvents()
      void fetchTodayCalories()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchBuyPicks, fetchCalendarEvents, fetchGoals, fetchHealthPosts, fetchNotes, fetchTodayCalories, fetchTodos])

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

  const counts = useMemo(
    () => ({
      all: notes.length,
      good: notes.filter((n) => n.type === 'good').length,
      bad: notes.filter((n) => n.type === 'bad').length,
      todos: todos.length,
      pendingTodos: todos.filter((t) => !t.is_done).length,
    }),
    [notes, todos]
  )

  const [searchQuery, setSearchQuery] = useState('')

  // Strip Vietnamese diacritics so "an" matches "ăn", "ân", etc.
  function normalize(s: string) {
    return s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase()
  }

  const filteredNotes = notes.filter((note) => {
    if (typeFilter !== 'all' && note.type !== typeFilter) return false
    if (searchQuery.trim()) {
      const q = normalize(searchQuery)
      const matchContent = normalize(note.content).includes(q)
      const matchTag = (note.tags ?? []).some((t) => normalize(t).includes(q))
      if (!matchContent && !matchTag) return false
    }
    return true
  })

  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => {
      const pa = a.hide_meta ? 0 : (a.priority ?? 0)
      const pb = b.hide_meta ? 0 : (b.priority ?? 0)
      if (pb !== pa) return pb - pa
      return b.created_at.localeCompare(a.created_at)
    })
  }, [filteredNotes])

  const noteGroups = useMemo(() => {
    const result: { date: string; items: Note[] }[] = []
    sortedNotes.forEach((note) => {
      const last = result[result.length - 1]
      if (last && last.date === note.note_date) {
        last.items.push(note)
      } else {
        result.push({ date: note.note_date, items: [note] })
      }
    })
    return result
  }, [sortedNotes])

  const allTags = useMemo(
    () => [...new Set(notes.flatMap((n) => n.tags ?? []))].sort(),
    [notes]
  )

  const typeTabs: TypeTabCount[] = [
    { key: 'all', label: t('notes.typeFilters.all'), count: counts.all },
    { key: 'good', label: t('notes.typeFilters.good'), count: counts.good },
    { key: 'bad', label: t('notes.typeFilters.bad'), count: counts.bad },
  ]

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
          addingBuyPick={addingBuyPick}
          addTodo={addTodo}
          buyPickForm={buyPickForm}
          buyPicks={buyPicks}
          cancelBuyPickForm={cancelBuyPickForm}
          editingBuyPickId={editingBuyPickId}
          editingTodoDraft={editingTodoDraft}
          editingTodoId={editingTodoId}
          openAddBuyPick={openAddBuyPick}
          saveBuyPick={saveBuyPick}
          saveEditingTodo={saveEditingTodo}
          savingBuyPick={savingBuyPick}
          savingTodo={savingTodo}
          setBuyPickForm={setBuyPickForm}
          setDeleteBuyPick={setDeleteBuyPick}
          setDeleteTodo={setDeleteTodo}
          setEditingTodoDraft={setEditingTodoDraft}
          setEditingTodoId={setEditingTodoId}
          setTodoDraft={setTodoDraft}
          setTodoFilter={setTodoFilter}
          startEditBuyPick={startEditBuyPick}
          t={t}
          todoDraft={todoDraft}
          todoFilter={todoFilter}
          todos={todos}
          toggleTodo={toggleTodo}
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
