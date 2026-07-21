'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, CheckCircle2, Circle, Plus, Trash2, X, Check, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { Meal } from '@/types'
import { useLanguage } from '@/lib/i18n/language-context'

const DEFAULT_MEALS = [
  { time: '07:00', name: 'Bữa sáng', target_calories: 520, foods: ['Cơm trắng: 150g', 'Trứng luộc: 2 quả', 'Sữa nóng: 150ml', 'Mật ong: 1.5 thìa'] },
  { time: '09:30', name: 'Sáng muộn', target_calories: 380, foods: ['Bánh mì trắng: 2 lát', 'Bơ: 1 thìa', 'Chuối: 1 quả', 'Sữa chua plain: 100g'] },
  { time: '12:00', name: 'Bữa trưa', target_calories: 680, foods: ['Cơm trắng: 250g', 'Gà nướng: 180g (không da)', 'Cháo gạo nhạt: 150ml', 'Dầu ô liu: 0.5 thìa'] },
  { time: '15:00', name: 'Chiều', target_calories: 360, foods: ['Bánh mì trắng nướng: 2 lát', 'Bơ: 1 thìa', 'Mật ong pha sữa ấm: 250ml', 'Chuối: 0.5 quả'] },
  { time: '17:00', name: 'Tối', target_calories: 460, foods: ['Sữa nóng: 300ml', 'Yến mạch: 40g', 'Trứng luộc: 1 quả', 'Mật ong: 1 thìa'] },
]

type EditForm = {
  time: string
  name: string
  target_calories: string
  foods: string
}

const EMPTY_FORM: EditForm = { time: '', name: '', target_calories: '', foods: '' }

