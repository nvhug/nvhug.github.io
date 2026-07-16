'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { FoodTemplate, DailyFood } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const DAILY_CALORIE_GOAL = 2400

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export function CalorieTracker() {
  const [foodTemplates, setFoodTemplates] = useState<FoodTemplate[]>([])
  const [dailyFoods, setDailyFoods] = useState<DailyFood[]>([])
  const [selectedDate, setSelectedDate] = useState(todayDate())
  const [loading, setLoading] = useState(true)

  // Form state
  const [selectedFoodId, setSelectedFoodId] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('1')
  const [customFoodName, setCustomFoodName] = useState<string>('')
  const [customCalories, setCustomCalories] = useState<string>('')
  const [useCustom, setUseCustom] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Partial<DailyFood> | null>(null)

  async function fetchFoodTemplates() {
    try {
      const { data, error } = await supabase
        .from('food_templates')
        .select('*')
        .order('category')

      if (error) throw error
      setFoodTemplates((data || []) as FoodTemplate[])
    } catch (error) {
      console.error('Error fetching food templates:', error)
      toast.error('Không thể tải danh sách thực phẩm.')
    }
  }

  async function fetchDailyFoods() {
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
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchFoodTemplates()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void fetchDailyFoods()
  }, [selectedDate])

  async function addFood() {
    if (useCustom) {
      if (!customFoodName.trim() || !customCalories.trim()) {
        toast.error('Vui lòng nhập tên thực phẩm và calo.')
        return
      }
    } else {
      if (!selectedFoodId || !quantity) {
        toast.error('Vui lòng chọn thực phẩm và số lượng.')
        return
      }
    }

    setSaving(true)
    try {
      const food = useCustom
        ? {
            date: selectedDate,
            custom_food_name: customFoodName.trim(),
            quantity: 1,
            total_calories: Number(customCalories) || 0,
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
            }
          })()

      const { error } = await supabase.from('daily_foods').insert([food])
      if (error) throw error

      await fetchDailyFoods()
      setSelectedFoodId('')
      setQuantity('1')
      setCustomFoodName('')
      setCustomCalories('')
      setUseCustom(false)
      toast.success('Thêm thực phẩm thành công.')
    } catch {
      toast.error('Không thể thêm thực phẩm.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteFood(id: string) {
    try {
      const { error } = await supabase.from('daily_foods').delete().eq('id', id)
      if (error) throw error
      await fetchDailyFoods()
      toast.success('Đã xoá.')
    } catch {
      toast.error('Không thể xoá.')
    }
  }

  function startEdit(food: DailyFood) {
    const template = foodTemplates.find((f) => f.id === food.food_template_id)
    setEditingId(food.id)
    setEditingData({
      ...food,
      custom_food_name: food.custom_food_name ?? template?.name ?? '',
    })
  }

  async function updateFood(food: DailyFood) {
    if (!editingData) return

    setSaving(true)
    try {
      const { error } = await supabase.from('daily_foods').update({
        custom_food_name: editingData.custom_food_name,
        total_calories: editingData.total_calories,
        quantity: editingData.quantity,
        notes: editingData.notes,
      }).eq('id', food.id)

      if (error) throw error
      await fetchDailyFoods()
      setEditingId(null)
      setEditingData(null)
      toast.success('Cập nhật thành công.')
    } catch {
      toast.error('Không thể cập nhật.')
    } finally {
      setSaving(false)
    }
  }

  const totalCalories = dailyFoods.reduce((sum, food) => sum + (food.total_calories || 0), 0)
  const progressPercent = Math.round((totalCalories / DAILY_CALORIE_GOAL) * 100)
  const remainingCalories = DAILY_CALORIE_GOAL - totalCalories

  const selectedTemplate = foodTemplates.find((f) => f.id === selectedFoodId)
  const previewCalories = selectedTemplate && selectedFoodId && !useCustom
    ? Math.round(selectedTemplate.calories_per_unit * (Number(quantity) || 1) * 10) / 10
    : 0

  return (
    <div className="space-y-4">
      {/* Calorie Summary */}
      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Calo hôm nay ({selectedDate})</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-1 text-sm text-zinc-900"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">Tổng calo</span>
            <span className="font-semibold text-zinc-900">{Math.round(totalCalories)} / {DAILY_CALORIE_GOAL} kcal</span>
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
              <span className="text-emerald-600">Còn {Math.round(remainingCalories)} kcal</span>
            ) : (
              <span className="text-amber-600">Vượt {Math.round(Math.abs(remainingCalories))} kcal</span>
            )}
          </div>
        </div>
      </div>

      {/* Add Food Form */}
      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setUseCustom(false)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              !useCustom
                ? 'bg-emerald-500 text-white'
                : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Danh sách
          </button>
          <button
            type="button"
            onClick={() => setUseCustom(true)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              useCustom
                ? 'bg-emerald-500 text-white'
                : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Tùy chỉnh
          </button>
        </div>

        {useCustom ? (
          <div className="space-y-2">
            <input
              type="text"
              value={customFoodName}
              onChange={(e) => setCustomFoodName(e.target.value)}
              placeholder="Tên thực phẩm (ví dụ: bánh mì nướng)"
              className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-400"
            />
            <input
              type="number"
              value={customCalories}
              onChange={(e) => setCustomCalories(e.target.value)}
              placeholder="Calo"
              className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={addFood}
              disabled={saving || !customFoodName.trim() || !customCalories.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <select
              value={selectedFoodId}
              onChange={(e) => setSelectedFoodId(e.target.value)}
              className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-400"
            >
              <option value="">Chọn thực phẩm...</option>
              {foodTemplates.map((food) => (
                <option key={food.id} value={food.id}>
                  {food.name} ({food.calories_per_unit} kcal/{food.unit})
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Số lượng"
                min="0.1"
                step="0.1"
                className="w-24 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-400"
              />
              <span className="flex items-center text-sm text-zinc-600">
                {selectedTemplate?.unit}
              </span>
              {previewCalories > 0 && (
                <span className="flex items-center text-sm font-medium text-emerald-600">
                  = {previewCalories} kcal
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={addFood}
              disabled={saving || !selectedFoodId || !quantity}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm
            </button>
          </div>
        )}
      </div>

      {/* Daily Foods List */}
      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-zinc-900">Danh sách thực phẩm trong ngày</h3>

        {loading ? (
          <p className="text-xs text-zinc-400">Đang tải...</p>
        ) : dailyFoods.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">Chưa có thực phẩm nào.</p>
        ) : (
          <div className="space-y-2">
            {dailyFoods.map((food) => {
              const template = foodTemplates.find((f) => f.id === food.food_template_id)
              const isEditing = editingId === food.id

              return (
                <div
                  key={food.id}
                  onDoubleClick={() => !isEditing && startEdit(food)}
                  className={`rounded-lg border p-3 transition-all cursor-pointer select-none ${
                    isEditing
                      ? 'border-emerald-400 bg-emerald-50 shadow-md ring-1 ring-emerald-300'
                      : 'border-emerald-100 bg-emerald-50 hover:shadow-sm'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editingData?.custom_food_name ?? ''}
                        onChange={(e) => setEditingData({ ...editingData, custom_food_name: e.target.value })}
                        className="rounded border border-emerald-300 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        placeholder="Tên thực phẩm"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editingData?.total_calories ?? 0}
                          onChange={(e) => setEditingData({ ...editingData, total_calories: Number(e.target.value) || 0 })}
                          className="w-24 rounded border border-emerald-300 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          min="0"
                          step="1"
                        />
                        <span className="text-xs text-zinc-600">kcal</span>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => { setEditingId(null); setEditingData(null) }}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-white transition-colors"
                          >
                            <X className="h-3.5 w-3.5" /> Hủy
                          </button>
                          <button
                            onClick={() => updateFood(food)}
                            disabled={saving}
                            className="flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Lưu
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-sm">
                        <p className="font-medium text-zinc-900">
                          {food.custom_food_name || template?.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {template && !food.custom_food_name ? `${food.quantity} ${template.unit} • ` : ''}{Math.round(food.total_calories * 10) / 10} kcal
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(food)}
                          className="rounded-md text-zinc-400 hover:bg-emerald-100 hover:text-emerald-600 p-1"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteFood(food.id)}
                          className="rounded-md text-zinc-300 hover:bg-rose-100 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
