'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, X, Check, Clock, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useCalorieGoal } from '@/lib/useCalorieGoal'
import { FoodTemplate, DailyFood } from '@/types'
import { TimePicker } from '@/components/ui/time-picker'
import { DatePicker } from '@/components/ui/date-picker'
import { FoodPhotoAnalyzer } from '@/components/FoodPhotoAnalyzer'
import { useLanguage } from '@/lib/i18n/language-context'
import { getIntlLocale } from '@/lib/i18n/locale'
import { getTodayLocalISODate } from '@/lib/date'

function todayDate() {
  return getTodayLocalISODate()
}

function currentTimeStr() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function timeStrFromISO(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}


type InputMode = 'custom' | 'list' | 'photo'

export function CalorieTracker() {
  const { t, lang } = useLanguage()
  const [foodTemplates, setFoodTemplates] = useState<FoodTemplate[]>([])
  const [dailyFoods, setDailyFoods] = useState<DailyFood[]>([])
  const [selectedDate, setSelectedDate] = useState(todayDate())
  const [loading, setLoading] = useState(true)

  // Form state
  const [selectedFoodId, setSelectedFoodId] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('1')
  const [customFoodName, setCustomFoodName] = useState<string>('')
  const [customCalories, setCustomCalories] = useState<string>('')
  const [mode, setMode] = useState<InputMode>('custom')
  const useCustom = mode === 'custom'
  const [customTime, setCustomTime] = useState(currentTimeStr)
  const [saving, setSaving] = useState(false)

  const { goal: calorieGoal, saveGoal: dbSaveGoal } = useCalorieGoal()
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Partial<DailyFood> | null>(null)
  const [editingTime, setEditingTime] = useState('')

  const fetchFoodTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('food_templates')
        .select('*')
        .order('category')

      if (error) throw error
      setFoodTemplates((data || []) as FoodTemplate[])
    } catch (error) {
      console.error('Error fetching food templates:', error)
      toast.error(t('calorieTracker.loadFoodsError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const fetchDailyFoods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('daily_foods')
        .select('*')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDailyFoods((data || []) as DailyFood[])
    } catch (error) {
      console.error('Error fetching daily foods:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchFoodTemplates()
  }, [fetchFoodTemplates])

  function saveGoal() {
    const val = parseInt(goalDraft, 10)
    if (!isNaN(val) && val > 0) void dbSaveGoal(val)
    setEditingGoal(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDailyFoods()
  }, [fetchDailyFoods])

  async function addFood() {
    if (useCustom) {
      if (!customFoodName.trim() || !customCalories.trim()) {
        toast.error(t('calorieTracker.enterNameCalories'))
        return
      }
    } else {
      if (!selectedFoodId || !quantity) {
        toast.error(t('calorieTracker.selectFoodQty'))
        return
      }
    }

    setSaving(true)
    try {
      const createdAt = new Date(`${selectedDate}T${customTime}:00`).toISOString()
      const food = useCustom
        ? {
            date: selectedDate,
            custom_food_name: customFoodName.trim(),
            quantity: 1,
            total_calories: Number(customCalories) || 0,
            created_at: createdAt,
          }
        : (() => {
            const template = foodTemplates.find((f) => f.id === selectedFoodId)
            if (!template) throw new Error('Food template not found')
            const qty = Number(quantity) || 1
            return {
              date: selectedDate,
              food_template_id: selectedFoodId,
              quantity: qty,
              total_calories: Math.round(template.calories_per_unit * qty * 10) / 10,
              created_at: createdAt,
            }
          })()

      const { error } = await supabase.from('daily_foods').insert([food])
      if (error) throw error

      await fetchDailyFoods()
      setSelectedFoodId('')
      setQuantity('1')
      setCustomFoodName('')
      setCustomCalories('')
      setCustomTime(currentTimeStr())
      setMode('list')
      toast.success(t('calorieTracker.addSuccess'))
    } catch {
      toast.error(t('calorieTracker.addError'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteFood(id: string) {
    try {
      const { error } = await supabase.from('daily_foods').delete().eq('id', id)
      if (error) throw error
      await fetchDailyFoods()
      toast.success(t('calorieTracker.deleted'))
    } catch {
      toast.error(t('calorieTracker.deleteError'))
    }
  }

  function startEdit(food: DailyFood) {
    const template = foodTemplates.find((f) => f.id === food.food_template_id)
    setEditingId(food.id)
    setEditingData({
      ...food,
      custom_food_name: food.custom_food_name ?? template?.name ?? '',
    })
    setEditingTime(timeStrFromISO(food.created_at))
  }

  async function updateFood(food: DailyFood) {
    if (!editingData) return

    setSaving(true)
    try {
      const { error } = await supabase.from('daily_foods').update({
        custom_food_name: editingData.custom_food_name,
        total_calories: editingData.total_calories,
        // 0 means "not tracked" here — keep it null so entries without macros stay blank.
        protein_g: editingData.protein_g || null,
        carbs_g: editingData.carbs_g || null,
        fat_g: editingData.fat_g || null,
        quantity: editingData.quantity,
        notes: editingData.notes,
        created_at: new Date(`${food.date}T${editingTime}:00`).toISOString(),
      }).eq('id', food.id)

      if (error) throw error
      await fetchDailyFoods()
      setEditingId(null)
      setEditingData(null)
      toast.success(t('calorieTracker.updateSuccess'))
    } catch {
      toast.error(t('calorieTracker.updateError'))
    } finally {
      setSaving(false)
    }
  }

  const totalCalories = dailyFoods.reduce((sum, food) => sum + (food.total_calories || 0), 0)
  const progressPercent = Math.round((totalCalories / calorieGoal) * 100)
  const remainingCalories = calorieGoal - totalCalories

  const macroTotals = dailyFoods.reduce(
    (acc, food) => ({
      protein: Math.round((acc.protein + (food.protein_g ?? 0)) * 10) / 10,
      carbs: Math.round((acc.carbs + (food.carbs_g ?? 0)) * 10) / 10,
      fat: Math.round((acc.fat + (food.fat_g ?? 0)) * 10) / 10,
    }),
    { protein: 0, carbs: 0, fat: 0 }
  )
  const hasMacros = macroTotals.protein > 0 || macroTotals.carbs > 0 || macroTotals.fat > 0

  const selectedTemplate = foodTemplates.find((f) => f.id === selectedFoodId)
  const previewCalories = selectedTemplate && selectedFoodId && !useCustom
    ? Math.round(selectedTemplate.calories_per_unit * (Number(quantity) || 1) * 10) / 10
    : 0

  return (
    <div className="space-y-4">
      {/* Calorie Summary */}
      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">{t('calorieTracker.todayHeading', { date: selectedDate })}</h3>
          <DatePicker value={selectedDate} onChange={(v) => { setLoading(true); setSelectedDate(v) }} align="end" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">{t('calorieTracker.totalCalories')}</span>
            <span className="font-semibold text-zinc-900">
              {Math.round(totalCalories)} /{' '}
              {editingGoal ? (
                <input
                  type="number"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onBlur={saveGoal}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveGoal()
                    if (e.key === 'Escape') setEditingGoal(false)
                  }}
                  autoFocus
                  className="w-20 rounded border border-emerald-300 px-1 py-0.5 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { setGoalDraft(String(calorieGoal)); setEditingGoal(true) }}
                  className="underline decoration-dashed underline-offset-2 hover:text-emerald-600 transition-colors"
                  title={t('calorieTracker.editGoalTitle')}
                >
                  {calorieGoal}
                </button>
              )}{' '}
              kcal
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 overflow-hidden rounded-full border border-emerald-200 bg-emerald-50">
            <div
              className={`h-full transition-all ${
                progressPercent >= 100 ? 'bg-emerald-500' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{progressPercent}%</span>
            {remainingCalories > 0 ? (
              <span className="text-emerald-600">{t('calorieTracker.remainingKcal', { n: Math.round(remainingCalories) })}</span>
            ) : (
              <span className="text-amber-600">{t('calorieTracker.overKcal', { n: Math.round(Math.abs(remainingCalories)) })}</span>
            )}
          </div>

          {hasMacros && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {([
                [t('foodPhoto.protein'), macroTotals.protein],
                [t('foodPhoto.carbs'), macroTotals.carbs],
                [t('foodPhoto.fat'), macroTotals.fat],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-lg bg-emerald-50 px-2 py-1.5 text-center">
                  <p className="text-[10px] text-zinc-500">{label}</p>
                  <p className="text-sm font-semibold tabular-nums text-zinc-900">{value}g</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Food Form */}
      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              mode === 'custom'
                ? 'bg-emerald-500 text-white'
                : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {t('calorieTracker.custom')}
          </button>
          <button
            type="button"
            onClick={() => setMode('list')}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              mode === 'list'
                ? 'bg-emerald-500 text-white'
                : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {t('calorieTracker.list')}
          </button>
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              mode === 'photo'
                ? 'bg-emerald-500 text-white'
                : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            {t('calorieTracker.photo')}
          </button>
        </div>

        {mode === 'photo' ? (
          <FoodPhotoAnalyzer date={selectedDate} onAdded={fetchDailyFoods} />
        ) : useCustom ? (
          <div className="space-y-2">
            <input
              type="text"
              value={customFoodName}
              onChange={(e) => setCustomFoodName(e.target.value)}
              placeholder={t('calorieTracker.foodNamePlaceholder')}
              className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-400"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={customCalories}
                onChange={(e) => setCustomCalories(e.target.value)}
                placeholder={t('calorieTracker.caloriesPlaceholder')}
                className="w-24 rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-400"
              />
              <TimePicker value={customTime} onChange={setCustomTime} />
            </div>
            <button
              type="button"
              onClick={addFood}
              disabled={saving || !customFoodName.trim() || !customCalories.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('common.add')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <select
              value={selectedFoodId}
              onChange={(e) => setSelectedFoodId(e.target.value)}
              className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-400"
            >
              <option value="">{t('calorieTracker.chooseFoodOption')}</option>
              {foodTemplates.map((food) => (
                <option key={food.id} value={food.id}>
                  {food.name} ({food.calories_per_unit} kcal/{food.unit})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={t('calorieTracker.quantityPlaceholder')}
                min="0.1"
                step="0.1"
                className="w-24 rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-400"
              />
              <span className="text-sm text-zinc-600">{selectedTemplate?.unit}</span>
              {previewCalories > 0 && (
                <span className="text-sm font-medium text-emerald-600">= {previewCalories} kcal</span>
              )}
              <TimePicker value={customTime} onChange={setCustomTime} />
            </div>
            <button
              type="button"
              onClick={addFood}
              disabled={saving || !selectedFoodId || !quantity}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('common.add')}
            </button>
          </div>
        )}
      </div>

      {/* Daily Foods List */}
      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-zinc-900">{t('calorieTracker.foodListHeading')}</h3>

        {loading ? (
          <p className="text-xs text-zinc-400">{t('common.loading')}</p>
        ) : dailyFoods.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">{t('calorieTracker.emptyFoods')}</p>
        ) : (
          <div className="space-y-2">
            {dailyFoods.map((food) => {
              const template = foodTemplates.find((f) => f.id === food.food_template_id)
              const isEditing = editingId === food.id

              return (
                <div
                  key={food.id}
                  onDoubleClick={() => !isEditing && startEdit(food)}
                  className={`rounded-lg border p-3 transition-all ${
                    isEditing
                      ? 'border-emerald-400 bg-emerald-50 shadow-md ring-1 ring-emerald-300'
                      : 'cursor-pointer select-none border-emerald-100 bg-emerald-50 hover:shadow-sm'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editingData?.custom_food_name ?? ''}
                        onChange={(e) => setEditingData({ ...editingData, custom_food_name: e.target.value })}
                        className="rounded border border-emerald-300 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder={t('calorieTracker.editFoodNamePlaceholder')}
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={editingData?.total_calories ?? 0}
                          onChange={(e) => setEditingData({ ...editingData, total_calories: Number(e.target.value) || 0 })}
                          className="w-14 sm:w-24 rounded border border-emerald-300 px-1.5 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          min="0"
                          step="1"
                        />
                        <span className="hidden sm:inline text-xs text-zinc-600">kcal</span>
                        <TimePicker value={editingTime} onChange={setEditingTime} className="px-1.5 py-1 text-xs sm:px-2.5 sm:py-1.5 sm:text-sm" />
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => { setEditingId(null); setEditingData(null); setEditingTime('') }}
                            className="flex items-center gap-1 rounded p-1.5 sm:px-2 sm:py-1 text-xs text-zinc-500 hover:bg-white transition-colors"
                          >
                            <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> <span className="hidden sm:inline">{t('common.cancel')}</span>
                          </button>
                          <button
                            onClick={() => updateFood(food)}
                            disabled={saving}
                            className="flex items-center gap-1 rounded bg-emerald-500 p-1.5 sm:px-2.5 sm:py-1 text-xs font-medium text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                          >
                            <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> <span className="hidden sm:inline">{t('common.save')}</span>
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          ['protein_g', t('foodPhoto.protein')],
                          ['carbs_g', t('foodPhoto.carbs')],
                          ['fat_g', t('foodPhoto.fat')],
                        ] as const).map(([field, label]) => (
                          <label key={field} className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-zinc-500">{label} (g)</span>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={editingData?.[field] ?? 0}
                              onChange={(e) => setEditingData({ ...editingData, [field]: Number(e.target.value) || 0 })}
                              className="w-full rounded border border-emerald-300 px-1.5 py-1 text-xs tabular-nums text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-900 leading-snug">
                          {food.custom_food_name || template?.name}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(food)}
                            className="rounded-md text-zinc-400 hover:bg-emerald-100 hover:text-emerald-600 p-1.5 sm:p-1"
                          >
                            <Edit2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteFood(food.id)}
                            className="rounded-md text-zinc-300 hover:bg-rose-100 hover:text-rose-600 p-1.5 sm:p-1"
                          >
                            <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                          <Clock className="h-3 w-3" />
                          {new Date(food.created_at).toLocaleTimeString(getIntlLocale(lang), { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <p className="text-xs text-zinc-500">
                          {template && !food.custom_food_name ? `${food.quantity} ${template.unit} • ` : ''}{Math.round(food.total_calories * 10) / 10} kcal
                        </p>
                        {(food.protein_g || food.carbs_g || food.fat_g) ? (
                          <p className="text-[11px] tabular-nums text-zinc-400">
                            P {food.protein_g ?? 0}g · C {food.carbs_g ?? 0}g · F {food.fat_g ?? 0}g
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
