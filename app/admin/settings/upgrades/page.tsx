'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, X, CreditCard, Loader2, RefreshCw } from 'lucide-react'
import { getPlan } from '@/lib/payment-config'

interface UpgradeRequest {
  id: string
  user_id: string
  email: string
  plan_id: string
  amount: number
  duration_months: number
  transfer_note: string
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
}

const STATUS_STYLE = {
  pending:  'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-green-50 text-green-700 border border-green-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
}

const STATUS_LABEL = {
  pending:  'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
}

export default function UpgradesPage() {
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/upgrade-requests?status=${filter}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRequests(data.requests ?? [])
    } catch {
      toast.error('Không thể tải danh sách')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setBusy(id)
    try {
      const res = await fetch('/api/admin/upgrade-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(action === 'approve' ? 'Đã duyệt — tài khoản đã được nâng cấp' : 'Đã từ chối')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-amber-500" />
          <h1 className="text-lg font-semibold text-zinc-900">Yêu cầu nâng cấp</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-sm">
            {(['pending', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 ${filter === f ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}
              >
                {f === 'pending' ? 'Chờ duyệt' : 'Tất cả'}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
          <CreditCard className="h-10 w-10 opacity-30" />
          <p className="text-sm">Không có yêu cầu nào</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Gói</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Nội dung CK</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Ngày</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {requests.map((req) => {
                const plan = getPlan(req.plan_id)
                return (
                  <tr key={req.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-zinc-800 max-w-[180px] truncate">{req.email}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{plan?.label ?? req.plan_id}</div>
                      <div className="text-xs text-zinc-400">{plan?.priceLabel ?? `${req.amount.toLocaleString()}đ`}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 max-w-[160px] truncate">{req.transfer_note}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[req.status]}`}>
                        {STATUS_LABEL[req.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {req.status === 'pending' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleAction(req.id, 'approve')}
                            disabled={busy === req.id}
                            className="flex items-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs px-2.5 py-1.5 font-medium disabled:opacity-50 transition-colors"
                          >
                            {busy === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Duyệt
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'reject')}
                            disabled={busy === req.id}
                            className="flex items-center gap-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 text-xs px-2.5 py-1.5 font-medium disabled:opacity-50 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                            Từ chối
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
