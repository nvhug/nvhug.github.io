'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2, Edit2, X, Check, Camera, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useCalorieGoal } from '@/lib/useCalorieGoal'
import { DailyFood } from '@/types'
import { TimePicker } from '@/components/ui/time-picker'
import { DatePicker } from '@/components/ui/date-picker'
import { FoodPhotoAnalyzer } from '@/components/FoodPhotoAnalyzer'
import { deleteFoodThumb } from '@/lib/storage'
import { useLanguage } from '@/lib/i18n/language-context'
import { getIntlLocale } from '@/lib/i18n/locale'
import { getTodayLocalISODate } from '@/lib/date'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { buildFoodDisplayName } from '@/lib/foodDisplay'

function todayDate() {
  return getTodayLocalISODate()
}

function timeStrFromISO(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}


type InputMode = 'photo' | 'text'
type MacroTargets = { protein: number; carbs: number; fat: number }

const DEFAULT_MACRO_TARGETS: MacroTargets = { protein: 118, carbs: 375, fat: 73 }

function getLegacyMacroTargets(): MacroTargets {
  const numberOrDefault = (value: unknown, fallback: number) => (
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
  )

  try {
    const stored = JSON.parse(localStorage.getItem('macro_targets') ?? '{}') as Partial<MacroTargets>
    return {
      protein: numberOrDefault(stored.protein, DEFAULT_MACRO_TARGETS.protein),
      carbs:   numberOrDefault(stored.carbs,   DEFAULT_MACRO_TARGETS.carbs),
      fat:     numberOrDefault(stored.fat,     DEFAULT_MACRO_TARGETS.fat),
    }
  } catch {
    return { ...DEFAULT_MACRO_TARGETS }
  }
}