export function MealScheduleTracker() {
  const { t } = useLanguage()
  const [meals, setMeals] = useState<Meal[]>([])
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const isSettingUpRef = useRef(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM)
  const [addingNew, setAddingNew] = useState(false)
  const [newForm, setNewForm] = useState<EditForm>(EMPTY_FORM)
  const [savingNew, setSavingNew] = useState(false)

  async function fetchMeals() {
    try {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('date', selectedDate)
        .order('time', { ascending: true })

      if (error) throw error

      const seen = new Set<string>()
      const deduped = (data || []).filter((m: Meal) => {
        if (seen.has(m.meal_type)) return false
        seen.add(m.meal_type)
        return true
      })

      if (deduped.length === 0) {
        if (isSettingUpRef.current) return
        isSettingUpRef.current = true
        await setupDefaultMeals()
        isSettingUpRef.current = false
      } else {
        setMeals(deduped as Meal[])
        setLoading(false)
      }
    } catch (error) {
      console.error('Error fetching meals:', error)
      toast.error(t('mealScheduleTracker.loadError'))
      setLoading(false)
    }
  }

  useEffect(() => {
    isSettingUpRef.current = false
    setLoading(true)
    void fetchMeals()
  }, [selectedDate])

  async function setupDefaultMeals() {
    try {
      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()

      const mealsToInsert = DEFAULT_MEALS.map((meal, idx) => ({
        date: selectedDate,
        meal_type: ['breakfast', 'mid_morning', 'lunch', 'afternoon', 'dinner'][idx],
        time: meal.time,
        name: meal.name,
        target_calories: meal.target_calories,
        foods: meal.foods,
        is_completed: false,
        ...(user ? { user_id: user.id } : {}),
      }))

      const { error } = await supabase.from('meals').insert(mealsToInsert)
      if (error) throw error

      const { data: newData } = await supabase
        .from('meals')
        .select('*')
        .eq('date', selectedDate)
        .order('time', { ascending: true })

      setMeals((newData || []) as Meal[])
      setLoading(false)
    } catch (error) {
      console.error('Error setting up meals:', error)
      setLoading(false)
    }
  }

  async function toggleMealComplete(meal: Meal) {
    try {
      const { error } = await supabase
        .from('meals')
        .update({
          is_completed: !meal.is_completed,
          completed_at: !meal.is_completed ? new Date().toISOString() : null,
        })
        .eq('id', meal.id)

      if (error) throw error
      setMeals((prev) =>
        prev.map((m) =>
          m.id === meal.id
            ? { ...m, is_completed: !m.is_completed, completed_at: !meal.is_completed ? new Date().toISOString() : undefined }
            : m
        )
      )
      toast.success(meal.is_completed ? t('mealScheduleTracker.unmarked') : t('mealScheduleTracker.completed'))
    } catch {
      toast.error(t('mealScheduleTracker.updateError'))
    }
  }

  async function deleteMeal(id: string) {
    try {
      const { error } = await supabase.from('meals').delete().eq('id', id)
      if (error) throw error
      setMeals((prev) => prev.filter((m) => m.id !== id))
      toast.success(t('mealScheduleTracker.deleted'))
    } catch {
      toast.error(t('mealScheduleTracker.deleteError'))
    }
  }

  function startEdit(meal: Meal) {
    setAddingNew(false)
    setEditingId(meal.id)
    setEditForm({
      time: meal.time,
      name: meal.name,
      target_calories: String(meal.target_calories),
      foods: meal.foods.join('\n'),
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id: string) {
    const calories = parseInt(editForm.target_calories, 10)
    if (!editForm.name.trim() || !editForm.time || isNaN(calories)) {
      toast.error(t('mealScheduleTracker.fillAllFields'))
      return
    }
    const foods = editForm.foods.split('\n').map((f) => f.trim()).filter(Boolean)
    try {
      const { error } = await supabase
        .from('meals')
        .update({ time: editForm.time, name: editForm.name.trim(), target_calories: calories, foods })
        .eq('id', id)
      if (error) throw error
      setMeals((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, time: editForm.time, name: editForm.name.trim(), target_calories: calories, foods } : m
        )
      )
      setEditingId(null)
      toast.success(t('mealScheduleTracker.updated'))
    } catch {
      toast.error(t('mealScheduleTracker.updateError'))
    }
  }

  async function addMeal() {
    const calories = parseInt(newForm.target_calories, 10)
    if (!newForm.name.trim() || !newForm.time || isNaN(calories)) {
      toast.error(t('mealScheduleTracker.fillAllFields'))
      return
    }
    setSavingNew(true)
    try {
      const foods = newForm.foods.split('\n').map((f) => f.trim()).filter(Boolean)
      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
      const slug = newForm.name.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 20)
      const mealType = `custom_${slug}_${Math.random().toString(36).slice(2, 7)}`

      const { error } = await supabase.from('meals').insert({
        date: selectedDate,
        meal_type: mealType,
        time: newForm.time,
        name: newForm.name.trim(),
        target_calories: calories,
        foods,
        is_completed: false,
        ...(user ? { user_id: user.id } : {}),
      })
      if (error) throw error

      setAddingNew(false)
      setNewForm(EMPTY_FORM)
      void fetchMeals()
      toast.success(t('mealScheduleTracker.added'))
    } catch {
      toast.error(t('mealScheduleTracker.addError'))
    } finally {
      setSavingNew(false)
    }
  }

  const totalCalories = meals.reduce((sum, m) => sum + m.target_calories, 0)
  const completedCount = meals.filter((m) => m.is_completed).length
  const completedCalories = meals.filter((m) => m.is_completed).reduce((sum, m) => sum + m.target_calories, 0)
  const completionPercent = meals.length > 0 ? Math.round((completedCount / meals.length) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white p-3 sm:p-4">
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-semibold text-zinc-900">{t('mealScheduleTracker.todayHeading', { date: selectedDate })}</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-emerald-200 bg-white px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm text-zinc-900"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-zinc-600">{t('mealScheduleTracker.caloriesEaten')}</span>
            <span className="font-semibold text-zinc-900">{Math.round(completedCalories)} / {totalCalories} kcal</span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-zinc-600">{t('mealScheduleTracker.completedLabel')}</span>
            <span className="font-semibold text-zinc-900">{t('mealScheduleTracker.mealsCount', { done: completedCount, total: meals.length })}</span>
          </div>

          <div className="h-2.5 sm:h-3 overflow-hidden rounded-full border border-emerald-200 bg-emerald-100 shadow-inner">
            <div
              className="h-full bg-linear-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
              style={{ width: `${Math.min(completionPercent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{t('mealScheduleTracker.percentDone', { pct: completionPercent })}</span>
            {totalCalories > 0 && (
              <span className="text-emerald-600 font-medium">
                {totalCalories - completedCalories > 0
                  ? t('mealScheduleTracker.remainingKcal', { n: totalCalories - completedCalories })
                  : t('mealScheduleTracker.goalReached2')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Meals List */}
      <div className="rounded-xl border border-emerald-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">{t('mealScheduleTracker.listHeading')}</h3>
          <button
            type="button"
            onClick={() => { setAddingNew(true); setEditingId(null) }}
            className="flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> {t('mealScheduleTracker.addMeal')}
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-zinc-400">{t('common.loading')}</p>
        ) : meals.length === 0 && !addingNew ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-zinc-400">{t('mealScheduleTracker.noMealsToday')}</p>
            <button
              type="button"
              onClick={() => setAddingNew(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <Plus className="h-4 w-4" /> {t('mealScheduleTracker.addFirstMeal')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {meals.map((meal) => (
              <div
                key={meal.id}
                onDoubleClick={() => editingId !== meal.id && startEdit(meal)}
                className={`rounded-lg border p-2 sm:p-3 transition-all cursor-pointer select-none ${
                  editingId === meal.id
                    ? 'border-emerald-400 bg-emerald-50 shadow-md ring-1 ring-emerald-300'
                    : meal.is_completed
                      ? 'border-emerald-200 bg-emerald-50 shadow-sm hover:shadow-md'
                      : 'border-emerald-100 bg-white shadow-[0_1px_2px_0_rgba(16,185,129,0.1)] hover:shadow-md'
                }`}
              >
                {editingId === meal.id ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="time"
                        value={editForm.time}
                        onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))}
                        className="rounded border border-emerald-300 px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="rounded border border-emerald-300 px-2 py-1 text-xs flex-1 min-w-28 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder={t('mealScheduleTracker.mealNamePlaceholder')}
                      />
                      <input
                        type="number"
                        value={editForm.target_calories}
                        onChange={(e) => setEditForm((f) => ({ ...f, target_calories: e.target.value }))}
                        className="rounded border border-emerald-300 px-2 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder={t('mealScheduleTracker.caloriesPlaceholder')}
                      />
                    </div>
                    <textarea
                      value={editForm.foods}
                      onChange={(e) => setEditForm((f) => ({ ...f, foods: e.target.value }))}
                      rows={Math.max(meal.foods.length, 2) + 1}
                      className="w-full rounded border border-emerald-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
                      placeholder={t('mealScheduleTracker.foodsPlaceholder')}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" /> {t('common.cancel')}
                      </button>
                      <button
                        onClick={() => saveEdit(meal.id)}
                        className="flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-600 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" /> {t('common.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                    <button onClick={() => toggleMealComplete(meal)} className="shrink-0 mt-0.5">
                      {meal.is_completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-zinc-300 hover:text-emerald-400" />
                      )}
                    </button>

                    <div className="flex-1 w-full min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Clock className="h-3.5 w-3.5 text-zinc-500" />
                          <span className="font-medium text-sm text-zinc-900">{meal.time}</span>
                        </div>
                        <span className="text-sm font-medium text-zinc-700">{meal.name}</span>
                        <span className="sm:ml-auto shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {meal.target_calories} kcal
                        </span>
                      </div>

                      <div className="ml-0 sm:ml-6 space-y-0.5">
                        {meal.foods.map((food, idx) => (
                          <p key={idx} className="text-xs text-zinc-600">• {food}</p>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => startEdit(meal)}
                        className="rounded p-1 text-zinc-300 opacity-60 hover:text-emerald-600 hover:opacity-100 transition-all"
                        title={t('mealScheduleTracker.editTitle')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteMeal(meal.id)}
                        className="rounded p-1 text-zinc-300 opacity-60 hover:text-rose-600 hover:opacity-100 transition-all"
                        title={t('mealScheduleTracker.deleteTitle')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new meal form */}
        {addingNew && (
          <div className="mt-3 rounded-lg border border-emerald-400 bg-emerald-50 p-2 sm:p-3 shadow-md ring-1 ring-emerald-300">
            <p className="mb-2 text-xs font-medium text-emerald-700">{t('mealScheduleTracker.newMealTitle')}</p>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  type="time"
                  value={newForm.time}
                  onChange={(e) => setNewForm((f) => ({ ...f, time: e.target.value }))}
                  className="rounded border border-emerald-300 px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                <input
                  type="text"
                  value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  className="rounded border border-emerald-300 px-2 py-1 text-xs flex-1 min-w-28 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="Tên bữa ăn"
                  autoFocus
                />
                <input
                  type="number"
                  value={newForm.target_calories}
                  onChange={(e) => setNewForm((f) => ({ ...f, target_calories: e.target.value }))}
                  className="rounded border border-emerald-300 px-2 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="kcal"
                />
              </div>
              <textarea
                value={newForm.foods}
                onChange={(e) => setNewForm((f) => ({ ...f, foods: e.target.value }))}
                rows={3}
                className="w-full rounded border border-emerald-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
                placeholder={t('mealScheduleTracker.foodsPlaceholderOptional')}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setAddingNew(false); setNewForm(EMPTY_FORM) }}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> {t('common.cancel')}
                </button>
                <button
                  onClick={addMeal}
                  disabled={savingNew}
                  className="flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> {savingNew ? t('common.saving') : t('common.add')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
