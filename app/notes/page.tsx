'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  Bell,
  Check,
  CheckCircle2,
  Circle,
  ListTodo,
  NotebookPen,
  Pencil,
  Pin,
  Plus,
  ShoppingBag,
  Sparkles,
  Star,
  ThumbsDown,
  Trash2,
  X,
  Target,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

import { toast } from 'sonner'

import { getTagColor } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useCalorieGoal } from '@/lib/useCalorieGoal'
import { Note, Todo, Goal, GoalItem, Post, BuyPick } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { TagInput } from '@/components/ui/tag-input'
import { CalorieTracker } from '@/components/CalorieTracker'
import { CalorieAnalytics } from '@/components/CalorieAnalytics'
import { NotesAnalytics } from '@/components/NotesAnalytics'
import { NotesAIInsights } from '@/components/NotesAIInsights'
import { MealScheduleTracker } from '@/components/MealScheduleTracker'
import { WeightTracker } from '@/components/WeightTracker'
import { BowelTracker } from '@/components/BowelTracker'
import { DatePicker } from '@/components/ui/date-picker'
import { useLanguage } from '@/lib/i18n/language-context'
import { getIntlLocale } from '@/lib/i18n/locale'
import type { Lang } from '@/lib/i18n/language-context'

type TypeFilter = 'all' | 'good' | 'bad'
type TabType = 'notes' | 'todos' | 'goals' | 'calo' | 'meals' | 'health' | 'stats' | 'weight'

const VALID_TABS: TabType[] = ['notes', 'todos', 'goals', 'calo', 'meals', 'health', 'stats', 'weight']
const TAB_CHANGE_EVENT = 'tab-hash-change'

function subscribeToTabHash(callback: () => void) {
  window.addEventListener(TAB_CHANGE_EVENT, callback)
  window.addEventListener('hashchange', callback)
  return () => {
    window.removeEventListener(TAB_CHANGE_EVENT, callback)
    window.removeEventListener('hashchange', callback)
  }
}

