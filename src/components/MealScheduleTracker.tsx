'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, CheckCircle2, Circle, Plus, Trash2, X, Edit2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Meal } from '@/types'
import { Button } from '@/components/ui/button'

const DAILY_CALORIE_GOAL = 2400

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

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

export function MealScheduleTracker() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [selectedDate, setSelectedDate] = useState(todayDate())
  const [loading, setLoading] = useState(true)
  const isSettingUpRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ time: '', name: '', target_calories: '', foods: '' })

  async function fetchMeals() {
    try {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('date', selectedDate)
        .order('time', { ascending: true })

      if (error) throw error

      // Deduplicate by meal_type, keep the first occurrence
      const seen = new Set<string>()
      const deduped = (data || []).filter((m) => {
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
      toast.error('Không thể tải danh sách bữa ăn.')
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
      const mealsToInsert = DEFAULT_MEALS.map((meal, idx) => ({
        date: selectedDate,
        meal_type: ['breakfast', 'mid_morning', 'lunch', 'afternoon', 'dinner'][idx],
        time: meal.time,
        name: meal.name,
        target_calories: meal.target_calories,
        foods: meal.foods,
        is_completed: false,
      }))

      const { error } = await supabase.from('meals').insert(mealsToInsert)
      if (error) throw error

      // Fetch the newly created meals
      const { data: newData } = await supabase
        .from('meals')
        .select('*')
        .eq('date', selectedDate)
        .order('time', { ascending: true })

      setMeals((newData || []) as Meal[])
      setLoading(false)
    } catch (error) {
      console.error('Error setting up meals:', error)
      toast.error('Không thể tạo lịch ăn.')
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
      toast.success(meal.is_completed ? 'Bỏ đánh dấu bữa ăn.' : 'Ăn xong! 🎉')
    } catch {
      toast.error('Không thể cập nhật.')
    }
  }

  async function deleteMeal(id: string) {
    try {
      const { error } = await supabase.from('meals').delete().eq('id', id)
      if (error) throw error
      setMeals((prev) => prev.filter((m) => m.id !== id))
      toast.success('Đã xoá bữa ăn.')
    } catch {
      toast.error('Không thể xoá.')
    }
  }

  function startEdit(meal: Meal) {
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
      toast.error('Vui lòng điền đầy đủ thông tin.')
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
      toast.success('Đã cập nhật bữa ăn.')
    } catch {
      toast.error('Không thể cập nhật.')
    }
  }

  const totalCalories = meals.reduce((sum, m) => sum + m.target_calories, 0)
  const completedCount = meals.filter((m) => m.is_completed).length
  const completedCalories = meals
    .filter((m) => m.is_completed)
    .reduce((sum, m) => sum + m.target_calories, 0)
  const completionPercent = meals.length > 0 ? Math.round((completedCount / meals.length) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white p-3 sm:p-4">
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-semibold text-zinc-900">Lịch Ăn Hôm Nay ({selectedDate})</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-emerald-200 bg-white px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm text-zinc-900"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-zinc-600">Calo ăn vào</span>
            <span className="font-semibold text-zinc-900">{Math.round(completedCalories)} / {totalCalories} kcal</span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-zinc-600">Hoàn thành</span>
            <span className="font-semibold text-zinc-900">{completedCount} / {meals.length} bữa</span>
          </div>

          {/* Progress Bar */}
          <div className="h-2.5 sm:h-3 overflow-hidden rounded-full border border-emerald-200 bg-emerald-100 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
              style={{ width: `${Math.min(completionPercent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{completionPercent}% hoàn thành</span>
            {totalCalories > 0 && (
              <span className="text-emerald-600 font-medium">
                {totalCalories - completedCalories > 0
                  ? `Còn ${totalCalories - completedCalories} kcal`
                  : 'Đạt mục tiêu! 🎉'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Meals List */}
      <div className="rounded-xl border border-emerald-200 bg-white p-3 sm:p-4">
        <div className="mb-3">
          <h3 className="font-semibold text-zinc-900">Danh sách bữa ăn</h3>
        </div>

        {loading ? (
          <p className="text-xs text-zinc-400">Đang tải...</p>
        ) : meals.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">Chưa có bữa ăn nào.</p>
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
                        placeholder="Tên bữa ăn"
                      />
                      <input
                        type="number"
                        value={editForm.target_calories}
                        onChange={(e) => setEditForm((f) => ({ ...f, target_calories: e.target.value }))}
                        className="rounded border border-emerald-300 px-2 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder="kcal"
                      />
                    </div>
                    <textarea
                      value={editForm.foods}
                      onChange={(e) => setEditForm((f) => ({ ...f, foods: e.target.value }))}
                      rows={Math.max(meal.foods.length, 2) + 1}
                      className="w-full rounded border border-emerald-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
                      placeholder="Mỗi dòng một món ăn..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" /> Hủy
                      </button>
                      <button
                        onClick={() => saveEdit(meal.id)}
                        className="flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-600 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" /> Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                    <button
                      onClick={() => toggleMealComplete(meal)}
                      className="shrink-0 mt-0.5"
                    >
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
                          <p key={idx} className="text-xs text-zinc-600">
                            • {food}
                          </p>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => deleteMeal(meal.id)}
                      className="shrink-0 rounded p-1 text-zinc-300 opacity-60 hover:text-rose-600 hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
