'use client'

import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { WeightLog } from '@/types'
import { ConfirmModal } from '@/components/ui/confirm-modal'

const TARGET_WEIGHT = 75
const START_WEIGHT = 61

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })
    .format(new Date(y, m - 1, d))
}

// Simple SVG line chart for last 30 entries
function WeightChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length < 2) return null

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  const weights = sorted.map((l) => l.weight)
  const minW = Math.min(...weights, START_WEIGHT) - 1
  const maxW = Math.max(...weights, TARGET_WEIGHT) + 1

  const W = 600
  const H = 160
  const PAD = { top: 10, right: 10, bottom: 20, left: 30 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const xOf = (i: number) => PAD.left + (i / (sorted.length - 1)) * chartW
  const yOf = (w: number) => PAD.top + ((maxW - w) / (maxW - minW)) * chartH

  const linePath = sorted
    .map((l, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(l.weight).toFixed(1)}`)
    .join(' ')

  const targetY = yOf(TARGET_WEIGHT).toFixed(1)
  const startY = yOf(START_WEIGHT).toFixed(1)

  return (
    <div className="mt-4 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px]" style={{ height: H }}>
        {/* Target line */}
        <line x1={PAD.left} y1={targetY} x2={W - PAD.right} y2={targetY}
          stroke="#10b981" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - PAD.right - 2} y={Number(targetY) - 4} textAnchor="end"
          fontSize="10" fill="#10b981">{TARGET_WEIGHT}kg</text>

        {/* Start line */}
        <line x1={PAD.left} y1={startY} x2={W - PAD.right} y2={startY}
          stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - PAD.right - 2} y={Number(startY) - 4} textAnchor="end"
          fontSize="10" fill="#94a3b8">{START_WEIGHT}kg</text>

        {/* Weight line */}
        <path d={linePath} fill="none" stroke="#a05b35" strokeWidth="2" strokeLinejoin="round" />

        {/* Dots */}
        {sorted.map((l, i) => (
          <circle key={l.id} cx={xOf(i)} cy={yOf(l.weight)} r="3"
            fill="#a05b35" />
        ))}

        {/* Last value label */}
        {(() => {
          const last = sorted[sorted.length - 1]
          const x = xOf(sorted.length - 1)
          const y = yOf(last.weight)
          return (
            <text x={x} y={y - 7} textAnchor="middle" fontSize="11" fontWeight="600" fill="#7c3d1e">
              {last.weight}kg
            </text>
          )
        })()}
      </svg>
    </div>
  )
}

export function WeightTracker() {
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayDate())
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [])

  async function fetchLogs() {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(60)
    setLogs(data || [])
    setLoading(false)
  }

  function startEdit(log: WeightLog) {
    setEditingId(log.id)
    setDate(log.date)
    setWeight(String(log.weight))
    setNotes(log.notes || '')
  }

  function resetForm() {
    setEditingId(null)
    setDate(todayDate())
    setWeight('')
    setNotes('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const w = parseFloat(weight)
    if (isNaN(w) || w <= 0) { toast.error('Cân nặng không hợp lệ'); return }
    setSaving(true)

    if (editingId) {
      const { error } = await supabase
        .from('weight_logs')
        .update({ date, weight: w, notes: notes || null })
        .eq('id', editingId)
      if (error) { toast.error('Lưu thất bại'); setSaving(false); return }
      toast.success('Đã cập nhật')
    } else {
      const { error } = await supabase
        .from('weight_logs')
        .upsert({ date, weight: w, notes: notes || null }, { onConflict: 'date' })
      if (error) { toast.error('Lưu thất bại'); setSaving(false); return }
      toast.success('Đã lưu')
    }

    await fetchLogs()
    resetForm()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('weight_logs').delete().eq('id', id)
    if (error) { toast.error('Xóa thất bại'); return }
    toast.success('Đã xóa')
    setLogs((prev) => prev.filter((l) => l.id !== id))
  }

  const latest = logs[0]
  const gained = latest ? (latest.weight - START_WEIGHT).toFixed(1) : null
  const remaining = latest ? (TARGET_WEIGHT - latest.weight).toFixed(1) : null
  const progressPct = latest
    ? Math.min(100, ((latest.weight - START_WEIGHT) / (TARGET_WEIGHT - START_WEIGHT)) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Summary card */}
      {latest && (
        <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs text-zinc-500">Hiện tại</p>
              <p className="text-3xl font-bold text-zinc-900">{latest.weight} <span className="text-lg font-normal text-zinc-500">kg</span></p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Đã tăng</p>
              <p className="text-xl font-semibold text-emerald-600">+{gained} kg</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Còn thiếu</p>
              <p className="text-xl font-semibold text-amber-600">{remaining} kg</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>{START_WEIGHT}kg</span>
              <span>Mục tiêu: {TARGET_WEIGHT}kg</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-200">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-zinc-500">{progressPct.toFixed(0)}%</p>
          </div>
          <WeightChart logs={logs} />
        </div>
      )}

      {/* Form */}
      <div className="rounded-2xl border border-emerald-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700">
          {editingId ? 'Sửa cân nặng' : 'Ghi cân nặng hôm nay'}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Ngày</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Cân nặng (kg)</label>
            <input
              type="number"
              step="0.1"
              min="30"
              max="200"
              placeholder="62.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-28 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400"
              required
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-32">
            <label className="text-xs text-zinc-500">Ghi chú</label>
            <input
              type="text"
              placeholder="Sau ăn sáng..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {editingId ? 'Cập nhật' : 'Lưu'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
              Hủy
            </button>
          )}
        </form>
      </div>

      {/* History */}
      <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden">
        <div className="border-b border-emerald-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Lịch sử</p>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-zinc-400">Đang tải...</p>
        ) : logs.length === 0 ? (
          <p className="p-4 text-sm text-zinc-400">Chưa có dữ liệu. Hãy ghi cân nặng đầu tiên!</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-semibold text-zinc-800">{log.weight} kg</span>
                  <span className="ml-2 text-xs text-zinc-400">{formatDate(log.date)}</span>
                  {log.notes && <span className="ml-2 text-xs text-zinc-400">· {log.notes}</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(log)}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(log.id)}
                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteId}
        title="Xóa bản ghi cân nặng?"
        description="Hành động này không thể hoàn tác."
        onConfirm={() => { if (deleteId) { handleDelete(deleteId); setDeleteId(null) } }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