export function CalorieTracker() {
  const { t, lang } = useLanguage()
  const [dailyFoods, setDailyFoods] = useState<DailyFood[]>([])
  const [selectedDate, setSelectedDate] = useState(todayDate())
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState<InputMode>('photo')
  const [saving, setSaving] = useState(false)

  const { goal: calorieGoal, saveGoal: dbSaveGoal } = useCalorieGoal()
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')

  const [macroTargets, setMacroTargets] = useState<MacroTargets>(DEFAULT_MACRO_TARGETS)
  const [editingMacro, setEditingMacro] = useState<'protein' | 'carbs' | 'fat' | null>(null)
  const [macroDraft, setMacroDraft] = useState('')

  const fetchMacroTargets = useCallback(async () => {
    const client = getSupabaseBrowserClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return

    const { data, error } = await client
      .from('daily_macro_targets')
      .select('protein_g, carbs_g, fat_g')
      .eq('user_id', user.id)
      .lte('date', selectedDate)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching macro targets:', error)
      return
    }

    if (data) {
      setMacroTargets({ protein: Number(data.protein_g), carbs: Number(data.carbs_g), fat: Number(data.fat_g) })
      return
    }

    if (selectedDate === todayDate()) {
      const legacyTargets = getLegacyMacroTargets()
      const { error: migrateError } = await client
        .from('daily_macro_targets')
        .upsert({
          user_id: user.id,
          date: selectedDate,
          protein_g: legacyTargets.protein,
          carbs_g: legacyTargets.carbs,
          fat_g: legacyTargets.fat,
        }, { onConflict: 'user_id,date' })

      if (!migrateError) localStorage.removeItem('macro_targets')
      setMacroTargets(legacyTargets)
      return
    }

    setMacroTargets(DEFAULT_MACRO_TARGETS)
  }, [selectedDate])

  async function saveMacroTarget(key: 'protein' | 'carbs' | 'fat') {
    const val = parseInt(macroDraft, 10)
    if (!isNaN(val) && val > 0) {
      const next = { ...macroTargets, [key]: val }
      setMacroTargets(next)
      const client = getSupabaseBrowserClient()
      const { data: { user } } = await client.auth.getUser()
      if (!user) return
      const { error } = await client
        .from('daily_macro_targets')
        .upsert({
          user_id: user.id,
          date: selectedDate,
          protein_g: next.protein,
          carbs_g: next.carbs,
          fat_g: next.fat,
        }, { onConflict: 'user_id,date' })
      if (error) {
        setMacroTargets(macroTargets)
        toast.error(t('calorieTracker.updateError'))
      }
    }
    setEditingMacro(null)
  }

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Partial<DailyFood> | null>(null)
  const [editingTime, setEditingTime] = useState('')
  const [previewImage, setPreviewImage] = useState<string | null>(null)

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
    void fetchDailyFoods()
  }, [fetchDailyFoods])

  function saveGoal() {
    const val = parseInt(goalDraft, 10)
    if (!isNaN(val) && val > 0) void dbSaveGoal(val)
    setEditingGoal(false)
  }

  useEffect(() => {
    if (!previewImage) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewImage])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMacroTargets()
  }, [fetchMacroTargets])

  function trackNormalizationEdit(food: DailyFood, nextCalories: number | null | undefined) {
    if (!food.normalized_by_internal_table) return
    if (typeof nextCalories !== 'number') return
    if (nextCalories === food.total_calories) return

    void fetch('/api/notes/nutrition-telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'manual_calorie_edit_after_normalization',
        normalized_table_key: food.normalized_table_key,
        normalized_source: food.normalized_source,
        normalization_version: food.normalization_version,
        previous_calories: food.total_calories,
        updated_calories: nextCalories,
      }),
    })
  }

  async function deleteFood(id: string) {
    try {
      const food = dailyFoods.find((f) => f.id === id)
      const { error } = await supabase.from('daily_foods').delete().eq('id', id)
      if (error) throw error
      // Clean up storage thumbnail after the row is gone (fire-and-forget, non-critical).
      if (food?.image_thumb?.startsWith('https://')) void deleteFoodThumb(food.image_thumb)
      await fetchDailyFoods()
      toast.success(t('calorieTracker.deleted'))
    } catch {
      toast.error(t('calorieTracker.deleteError'))
    }
  }

  function startEdit(food: DailyFood) {
    setEditingId(food.id)
    setEditingData({
      ...food,
      custom_food_name: food.custom_food_name ?? '',
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
      trackNormalizationEdit(food, editingData.total_calories ?? null)
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
            <div className="space-y-2 pt-1">
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide" title={t('calorieTracker.macroTargetHint')}>
                {t('calorieTracker.macroTargets')}
              </p>
              {([
                ['protein', t('calorieTracker.proteinTarget'), macroTotals.protein, 'bg-blue-400'],
                ['carbs',   t('calorieTracker.carbsTarget'),   macroTotals.carbs,   'bg-amber-400'],
                ['fat',     t('calorieTracker.fatTarget'),     macroTotals.fat,     'bg-rose-400'],
              ] as const).map(([key, label, actual, barColor]) => {
                const target = macroTargets[key]
                const pct = Math.min(Math.round((actual / target) * 100), 100)
                const over = actual > target
                const reached = actual >= target
                return (
                  <div key={key} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600">{label}</span>
                      <span className={`tabular-nums font-medium ${reached ? 'text-emerald-600' : 'text-zinc-500'}`}>
                        {actual}
                        {' / '}
                        {editingMacro === key ? (
                          <input
                            type="number"
                            value={macroDraft}
                            onChange={(e) => setMacroDraft(e.target.value)}
                            onBlur={() => saveMacroTarget(key)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveMacroTarget(key)
                              if (e.key === 'Escape') setEditingMacro(null)
                            }}
                            autoFocus
                            className="w-14 rounded border border-emerald-300 px-1 py-0.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setMacroDraft(String(target)); setEditingMacro(key) }}
                            className="underline decoration-dashed underline-offset-2 hover:text-emerald-600 transition-colors"
                            title={t('calorieTracker.macroTargetHint')}
                          >
                            {target}
                          </button>
                        )}
                        {' '}g
                        {reached && !over && <span className="ml-1 text-emerald-500">✓</span>}
                        {over && <span className="ml-1 text-amber-500">+{Math.round(actual - target)}g</span>}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full transition-all ${over ? 'bg-amber-400' : barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Food Form */}
      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <div className="mb-3 flex gap-2">
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
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              mode === 'text'
                ? 'bg-emerald-500 text-white'
                : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('calorieTracker.describe')}
          </button>
        </div>

        {mode === 'photo' ? (
          <FoodPhotoAnalyzer key="photo" date={selectedDate} onAdded={fetchDailyFoods} />
        ) : (
          <FoodPhotoAnalyzer key="text" date={selectedDate} onAdded={fetchDailyFoods} inputMode="text" />
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
                      <input
                        type="text"
                        value={editingData?.notes ?? ''}
                        onChange={(e) => setEditingData({ ...editingData, notes: e.target.value })}
                        className="rounded border border-emerald-300 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder={t('calorieTracker.editPortionPlaceholder') || 'Quantity/portion (e.g., ~300g)'}
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
                    <div className="flex gap-2">
                      {food.image_thumb ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImage(food.image_thumb ?? null)}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="shrink-0 rounded-md border border-emerald-200 bg-white p-0.5 transition hover:border-emerald-400"
                          aria-label="Open food image"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={food.image_thumb}
                            alt={food.custom_food_name || 'Food thumbnail'}
                            className="h-14 w-14 rounded object-cover"
                          />
                        </button>
                      ) : null}
                      <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-zinc-900 leading-snug">
                            {buildFoodDisplayName(food.custom_food_name, food.notes)}
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
                            {new Date(food.created_at).toLocaleTimeString(getIntlLocale(lang), { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {food.normalized_by_internal_table ? (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                              {t('foodPhoto.internalTableBadge')}
                            </span>
                          ) : null}
                          <p className="text-xs text-zinc-500">
                            {Math.round(food.total_calories * 10) / 10} kcal
                          </p>
                          {(food.protein_g || food.carbs_g || food.fat_g) ? (
                            <p className="text-[11px] tabular-nums text-zinc-400">
                              P {food.protein_g ?? 0}g · C {food.carbs_g ?? 0}g · F {food.fat_g ?? 0}g
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Food image preview"
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-zinc-700 shadow hover:bg-zinc-100"
              aria-label={t('common.cancel')}
            >
              <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Food image preview"
              className="max-h-[90vh] max-w-[90vw] rounded-lg border border-white/40 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