function getTabFromHash(): TabType {
  const hash = window.location.hash.slice(1) as TabType
  return VALID_TABS.includes(hash) ? hash : 'notes'
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatNoteDate(isoDate: string, lang: Lang): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(getIntlLocale(lang), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

type Draft = {
  note_date: string
  content: string
  type: 'good' | 'bad'
  priority: number
  completion_percentage: number
  tags: string[]
  hide_meta: boolean
}

type EditDraft = Omit<Draft, 'note_date'> & { hide_meta: boolean }

const NOTIFY_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

const WORK_HOURLY_NOTIFY_OPTION = '__work-hourly__'

const WORK_HOURLY_NOTIFY_TIMES = Array.from({ length: 10 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`).filter(
  (time) => time !== '12:00' && time !== '17:00'
)

function hasWorkHourlySchedule(times: string[]) {
  return WORK_HOURLY_NOTIFY_TIMES.every((t) => times.includes(t))
}

function stripWorkHourlyTimes(times: string[]) {
  return times.filter((t) => !WORK_HOURLY_NOTIFY_TIMES.includes(t))
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

function getGoalItemTypeLabel(itemType: string, t: Translate) {
  const key = `notes.goals.itemTypeOptions.${itemType}`
  const label = t(key)
  return label === key ? itemType : label
}

function getGoalTypeLabel(type: string, t: Translate) {
  const key = `notes.goals.typeOptions.${type}`
  const label = t(key)
  return label === key ? type : label
}

const textareaClass =
  'w-full resize-y rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400'

const autoTextareaClass =
  'w-full min-h-24 resize-none overflow-y-hidden rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400'

type GoalDraft = Omit<Goal, 'id' | 'created_at'>
type GoalItemDraft = Omit<GoalItem, 'id' | 'goal_id' | 'created_at' | 'updated_at'>

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

  const [notes, setNotes] = useState<Note[]>([])
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([])
  const [pinnedDraft, setPinnedDraft] = useState('')
  const [savingPinned, setSavingPinned] = useState(false)
  const [deletingPinnedId, setDeletingPinnedId] = useState<string | null>(null)
  const [notifyEditId, setNotifyEditId] = useState<string | null>(null)
  const [notifyDraftTime, setNotifyDraftTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [todayCalories, setTodayCalories] = useState(0)
  const { goal: dailyCalorieGoal } = useCalorieGoal()

  const [todos, setTodos] = useState<Todo[]>([])
  const [todoDraft, setTodoDraft] = useState('')
  const [savingTodo, setSavingTodo] = useState(false)
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'done'>('all')
  const [deleteTodo, setDeleteTodo] = useState<Todo | null>(null)
  const [deletingTodo, setDeletingTodo] = useState(false)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editingTodoDraft, setEditingTodoDraft] = useState('')

  const [buyPicks, setBuyPicks] = useState<BuyPick[]>([])
  const [addingBuyPick, setAddingBuyPick] = useState(false)
  const [editingBuyPickId, setEditingBuyPickId] = useState<string | null>(null)
  const [buyPickForm, setBuyPickForm] = useState({ category: '', emoji: '🛒', brands: [] as string[], note: '', brandInput: '' })
  const [deleteBuyPick, setDeleteBuyPick] = useState<BuyPick | null>(null)
  const [deletingBuyPick, setDeletingBuyPick] = useState(false)
  const [savingBuyPick, setSavingBuyPick] = useState(false)

  const [healthPosts, setHealthPosts] = useState<Post[]>([])

  const [goals, setGoals] = useState<Goal[]>([])
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null)
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalFilter, setGoalFilter] = useState<'active' | 'completed' | 'all'>('active')
  const [deleteGoal, setDeleteGoal] = useState<Goal | null>(null)
  const [deletingGoal, setDeletingGoal] = useState(false)
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [goalItems, setGoalItems] = useState<{ [goalId: string]: GoalItem[] }>({})
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

  // Count consecutive days from today (or yesterday) that have at least one note
  const notesStreak = useMemo(() => {
    const dates = new Set(notes.map((n) => n.note_date))
    let streak = 0
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    // If no note today, start check from yesterday
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

  const [editingHabitId, setEditingHabitId] = useState<string | null>(null)
  const [editingHabitDraft, setEditingHabitDraft] = useState('')
  const [savingHabit, setSavingHabit] = useState(false)
  const habitInputRef = useRef<HTMLInputElement | null>(null)

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

  async function fetchNotes(withLoading = true) {
    if (withLoading) {
      setLoading(true)
    }
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('note_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      const all = (data || []) as Note[]
      setPinnedNotes(all.filter((n) => n.pinned))
      setNotes(all.filter((n) => !n.pinned))
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchTodos() {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTodos((data || []) as Todo[])
    } catch (error) {
      console.error('Error fetching todos:', error)
    }
  }

  async function fetchBuyPicks() {
    const { data } = await supabase
      .from('buy_picks')
      .select('*')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })
    if (data) setBuyPicks(data as BuyPick[])
  }

  async function fetchGoals() {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setGoals((data || []) as Goal[])
    } catch (error) {
      console.error('Error fetching goals:', error)
    }
  }

  async function fetchHealthPosts() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_tags(tags(id, name))')
        .order('created_at', { ascending: false })

      if (error) throw error
      const rows = (data || []) as (Post & { post_tags: { tags: { id: string; name: string } | null }[] })[]
      const posts = rows.map(({ post_tags, ...post }) => ({
        ...post,
        tags: post_tags
          .map((pt) => pt.tags)
          .filter((tag): tag is { id: string; name: string } => tag !== null)
          .map(tag => ({ id: tag.id, name: tag.name })),
      }))
      const filtered = posts.filter((p) => p.tags?.some((tag) => tag.name === 'Sức Khỏe')) // fixed DB tag name — not translated
      setHealthPosts(filtered)
    } catch (error) {
      console.error('Error fetching health posts:', error)
    }
  }

  async function fetchTodayCalories() {
    try {
      const today = todayDate()
      const { data, error } = await supabase
        .from('daily_foods')
        .select('total_calories')
        .eq('date', today)

      if (error) throw error
      const total = (data || []).reduce((sum: number, food: any) => sum + (food.total_calories || 0), 0)
      setTodayCalories(total)
    } catch (error) {
      console.error('Error fetching today calories:', error)
    }
  }

  async function fetchGoalItems(goalId: string): Promise<GoalItem[]> {
    try {
      const { data, error } = await supabase
        .from('goal_items')
        .select('*')
        .eq('goal_id', goalId)
        .order('order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as GoalItem[]
    } catch (error) {
      console.error('Error fetching goal items:', error)
      return []
    }
  }

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
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !t.is_done } : t)))
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
      void fetchTodayCalories()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (expandedGoal && !goalItems[expandedGoal]) {
      void (async () => {
        const items = await fetchGoalItems(expandedGoal)
        setGoalItems((prev) => ({ ...prev, [expandedGoal]: items }))
      })()
    }
  }, [expandedGoal])

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

  const typeTabs: { key: TypeFilter; label: string; count: number }[] = [
    { key: 'all', label: t('notes.typeFilters.all'), count: counts.all },
    { key: 'good', label: t('notes.typeFilters.good'), count: counts.good },
    { key: 'bad', label: t('notes.typeFilters.bad'), count: counts.bad },
  ]

  return (
    <main className="notes-page min-h-svh bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_35%),radial-gradient(circle_at_80%_18%,rgba(52,211,153,0.16),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f6fef9_100%)] px-4 pb-10 pt-24 text-zinc-900 sm:px-6 sm:pt-28">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#ffffff_0%,#f7fef9_45%,#ecfdf5_100%)] p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.45)]">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_16px_28px_-16px_rgba(16,185,129,0.9)]">
              <NotebookPen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">{t('notes.header.eyebrow')}</p>
              <h2 className="mt-1 font-poppins text-2xl font-semibold leading-tight text-zinc-900">{t('notes.header.title')}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t('notes.header.subtitle')}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <article className="rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_1px_0_0_rgba(16,185,129,0.15)]">
              <p className="text-xs font-medium text-zinc-600">{t('notes.header.totalStat')}</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-zinc-900">{counts.all}</p>
            </article>
            <article className="rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_1px_0_0_rgba(16,185,129,0.15)]">
              <p className="text-xs font-medium text-zinc-600">{t('notes.header.goodStat')}</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-emerald-600">{counts.good}</p>
            </article>
            <article className="rounded-xl border border-amber-100 bg-white p-3 shadow-[0_1px_0_0_rgba(217,119,6,0.15)]">
              <p className="text-xs font-medium text-zinc-600">{t('notes.header.badStat')}</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-amber-600">{counts.bad}</p>
            </article>
            <article className="rounded-xl border border-blue-100 bg-white p-3 shadow-[0_1px_0_0_rgba(59,130,246,0.15)]">
              <p className="text-xs font-medium text-zinc-600">{t('notes.header.todoStat')}</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-blue-600">{counts.pendingTodos}</p>
            </article>
            <article className="rounded-xl border border-orange-100 bg-white p-3 shadow-[0_1px_0_0_rgba(234,88,12,0.15)]">
              <p className="text-xs font-medium text-zinc-600">{t('notes.header.calorieStat')}</p>
              <p className="mt-2 text-2xl font-semibold leading-none text-orange-600">{Math.round(todayCalories)}</p>
              <p className="text-xs text-zinc-500">{t('notes.header.calorieGoalSuffix', { goal: dailyCalorieGoal })}</p>
            </article>
          </div>
        </section>

        <div className="flex overflow-x-auto border-b border-emerald-200">
          <button
            onClick={() => handleTabChange('notes')}
            className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
              currentTab === 'notes'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <NotebookPen className="h-4 w-4" />
            <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.notes')}</span>
          </button>
          <button
            onClick={() => handleTabChange('todos')}
            className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
              currentTab === 'todos'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <ListTodo className="h-4 w-4" />
            <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.todos')}</span>
          </button>
          <button
            onClick={() => handleTabChange('goals')}
            className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
              currentTab === 'goals'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Target className="h-4 w-4" />
            <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.goals')}</span>
          </button>
          <button
            onClick={() => handleTabChange('calo')}
            className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
              currentTab === 'calo'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="text-base leading-none">🔥</span>
            <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.calo')}</span>
          </button>
          <button
            onClick={() => handleTabChange('meals')}
            className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
              currentTab === 'meals'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="text-base leading-none">🍽️</span>
            <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.meals')}</span>
          </button>
          <button
            onClick={() => handleTabChange('weight')}
            className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
              currentTab === 'weight'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="text-base leading-none">📊</span>
            <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.weight')}</span>
          </button>
          <button
            onClick={() => handleTabChange('health')}
            className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
              currentTab === 'health'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="text-base leading-none">💪</span>
            <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.health')}</span>
          </button>
          <button
            onClick={() => handleTabChange('stats')}
            className={`shrink-0 flex w-20 flex-col items-center justify-center gap-1.5 py-4 text-sm font-medium transition-colors sm:w-auto sm:flex-1 sm:gap-1 sm:px-3 sm:py-3 ${
              currentTab === 'stats'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="text-base leading-none">📊</span>
            <span className="whitespace-nowrap text-center leading-tight">{t('notes.tabs.stats')}</span>
          </button>
        </div>

        {currentTab === 'notes' && (
        <>
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
                        onClick={() => removeWorkHourlyNotify(habit)}
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
                        onClick={() => removeNotifyTime(habit, time)}
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
                        <option
                          value={WORK_HOURLY_NOTIFY_OPTION}
                          disabled={hasWorkHourlySchedule(habit.notify_times || [])}
                        >
                          {t('notes.habits.hourlyChipExceptNoon')}
                        </option>
                        {NOTIFY_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time} disabled={(habit.notify_times || []).includes(time)}>
                            {time}{(habit.notify_times || []).includes(time) ? ` ${t('notes.habits.alreadyAddedSuffix')}` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => addNotifyTime(habit)}
                        disabled={
                          !notifyDraftTime ||
                          (notifyDraftTime !== WORK_HOURLY_NOTIFY_OPTION && (habit.notify_times || []).includes(notifyDraftTime))
                        }
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
                      onClick={() => { setNotifyEditId(habit.id); setNotifyDraftTime('') }}
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
                    onClick={() => deleteHabit(habit.id)}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-300 opacity-20 transition-opacity group-hover:opacity-100 hover:text-rose-400 disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <form
              onSubmit={(e) => { e.preventDefault(); addHabit() }}
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
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
          <div className="border-b border-emerald-100 px-4 py-3.5">
            {draft ? (
              <div className="flex flex-col gap-2 rounded-xl border-l-4 border-dashed border-emerald-300 bg-emerald-50/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <DatePicker value={draft.note_date} onChange={(v) => updateDraft({ note_date: v })} />
                  <div className="inline-flex overflow-hidden rounded-lg border border-emerald-200">
                    <button
                      type="button"
                      onClick={() => updateDraft({ type: 'good' })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                        draft.type === 'good' ? 'bg-emerald-500 text-white' : 'bg-white text-zinc-600 hover:bg-emerald-50'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {t('notes.composer.good')}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDraft({ type: 'bad' })}
                      className={`inline-flex items-center gap-1.5 border-l border-emerald-200 px-3 py-1.5 text-sm font-medium transition-colors ${
                        draft.type === 'bad' ? 'bg-amber-500 text-white' : 'bg-white text-zinc-600 hover:bg-amber-50'
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      {t('notes.composer.bad')}
                    </button>
                  </div>
                  <div className="inline-flex items-center gap-0.5">
                    {([1, 2, 3, 4, 5] as const).map((star) => (
                      <button key={star} type="button" onClick={() => updateDraft({ priority: star })}>
                        <Star
                          className={`h-3.5 w-3.5 ${
                            star <= draft.priority ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={draft.completion_percentage}
                      onChange={(e) => updateDraft({ completion_percentage: Number(e.target.value) })}
                      className="w-32 sm:w-48"
                    />
                    <span className="w-8 text-right text-xs font-medium text-zinc-600">{draft.completion_percentage}%</span>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 select-none">
                      <input
                        type="checkbox"
                        checked={draft.hide_meta}
                        onChange={(e) => updateDraft({ hide_meta: e.target.checked })}
                        className="h-3.5 w-3.5 accent-emerald-500"
                      />
                      <span className="hidden sm:inline">{t('notes.composer.hideProgress')}</span>
                    </label>
                  </div>
                </div>
                <textarea
                  autoFocus
                  rows={3}
                  value={draft.content}
                  onChange={(e) => updateDraft({ content: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') cancelDraft()
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      saveDraft()
                    }
                  }}
                  placeholder={t('notes.composer.placeholder')}
                  className={textareaClass}
                />
                <TagInput
                  value={draft.tags}
                  onChange={(tags) => updateDraft({ tags })}
                  suggestions={allTags}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelDraft} className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingDraft || !draft.content.trim()}
                    onClick={saveDraft}
                    className="bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500"
                  >
                    <Check />
                    {t('notes.composer.saveNote')}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={openDraft}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-300 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                <Plus className="h-4 w-4" />
                {t('notes.composer.addNew')}
              </button>
            )}
          </div>

          <div className="border-b border-emerald-100 px-4 py-2.5">
            <input
              type="search"
              placeholder={t('notes.list.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100 px-4 py-3.5">
            {typeTabs.map((tab) => {
              const isSelected = typeFilter === tab.key
              let bgColor = 'border-emerald-100 text-zinc-600 hover:bg-emerald-50 hover:text-zinc-900'
              let badgeBg = 'bg-zinc-100 text-zinc-600'

              if (isSelected) {
                if (tab.key === 'good') {
                  bgColor = 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  badgeBg = 'bg-emerald-100 text-emerald-700'
                } else if (tab.key === 'bad') {
                  bgColor = 'border-amber-300 bg-amber-50 text-amber-700'
                  badgeBg = 'bg-amber-100 text-amber-700'
                } else {
                  bgColor = 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  badgeBg = 'bg-emerald-100 text-emerald-700'
                }
              } else {
                if (tab.key === 'good') {
                  bgColor = 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'
                } else if (tab.key === 'bad') {
                  bgColor = 'border-amber-100 text-amber-600 hover:bg-amber-50'
                }
              }

              return (
                <button
                  key={tab.key}
                  onClick={() => setTypeFilter(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${bgColor}`}
                >
                  {tab.label}
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${badgeBg}`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-zinc-500">{t('common.loading')}</div>
          ) : noteGroups.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              {searchQuery.trim() ? t('notes.list.noResults', { q: searchQuery }) : t('notes.list.empty')}
            </div>
          ) : (
            <div className="divide-y divide-emerald-50">
              {noteGroups.map((group, gi) => (
                <div key={`${group.date}-${gi}`} className="px-4 py-3.5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {formatNoteDate(group.date, lang)}
                  </p>
                  <div className="space-y-2">
                    {group.items.map((note) => (
                      <div
                        key={note.id}
                        className={`flex items-start gap-3 rounded-xl border-l-4 px-3 py-2.5 ${
                          note.type === 'good' ? 'border-emerald-400' : 'border-amber-400'
                        } ${
                          note.priority === 5
                            ? 'bg-amber-50 shadow-[0_2px_10px_-3px_rgba(217,119,6,0.3)] ring-1 ring-amber-200'
                            : 'bg-white shadow-[0_1px_0_0_rgba(16,185,129,0.1)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1" onDoubleClick={() => editingId !== note.id && startEdit(note)}>
                          {editingId === note.id && editingDraft ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex overflow-hidden rounded-lg border border-emerald-200">
                                  <button
                                    type="button"
                                    onClick={() => updateEditingDraft({ type: 'good' })}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                                      editingDraft.type === 'good' ? 'bg-emerald-500 text-white' : 'bg-white text-zinc-600 hover:bg-emerald-50'
                                    }`}
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {t('notes.composer.good')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateEditingDraft({ type: 'bad' })}
                                    className={`inline-flex items-center gap-1.5 border-l border-emerald-200 px-3 py-1.5 text-sm font-medium transition-colors ${
                                      editingDraft.type === 'bad' ? 'bg-amber-500 text-white' : 'bg-white text-zinc-600 hover:bg-amber-50'
                                    }`}
                                  >
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                    {t('notes.composer.bad')}
                                  </button>
                                </div>
                                <div className="inline-flex items-center gap-0.5">
                                  {([1, 2, 3, 4, 5] as const).map((star) => (
                                    <button key={star} type="button" onClick={() => updateEditingDraft({ priority: star })}>
                                      <Star
                                        className={`h-3.5 w-3.5 ${
                                          star <= editingDraft.priority ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'
                                        }`}
                                      />
                                    </button>
                                  ))}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="10"
                                    value={editingDraft.completion_percentage}
                                    onChange={(e) => updateEditingDraft({ completion_percentage: Number(e.target.value) })}
                                    className="w-32 sm:w-48"
                                  />
                                  <span className="w-8 text-right text-xs font-medium text-zinc-600">
                                    {editingDraft.completion_percentage}%
                                  </span>
                                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 select-none">
                                    <input
                                      type="checkbox"
                                      checked={editingDraft.hide_meta}
                                      onChange={(e) => updateEditingDraft({ hide_meta: e.target.checked })}
                                      className="h-3.5 w-3.5 accent-emerald-500"
                                    />
                                    <span className="hidden sm:inline">{t('notes.composer.hideProgress')}</span>
                                  </label>
                                </div>
                              </div>
                              <textarea
                                ref={editTextareaRef}
                                autoFocus
                                value={editingDraft.content}
                                onChange={(e) => updateEditingDraft({ content: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') cancelEdit()
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault()
                                    saveEdit(note)
                                  }
                                }}
                                className={autoTextareaClass}
                              />
                              <TagInput
                                value={editingDraft.tags}
                                onChange={(tags) => updateEditingDraft({ tags })}
                                suggestions={allTags}
                              />
                            </div>
                          ) : (
                            <>
                              <p className="whitespace-pre-wrap text-sm text-zinc-800">{note.content}</p>
                              {!note.hide_meta && <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-0.5">
                                  {([1, 2, 3, 4, 5] as const).map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() => updatePriority(note, star)}
                                      className="rounded hover:scale-110 transition-transform"
                                    >
                                      <Star
                                        className={`h-3.5 w-3.5 transition-colors ${
                                          star <= (note.priority ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 hover:text-amber-300'
                                        }`}
                                      />
                                    </button>
                                  ))}
                                </span>
                                {percentEditId === note.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      autoFocus
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={percentEditValue}
                                      onChange={(e) => setPercentEditValue(e.target.value)}
                                      onBlur={() => savePercentage(note)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') savePercentage(note)
                                        if (e.key === 'Escape') setPercentEditId(null)
                                      }}
                                      className="w-14 rounded-md border border-emerald-300 bg-white px-1.5 py-0.5 text-xs text-zinc-900 outline-none focus:border-emerald-500"
                                    />
                                    <span className="text-xs text-zinc-500">%</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => { setPercentEditId(note.id); setPercentEditValue(String(note.completion_percentage ?? 0)) }}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-emerald-300 hover:bg-emerald-50 ${
                                      note.completion_percentage
                                        ? 'border-zinc-200 bg-zinc-50 text-zinc-700'
                                        : 'border-dashed border-zinc-200 text-zinc-400'
                                    }`}
                                  >
                                    {note.completion_percentage ? `${note.completion_percentage}%` : '—'}
                                  </button>
                                )}
                              </div>}
                              {note.tags && note.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {(Array.isArray(note.tags) ? note.tags : []).map((tag: string, idx: number) => (
                                    <span key={idx} className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-700">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {editingId === note.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busyId === note.id || !editingDraft?.content.trim()}
                                onClick={() => saveEdit(note)}
                                className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
                              >
                                <Check />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={cancelEdit} className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
                                <X />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busyId === note.id}
                                onClick={() => startEdit(note)}
                                className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busyId === note.id}
                                onClick={() => setDeleteTarget(note)}
                                className="text-rose-300 hover:bg-rose-500/15"
                              >
                                <Trash2 />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </>
        )}

        {currentTab === 'todos' && (
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
          <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <ListTodo className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('notes.todos.heading')}</span>
            </div>
            <span className="text-xs font-medium text-emerald-600">{t('notes.todos.count', { n: todos.length })}</span>
          </div>

          <div className="px-4 py-3">
            <div className="mb-4 flex gap-2">
              {(['all', 'pending', 'done'] as const).map((filter) => {
                const isSelected = todoFilter === filter
                const pendingCount = todos.filter((t) => !t.is_done).length
                const doneCount = todos.filter((t) => t.is_done).length

                let label = ''
                let count = 0
                let bgColor = 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'

                if (filter === 'all') {
                  label = t('notes.todos.filterAll')
                  count = todos.length
                  bgColor = isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                } else if (filter === 'pending') {
                  label = t('notes.todos.filterPending')
                  count = pendingCount
                  bgColor = isSelected ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                } else if (filter === 'done') {
                  label = t('notes.todos.filterDone')
                  count = doneCount
                  bgColor = isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }

                return (
                  <button
                    key={filter}
                    onClick={() => setTodoFilter(filter)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${bgColor} ${
                      isSelected
                        ? filter === 'all'
                          ? 'border-emerald-300'
                          : filter === 'pending'
                          ? 'border-blue-300'
                          : 'border-emerald-300'
                        : filter === 'all'
                        ? 'border-zinc-200'
                        : filter === 'pending'
                        ? 'border-blue-100'
                        : 'border-emerald-100'
                    }`}
                  >
                    {label}
                    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                      isSelected
                        ? filter === 'all'
                          ? 'bg-emerald-200 text-emerald-900'
                          : filter === 'pending'
                          ? 'bg-blue-200 text-blue-900'
                          : 'bg-emerald-200 text-emerald-900'
                        : filter === 'all'
                        ? 'bg-zinc-200 text-zinc-700'
                        : filter === 'pending'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="space-y-2 mb-4">
              {todos
                .filter((t) => {
                  if (todoFilter === 'pending') return !t.is_done
                  if (todoFilter === 'done') return t.is_done
                  return true
                })
                .map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-white p-3 hover:bg-emerald-50 transition-colors"
                  >
                    <button
                      onClick={() => toggleTodo(todo)}
                      className="shrink-0 text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      {todo.is_done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                    {editingTodoId === todo.id ? (
                      <input
                        autoFocus
                        value={editingTodoDraft}
                        onChange={(e) => setEditingTodoDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveEditingTodo(todo.id)
                          if (e.key === 'Escape') setEditingTodoId(null)
                        }}
                        className="flex-1 rounded border border-emerald-300 px-2 py-0.5 text-sm text-zinc-900 outline-none focus:border-emerald-500"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => { setEditingTodoId(todo.id); setEditingTodoDraft(todo.content) }}
                        className={`flex-1 cursor-text text-sm ${
                          todo.is_done ? 'line-through text-zinc-400' : 'text-zinc-900'
                        }`}
                      >
                        {todo.content}
                      </span>
                    )}
                    {editingTodoId === todo.id ? (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => void saveEditingTodo(todo.id)} className="text-emerald-600 hover:bg-emerald-500/15">
                          <Check />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditingTodoId(null)} className="text-zinc-400 hover:bg-zinc-100">
                          <X />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { setEditingTodoId(todo.id); setEditingTodoDraft(todo.content) }}
                          className="text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTodo(todo)}
                          className="text-rose-300 hover:bg-rose-500/15"
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                ))}

              {todos.filter((t) => {
                if (todoFilter === 'pending') return !t.is_done
                if (todoFilter === 'done') return t.is_done
                return true
              }).length === 0 && (
                <div className="text-center py-8 text-zinc-500">
                  {todoFilter === 'all' && t('notes.todos.emptyAll')}
                  {todoFilter === 'pending' && t('notes.todos.emptyPending')}
                  {todoFilter === 'done' && t('notes.todos.emptyDone')}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-emerald-100 pt-4">
              <Input
                type="text"
                placeholder={t('notes.todos.addPlaceholder')}
                value={todoDraft}
                onChange={(e) => setTodoDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void addTodo()
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={() => void addTodo()}
                disabled={savingTodo || !todoDraft.trim()}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="h-4 w-4" />
                {t('common.add')}
              </Button>
            </div>
          </div>
        </section>
        )}

        {currentTab === 'todos' && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-slate-50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">{t('notes.buyPicks.heading')}</span>
            </div>
            <button
              onClick={openAddBuyPick}
              className="flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              <Plus className="h-3 w-3" />
              {t('notes.buyPicks.addCategory')}
            </button>
          </div>

          <div className="px-4 py-3">
            {/* Inline form — shared for both add and edit */}
            {(addingBuyPick || editingBuyPickId) && (
              <div className="mb-3 space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
                {/* Emoji preset grid */}
                <div className="flex flex-wrap gap-1">
                  {['🔋','🔌','🔊','🎧','📱','💻','⌨️','🖥️','📷','🎮','👕','👖','👟','🩲','👜','🧴','💊','📚','🍎','🏠','🚗','✈️','🎨','🖊️','🧸'].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setBuyPickForm((prev) => ({ ...prev, emoji: e }))}
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-amber-100 ${buyPickForm.emoji === e ? 'bg-amber-200 ring-1 ring-amber-400' : ''}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={buyPickForm.emoji}
                    onChange={(e) => setBuyPickForm((prev) => ({ ...prev, emoji: e.target.value }))}
                    className="h-8 w-8 shrink-0 rounded-md border border-amber-200 bg-white text-center text-base outline-none focus:border-amber-400"
                    maxLength={2}
                    title="Hoặc gõ emoji bất kỳ"
                  />
                  <Input
                    autoFocus
                    value={buyPickForm.category}
                    onChange={(e) => setBuyPickForm((prev) => ({ ...prev, category: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Escape') cancelBuyPickForm() }}
                    placeholder={t('notes.buyPicks.categoryPlaceholder')}
                    className="flex-1 h-8 text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {buyPickForm.brands.map((brand, i) => {
                    const c = getTagColor(brand)
                    return (
                      <span key={i} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${c.bg} ${c.border} ${c.text}`}>
                        {brand}
                        <button
                          type="button"
                          onClick={() => setBuyPickForm((prev) => ({ ...prev, brands: prev.brands.filter((_, j) => j !== i) }))}
                          className="opacity-60 transition-opacity hover:opacity-100"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )
                  })}
                  <Input
                    value={buyPickForm.brandInput}
                    onChange={(e) => setBuyPickForm((prev) => ({ ...prev, brandInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const newBrands = buyPickForm.brandInput.split(',').map(b => b.trim()).filter(b => b && !buyPickForm.brands.includes(b))
                        if (newBrands.length > 0) {
                          setBuyPickForm((prev) => ({ ...prev, brands: [...prev.brands, ...newBrands], brandInput: '' }))
                        }
                      }
                    }}
                    placeholder={t('notes.buyPicks.brandPlaceholder')}
                    className="h-7 w-40 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button variant="ghost" size="sm" onClick={cancelBuyPickForm} className="h-7 text-xs text-zinc-500">
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void saveBuyPick()}
                    disabled={savingBuyPick || !buyPickForm.category.trim()}
                    className="h-7 bg-amber-500 text-xs text-white hover:bg-amber-600"
                  >
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            )}

            {/* Compact grid */}
            {buyPicks.length === 0 && !addingBuyPick ? (
              <p className="py-4 text-center text-sm text-zinc-400">{t('notes.buyPicks.empty')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.25 sm:grid-cols-3 lg:grid-cols-4">
                {buyPicks.map((pick) => editingBuyPickId !== pick.id && (
                  <div key={pick.id} className="group rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md">
                    <div className="mb-2 flex items-start justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-base leading-none">{pick.emoji}</span>
                        <span className="truncate text-xs font-bold text-zinc-800">{pick.category}</span>
                      </div>
                      <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => startEditBuyPick(pick)}
                          className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={() => setDeleteBuyPick(pick)}
                          className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-rose-50 hover:text-rose-500"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pick.brands.length > 0 ? pick.brands.map((brand, i) => {
                        const c = getTagColor(brand)
                        return (
                          <span key={i} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.bg} ${c.border} ${c.text}`}>
                            {brand}
                          </span>
                        )
                      }) : (
                        <span className="text-[10px] italic text-zinc-400">{t('notes.buyPicks.noBrands')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        )}

        {currentTab === 'goals' && (
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
          <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3">
            <Target className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('notes.goals.heading')}</span>
          </div>

          <div className="px-4 py-3">
            <div className="mb-4 flex gap-2">
              {(['all', 'active', 'completed'] as const).map((filter) => {
                const isSelected = goalFilter === filter
                const allGoals = goals.length
                const activeGoals = goals.filter((g) => g.status === 'active').length
                const completedGoals = goals.filter((g) => g.status === 'completed').length

                let label = ''
                let count = 0
                let bgColor = 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'

                if (filter === 'all') {
                  label = t('notes.goals.filterAll')
                  count = allGoals
                  bgColor = isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                } else if (filter === 'active') {
                  label = t('notes.goals.filterActive')
                  count = activeGoals
                  bgColor = isSelected ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                } else {
                  label = t('notes.goals.filterCompleted')
                  count = completedGoals
                  bgColor = isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }

                return (
                  <button
                    key={filter}
                    onClick={() => setGoalFilter(filter)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${bgColor} ${
                      isSelected
                        ? filter === 'active'
                          ? 'border-blue-300'
                          : 'border-emerald-300'
                        : filter === 'active'
                        ? 'border-blue-100'
                        : 'border-emerald-100'
                    }`}
                  >
                    {label}
                    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                      isSelected
                        ? filter === 'active'
                          ? 'bg-blue-200 text-blue-900'
                          : 'bg-emerald-200 text-emerald-900'
                        : filter === 'active'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {goalDraft ? (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border-l-4 border-dashed border-emerald-300 bg-emerald-50/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="text"
                    value={goalDraft.title}
                    onChange={(e) => setGoalDraft((prev) => prev ? { ...prev, title: e.target.value } : null)}
                    placeholder={t('notes.goals.namePlaceholder')}
                    className="flex-1 h-8 border-emerald-200 bg-white text-zinc-900"
                  />
                  <select
                    value={goalDraft.type}
                    onChange={(e) => setGoalDraft((prev) => prev ? { ...prev, type: e.target.value } : null)}
                    className="h-8 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
                  >
                    <option value="health">{t('notes.goals.typeOptions.health')}</option>
                    <option value="learning">{t('notes.goals.typeOptions.learning')}</option>
                    <option value="fitness">{t('notes.goals.typeOptions.fitness')}</option>
                    <option value="work">{t('notes.goals.typeOptions.work')}</option>
                    <option value="personal">{t('notes.goals.typeOptions.personal')}</option>
                    <option value="other">{t('notes.goals.typeOptions.other')}</option>
                  </select>
                </div>
                <textarea
                  ref={goalDescriptionRef}
                  value={goalDraft.description || ''}
                  onChange={(e) => setGoalDraft((prev) => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder={t('notes.goals.descPlaceholder')}
                  rows={2}
                  className={autoTextareaClass}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <DatePicker value={goalDraft.target_date || ''} onChange={(v) => setGoalDraft((prev) => prev ? { ...prev, target_date: v } : null)} />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={goalDraft.completion_percentage || 0}
                    onChange={(e) => setGoalDraft((prev) => prev ? { ...prev, completion_percentage: Number(e.target.value) } : null)}
                    className="flex-1 min-w-48"
                  />
                  <span className="w-9 text-right text-xs font-medium text-zinc-600">{goalDraft.completion_percentage || 0}%</span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelGoalDraft} className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingGoal || !goalDraft.title.trim()}
                    onClick={addGoal}
                    className="bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500"
                  >
                    <Check />
                    {t('common.add')}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={openGoalDraft}
                className="mb-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-300 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                <Plus className="h-4 w-4" />
                {t('notes.goals.addNew')}
              </button>
            )}

            <div className="space-y-2">
              {goals
                .filter((goal) => goalFilter === 'all' || goal.status === goalFilter)
                .map((goal) => (
                  <div key={goal.id} className="rounded-xl border border-emerald-100 bg-white p-3 sm:p-4 shadow-[0_1px_4px_0_rgba(16,185,129,0.06)] hover:shadow-[0_3px_10px_0_rgba(16,185,129,0.12)] transition-shadow group">
                    <div className="flex flex-col gap-3">
                      {/* Goal Header */}
                      <div className="w-full">
                        {editingGoalId === goal.id && editingGoalDraft ? (
                          <div className="flex flex-col gap-2 mb-3">
                            <input
                              autoFocus
                              type="text"
                              value={editingGoalDraft.title}
                              onChange={(e) => setEditingGoalDraft((prev) => prev ? { ...prev, title: e.target.value } : null)}
                              placeholder={t('notes.goals.namePlaceholder')}
                              className="w-full rounded-md border border-emerald-300 bg-white px-2 py-1.5 text-sm font-medium text-zinc-900 outline-none focus:border-emerald-500"
                            />
                            <div className="flex flex-wrap gap-2">
                              <select
                                value={editingGoalDraft.type}
                                onChange={(e) => setEditingGoalDraft((prev) => prev ? { ...prev, type: e.target.value } : null)}
                                className="h-8 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
                              >
                                <option value="health">{t('notes.goals.typeOptions.health')}</option>
                                <option value="learning">{t('notes.goals.typeOptions.learning')}</option>
                                <option value="fitness">{t('notes.goals.typeOptions.fitness')}</option>
                                <option value="work">{t('notes.goals.typeOptions.work')}</option>
                                <option value="personal">{t('notes.goals.typeOptions.personal')}</option>
                                <option value="other">{t('notes.goals.typeOptions.other')}</option>
                              </select>
                              <DatePicker value={editingGoalDraft.start_date || ''} onChange={(v) => setEditingGoalDraft((prev) => prev ? { ...prev, start_date: v } : null)} />
                              <DatePicker value={editingGoalDraft.target_date || ''} onChange={(v) => setEditingGoalDraft((prev) => prev ? { ...prev, target_date: v } : null)} />
                            </div>
                            <textarea
                              ref={editingGoalDescriptionRef}
                              value={editingGoalDraft.description || ''}
                              onChange={(e) => setEditingGoalDraft((prev) => prev ? { ...prev, description: e.target.value } : null)}
                              placeholder={t('notes.goals.descPlaceholder')}
                              rows={2}
                              className={autoTextareaClass}
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="10"
                                value={editingGoalDraft.completion_percentage || 0}
                                onChange={(e) => setEditingGoalDraft((prev) => prev ? { ...prev, completion_percentage: Number(e.target.value) } : null)}
                                className="flex-1"
                              />
                              <span className="w-12 text-right text-xs font-medium text-zinc-600">{editingGoalDraft.completion_percentage || 0}%</span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={savingGoal || !editingGoalDraft.title.trim()}
                                onClick={() => void saveEditingGoal(goal)}
                                className="text-emerald-600 hover:bg-emerald-100"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={savingGoal}
                                onClick={cancelEditingGoal}
                                className="text-zinc-500 hover:bg-zinc-200"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-base text-zinc-900">{goal.title}</h3>
                              <span className="text-sm px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">{getGoalTypeLabel(goal.type, t)}</span>
                            </div>

                            {/* Timeline */}
                            {(goal.start_date || goal.target_date) && (
                              <div className="text-sm text-zinc-600 space-y-1">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                  {goal.start_date && (
                                    <span>📅 <span className="text-zinc-700 font-medium">{new Date(goal.start_date).toLocaleDateString(getIntlLocale(lang))}</span></span>
                                  )}
                                  {goal.target_date && (
                                    <span>🎯 <span className="text-zinc-700 font-medium">{new Date(goal.target_date).toLocaleDateString(getIntlLocale(lang))}</span></span>
                                  )}
                                </div>
                                {goal.start_date && goal.target_date && (() => {
                                  const start = new Date(goal.start_date)
                                  const end = new Date(goal.target_date)
                                  const now = new Date()
                                  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                                  const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                                  const remainingDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                                  return (
                                    <div className="text-sm text-zinc-600">⏱️ <span className="font-medium text-zinc-700">{Math.max(0, elapsedDays)}/{totalDays}</span> {t('notes.goals.daysRemainingPrefix')} <span className="font-medium text-zinc-700">{Math.max(0, remainingDays)}</span></div>
                                  )
                                })()}
                              </div>
                            )}

                            {goal.description && (
                              <p className="text-sm text-zinc-600 whitespace-pre-wrap">{goal.description}</p>
                            )}

                            {/* Progress Bar */}
                            {goal.completion_percentage !== undefined && (
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-sm font-medium text-zinc-700">{t('notes.goals.progress')}</span>
                                  <span className="text-sm font-semibold text-emerald-600">{goal.completion_percentage}%</span>
                                </div>
                                <div className="w-full bg-emerald-100 rounded-full h-2 overflow-hidden shadow-inner">
                                  <div
                                    className="bg-linear-to-r from-emerald-500 to-emerald-600 h-full transition-all duration-300"
                                    style={{ width: `${goal.completion_percentage}%` }}
                                  />
                                </div>
                              </div>
                            )}
                            </div>
                        )}
                      </div>

                      {/* Actions */}
                      {editingGoalId !== goal.id && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-50">
                          <select
                            value={goal.status}
                            onChange={(e) => updateGoalStatus(goal, e.target.value as Goal['status'])}
                            className="h-8 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
                          >
                            <option value="active">{t('notes.goals.statusOptions.active')}</option>
                            <option value="completed">{t('notes.goals.statusOptions.completed')}</option>
                            <option value="archived">{t('notes.goals.statusOptions.archived')}</option>
                          </select>
                          <div className="flex items-center gap-1 ml-auto">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => startEditingGoal(goal)}
                              className="text-emerald-400 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100 hover:bg-emerald-100 hover:text-emerald-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleteGoal(goal)}
                              className="text-rose-300 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100 hover:bg-rose-500/15"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      {expandedGoal === goal.id ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          {t('notes.goals.hideDetails')}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          {t('notes.goals.showDetails')}
                        </>
                      )}
                    </button>

                    {expandedGoal === goal.id && (
                      <div className="mt-3 border-t border-emerald-100 pt-3">
                        <div className="space-y-2 mb-3">
                          {(goalItems[goal.id] || []).map((item, itemIndex) => (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={() => setDraggedItemId(item.id)}
                              onDragOver={(e) => {
                                e.preventDefault()
                                setDragOverItemId(item.id)
                              }}
                              onDragLeave={() => setDragOverItemId(null)}
                              onDrop={() => {
                                if (draggedItemId && draggedItemId !== item.id) {
                                  const draggedIndex = (goalItems[goal.id] || []).findIndex((i) => i.id === draggedItemId)
                                  void reorderGoalItems(goal.id, draggedIndex, itemIndex)
                                }
                                setDraggedItemId(null)
                                setDragOverItemId(null)
                              }}
                              onDragEnd={() => {
                                setDraggedItemId(null)
                                setDragOverItemId(null)
                              }}
                              onDoubleClick={() => {
                                if (editingGoalItemId !== item.id) {
                                  startEditingGoalItem(item)
                                }
                              }}
                              className={`flex flex-col sm:flex-row sm:items-start gap-2 rounded-lg border p-2 transition-all cursor-move group ${
                                draggedItemId === item.id ? 'opacity-50 border-emerald-400 bg-emerald-100' : 'border-emerald-50 bg-emerald-50/50'
                              } ${
                                dragOverItemId === item.id && draggedItemId !== item.id ? 'border-emerald-400 bg-emerald-100/50' : ''
                              } hover:bg-emerald-100/30`}
                            >
                              <button
                                onClick={() => void toggleGoalItem(item)}
                                className="shrink-0 mt-0.5 text-emerald-600 hover:text-emerald-700 transition-colors"
                              >
                                {item.is_completed ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <Circle className="h-4 w-4" />
                                )}
                              </button>
                              <div className="flex-1 w-full">
                                {editingGoalItemId === item.id && editingGoalItemDraft ? (
                                  <div className="flex flex-col gap-2 w-full">
                                    <input
                                      autoFocus
                                      type="text"
                                      value={editingGoalItemDraft.content}
                                      onChange={(e) => setEditingGoalItemDraft((prev) => prev ? { ...prev, content: e.target.value } : null)}
                                      placeholder={t('notes.goals.itemContentPlaceholder')}
                                      className="w-full rounded-md border border-emerald-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-emerald-500"
                                    />
                                    <div className="flex gap-2">
                                      <select
                                        value={editingGoalItemDraft.item_type}
                                        onChange={(e) => setEditingGoalItemDraft((prev) => prev ? { ...prev, item_type: e.target.value } : null)}
                                        className="h-7 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
                                      >
                                        <option value="routine">{t('notes.goals.itemTypeOptions.routine')}</option>
                                        <option value="meal">{t('notes.goals.itemTypeOptions.meal')}</option>
                                        <option value="lesson">{t('notes.goals.itemTypeOptions.lesson')}</option>
                                        <option value="exercise">{t('notes.goals.itemTypeOptions.exercise')}</option>
                                        <option value="other">{t('notes.goals.itemTypeOptions.other')}</option>
                                      </select>
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={editingGoalItemDraft.is_completed || false}
                                          onChange={(e) => setEditingGoalItemDraft((prev) => prev ? { ...prev, is_completed: e.target.checked } : null)}
                                          className="h-4 w-4 accent-emerald-500"
                                        />
                                        <span className="text-xs font-medium text-zinc-600">{t('notes.goals.itemDoneLabel')}</span>
                                      </label>
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-zinc-700 block mb-1">{t('notes.goals.itemResultLabel')}</label>
                                      <textarea
                                        value={editingGoalItemDraft.result || ''}
                                        onChange={(e) => setEditingGoalItemDraft((prev) => prev ? { ...prev, result: e.target.value } : null)}
                                        placeholder={t('notes.goals.itemResultPlaceholder')}
                                        rows={3}
                                        className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-emerald-500 resize-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-zinc-700 block mb-1">{t('notes.goals.itemMetadataLabel')}</label>
                                      <textarea
                                        value={JSON.stringify(editingGoalItemDraft.metadata || {}, null, 2)}
                                        onChange={(e) => {
                                          try {
                                            const parsed = JSON.parse(e.target.value)
                                            setEditingGoalItemDraft((prev) => prev ? { ...prev, metadata: parsed } : null)
                                          } catch {
                                            // Allow user to type, validation on save
                                          }
                                        }}
                                        placeholder='{"key": "value"}'
                                        rows={6}
                                        className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs font-mono text-zinc-900 outline-none focus:border-emerald-500 resize-none"
                                      />
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={savingGoalItem || !editingGoalItemDraft.content.trim()}
                                        onClick={() => void saveEditingGoalItem(item)}
                                        className="text-emerald-600 hover:bg-emerald-100"
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={savingGoalItem}
                                        onClick={cancelEditingGoalItem}
                                        className="text-zinc-500 hover:bg-zinc-200"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p
                                      className={`text-sm px-1 py-0.5 rounded ${
                                        item.is_completed ? 'line-through text-zinc-400' : 'text-zinc-900'
                                      }`}
                                    >
                                      {item.content}
                                    </p>
                                    <div className="flex gap-1.5 flex-wrap items-center mt-1">
                                      <span className="text-sm px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-block">
                                        {getGoalItemTypeLabel(item.item_type, t)}
                                      </span>
                                      {item.is_completed && (
                                        <span className="text-sm px-1.5 py-0.5 rounded bg-emerald-500 text-white inline-block">
                                          {t('notes.goals.itemDoneBadge')}
                                        </span>
                                      )}
                                    </div>
                                    {item.result && (
                                      <div className="mt-1.5 p-1.5 rounded-md bg-blue-50 border border-blue-100">
                                        <p className="text-sm font-medium text-blue-900">{t('notes.goals.itemResultLabel')}</p>
                                        <p className="text-sm text-blue-800 whitespace-pre-wrap mt-0.5">{item.result}</p>
                                      </div>
                                    )}
                                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                                      <p className="text-sm text-zinc-600 mt-1">
                                        {Object.entries(item.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                              {editingGoalItemId !== item.id && (
                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => startEditingGoalItem(item)}
                                    className="text-emerald-400 hover:bg-emerald-100 hover:text-emerald-600"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => setDeleteGoalItem(item)}
                                    className="text-rose-300 hover:bg-rose-500/15"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                          {(goalItems[goal.id] || []).length === 0 && (
                            <p className="text-sm text-zinc-400 italic">{t('notes.goals.itemsEmpty')}</p>
                          )}
                        </div>
                        <form
                          onSubmit={(e) => { e.preventDefault(); void addGoalItem(goal) }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={goalItemDraft[goal.id]?.content || ''}
                            onChange={(e) => setGoalItemDraft((prev) => ({
                              ...prev,
                              [goal.id]: { ...prev[goal.id], content: e.target.value, item_type: prev[goal.id]?.item_type || 'routine' }
                            }))}
                            placeholder={t('notes.goals.itemAddPlaceholder')}
                            className="flex-1 rounded-lg border border-dashed border-emerald-200 bg-transparent px-2 py-1.5 text-xs text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white"
                          />
                          <select
                            value={goalItemDraft[goal.id]?.item_type || 'routine'}
                            onChange={(e) => setGoalItemDraft((prev) => ({
                              ...prev,
                              [goal.id]: {
                                content: prev[goal.id]?.content || '',
                                item_type: e.target.value,
                                metadata: prev[goal.id]?.metadata || {},
                              }
                            }))}
                            className="h-8 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400"
                          >
                            <option value="routine">{t('notes.goals.itemTypeOptions.routine')}</option>
                            <option value="meal">{t('notes.goals.itemTypeOptions.meal')}</option>
                            <option value="lesson">{t('notes.goals.itemTypeOptions.lesson')}</option>
                            <option value="exercise">{t('notes.goals.itemTypeOptions.exercise')}</option>
                            <option value="other">{t('notes.goals.itemTypeOptions.other')}</option>
                          </select>
                          <button
                            type="submit"
                            disabled={savingGoalItem || !goalItemDraft[goal.id]?.content?.trim()}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t('common.add')}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}

              {goals.filter((goal) => goalFilter === 'all' || goal.status === goalFilter).length === 0 && (
                <div className="text-center py-8 text-zinc-500">{t('notes.goals.empty')}</div>
              )}
            </div>
          </div>
        </section>
        )}

        {currentTab === 'calo' && (
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
        </>
        )}

        {currentTab === 'meals' && (
        <section className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-[0_4px_20px_-8px_rgba(234,88,12,0.25)]">
          <div className="border-b border-orange-100 px-4 py-3.5">
            <h3 className="font-semibold text-zinc-900">{t('notes.meals.heading')}</h3>
          </div>
          <div className="p-4">
            <MealScheduleTracker />
          </div>
        </section>
        )}

        {currentTab === 'health' && (
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
          <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3">
            <span className="text-xl">💪</span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('notes.health.heading')}</span>
            <a
              href={`/admin/create?autotag=${encodeURIComponent('Sức Khỏe')}`}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              <Plus className="h-3 w-3" />
              {t('notes.health.newPost')}
            </a>
          </div>

          <div className="px-4 py-3">
            {healthPosts.length === 0 ? (
              <div className="py-6 text-center text-sm text-zinc-500">{t('notes.health.empty')}</div>
            ) : (
              <div className="space-y-3">
                {healthPosts.map((post) => (
                  <a
                    key={post.id}
                    href={`/blog/${post.slug}?from=health`}
                    className="block rounded-lg border border-emerald-100 bg-white p-4 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-semibold text-zinc-900 hover:text-emerald-600">{post.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600 line-clamp-2">{post.excerpt}</p>
                    {post.tags && post.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {post.tags.map((tag) => (
                          <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            #{tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
        )}

        {currentTab === 'weight' && (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
            <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3">
              <span className="text-xl">⚖️</span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('notes.weight.heading')}</span>
            </div>
            <div className="p-4">
              <WeightTracker />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-teal-200 bg-[linear-gradient(130deg,#f0fdfa_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(20,184,166,0.2)]">
            <div className="flex items-center gap-2 border-b border-teal-100 px-4 py-3">
              <span className="text-xl">🚽</span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">{t('notes.bowel.heading')}</span>
            </div>
            <div className="p-4">
              <BowelTracker />
            </div>
          </section>
        </div>
        )}

        {currentTab === 'stats' && (
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
