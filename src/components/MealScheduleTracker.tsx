'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, CheckCircle2, Circle, Plus, Trash2, X, Check, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { Meal } from '@/types'
import { useLanguage } from '@/lib/i18n/language-context'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { getTodayLocalISODate } from '@/lib/date'

// The five-meal starter plan (feature 009, FR-008 / FR-010a). This is the app's
// default day for ANY date an account has not filled in, so changing it also
// changes what existing accounts get on future days — accepted deliberately
// (FR-010b). Time slots and meal order are unchanged.
const DEFAULT_MEALS_VI = [
  { time: '07:00', name: 'Bữa sáng', target_calories: 400, foods: ['Trứng: 2 quả', 'Bánh mì nguyên cám: 1 lát', 'Sữa tươi: 1 ly'] },
  { time: '09:30', name: 'Bữa phụ', target_calories: 180, foods: ['Táo: 1 quả', 'Hạnh nhân: 10 hạt'] },
  { time: '12:00', name: 'Bữa trưa', target_calories: 550, foods: ['Ức gà nướng: 150g', 'Rau xanh: 100g', 'Cơm gạo lứt: 1 chén'] },
  { time: '15:00', name: 'Bữa phụ', target_calories: 170, foods: ['Sữa chua không đường: 1 hũ', 'Chuối: 1 quả'] },
  { time: '17:00', name: 'Bữa tối', target_calories: 500, foods: ['Cá hồi hấp: 200g', 'Rau củ luộc: 100g', 'Cơm gạo lứt: 1 chén'] },
]

const DEFAULT_MEALS_EN = [
  { time: '07:00', name: 'Breakfast', target_calories: 400, foods: ['Eggs: 2', 'Wholegrain bread: 1 slice', 'Fresh milk: 1 glass'] },
  { time: '09:30', name: 'Snack', target_calories: 180, foods: ['Apple: 1', 'Almonds: 10'] },
  { time: '12:00', name: 'Lunch', target_calories: 550, foods: ['Grilled chicken breast: 150g', 'Greens: 100g', 'Brown rice: 1 bowl'] },
  { time: '15:00', name: 'Snack', target_calories: 170, foods: ['Plain yogurt: 1 cup', 'Banana: 1'] },
  { time: '17:00', name: 'Dinner', target_calories: 500, foods: ['Steamed salmon: 200g', 'Boiled vegetables: 100g', 'Brown rice: 1 bowl'] },
]

type EditForm = {
  time: string
  name: string
  target_calories: string
  foods: string
}

const EMPTY_FORM: EditForm = { time: '', name: '', target_calories: '', foods: '' }

export function MealScheduleTracker() {
  const { t, lang } = useLanguage()
  const DEFAULT_MEALS = lang === 'en' ? DEFAULT_MEALS_EN : DEFAULT_MEALS_VI
  const [meals, setMeals] = useState<Meal[]>([])
  const [selectedDate, setSelectedDate] = useState(() => getTodayLocalISODate())
  const [loading, setLoading] = useState(true)
  const isSettingUpRef = useRef(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM)
  const [addingNew, setAddingNew] = useState(false)
  const [newForm, setNewForm] = useState<EditForm>(EMPTY_FORM)
  const [savingNew, setSavingNew] = useState(false)

  const setupDefaultMeals = useCallback(async () => {
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
  }, [selectedDate, lang])

  const fetchMeals = useCallback(async () => {
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
  }, [selectedDate, setupDefaultMeals, t])

  useEffect(() => {
    isSettingUpRef.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMeals()
  }, [fetchMeals])

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
      setLoading(true)
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
          <DatePicker value={selectedDate} onChange={(v) => { setLoading(true); setSelectedDate(v) }} align="end" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">{t('mealScheduleTracker.caloriesEaten')}</span>
            <span className="font-semibold text-zinc-900">{Math.round(completedCalories)} / {totalCalories} kcal</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">{t('mealScheduleTracker.completedLabel')}</span>
            <span className="font-semibold text-zinc-900">{t('mealScheduleTracker.mealsCount', { done: completedCount, total: meals.length })}</span>
          </div>

          <div className="h-2.5 sm:h-3 overflow-hidden rounded-full border border-emerald-200 bg-emerald-100 shadow-inner">
            <div
              className="h-full bg-linear-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
              style={{ width: `${Math.min(completionPercent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm text-zinc-500">
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
            className="flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> {t('mealScheduleTracker.addMeal')}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-400">{t('common.loading')}</p>
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
                      <TimePicker value={editForm.time} onChange={(v) => setEditForm((f) => ({ ...f, time: v }))} />
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="rounded border border-emerald-300 px-2 py-1 text-sm flex-1 min-w-28 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder={t('mealScheduleTracker.mealNamePlaceholder')}
                      />
                      <input
                        type="number"
                        value={editForm.target_calories}
                        onChange={(e) => setEditForm((f) => ({ ...f, target_calories: e.target.value }))}
                        className="rounded border border-emerald-300 px-2 py-1 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder={t('mealScheduleTracker.caloriesPlaceholder')}
                      />
                    </div>
                    <textarea
                      value={editForm.foods}
                      onChange={(e) => setEditForm((f) => ({ ...f, foods: e.target.value }))}
                      rows={Math.max(meal.foods.length, 2) + 1}
                      className="w-full rounded border border-emerald-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
                      placeholder={t('mealScheduleTracker.foodsPlaceholder')}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 transition-colors"
                      >
                        <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> {t('common.cancel')}
                      </button>
                      <button
                        onClick={() => saveEdit(meal.id)}
                        className="flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 text-sm font-medium text-white hover:bg-emerald-600 transition-colors"
                      >
                        <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> {t('common.save')}
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
                        <span className="sm:ml-auto shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-700">
                          {meal.target_calories} kcal
                        </span>
                      </div>

                      <div className="ml-0 sm:ml-6 space-y-0.5">
                        {meal.foods.map((food, idx) => (
                          <p key={idx} className="text-sm text-zinc-600">• {food}</p>
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
            <p className="mb-2 text-sm font-medium text-emerald-700">{t('mealScheduleTracker.newMealTitle')}</p>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <TimePicker value={newForm.time} onChange={(v) => setNewForm((f) => ({ ...f, time: v }))} />
                <input
                  type="text"
                  value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  className="rounded border border-emerald-300 px-2 py-1 text-sm flex-1 min-w-28 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="Tên bữa ăn"
                  autoFocus
                />
                <input
                  type="number"
                  value={newForm.target_calories}
                  onChange={(e) => setNewForm((f) => ({ ...f, target_calories: e.target.value }))}
                  className="rounded border border-emerald-300 px-2 py-1 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="kcal"
                />
              </div>
              <textarea
                value={newForm.foods}
                onChange={(e) => setNewForm((f) => ({ ...f, foods: e.target.value }))}
                rows={3}
                className="w-full rounded border border-emerald-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
                placeholder={t('mealScheduleTracker.foodsPlaceholderOptional')}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setAddingNew(false); setNewForm(EMPTY_FORM) }}
                  className="flex items-center gap-1 rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 transition-colors"
                >
                  <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> {t('common.cancel')}
                </button>
                <button
                  onClick={addMeal}
                  disabled={savingNew}
                  className="flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> {savingNew ? t('common.saving') : t('common.add')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
