'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, Coffee, X } from 'lucide-react'
import { Button } from './button'
import { UpgradeModal } from '@/components/UpgradeModal'
import { useUser } from '@/hooks/useUser'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export interface AITrialExhaustedInfo {
  feature: string
  used: number
  limit: number
}

interface Props {
  open: boolean
  info: AITrialExhaustedInfo | null
  onClose: () => void
}

const FEATURE_LABELS: Record<string, string> = {
  notes_analyze: 'phân tích sức khỏe AI',
  food_analyze: 'phân tích dinh dưỡng AI',
  stock_analyze: 'phân tích cổ phiếu AI',
  stock_suggestions: 'gợi ý cổ phiếu AI',
}

export function AITrialExhaustedModal({ open, info, onClose }: Props) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  // hasPending = pending request AND a prior rejection (first-time pending is bypassed and never reaches this modal)
  const [hasPending, setHasPending] = useState(false)
  const { user } = useUser()
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (!open || !info) return
    notifiedRef.current = false
    setHasPending(false)

    async function checkPending() {
      const client = getSupabaseBrowserClient()
      const { data: { user: authUser } } = await client.auth.getUser()
      if (!authUser) return

      const { data: requests } = await client
        .from('upgrade_requests')
        .select('status')
        .eq('user_id', authUser.id)
        .in('status', ['pending', 'rejected'])
      const statuses = (requests ?? []).map((r: { status: string }) => r.status)
      const hasPendingReq = statuses.includes('pending')
      const hasRejected = statuses.includes('rejected')

      // Show "waiting" state only when pending AND has a prior rejection
      if (hasPendingReq && hasRejected) {
        setHasPending(true)
        if (!notifiedRef.current) {
          notifiedRef.current = true
          fetch('/api/upgrade/pending-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feature: info?.feature }),
          }).catch(() => {})
        }
      }
    }

    void checkPending()
  }, [open, info])

  if (!open || !info) return null

  const featureLabel = FEATURE_LABELS[info.feature] ?? 'tính năng AI'

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] dark:bg-zinc-900 dark:border-zinc-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${hasPending ? 'bg-violet-100 dark:bg-violet-900/40' : 'bg-amber-100 dark:bg-amber-900/40'}`}>
                {hasPending
                  ? <Clock className="h-4 w-4 text-violet-600" />
                  : <Coffee className="h-4 w-4 text-amber-600" />
                }
              </div>
              <p className="font-poppins text-sm font-semibold text-zinc-900 dark:text-white">
                {hasPending ? 'Yêu cầu đang chờ xét duyệt' : 'Đã dùng hết lượt thử'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 sm:h-7 sm:w-7"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-3">
            {/* Usage pill */}
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-800 px-4 py-3">
              <span className="text-sm text-zinc-600 dark:text-zinc-300 capitalize">{featureLabel}</span>
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {info.used}/{info.limit} lượt
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-1.5 rounded-full transition-all ${hasPending ? 'bg-violet-400' : 'bg-amber-400'}`}
                style={{ width: '100%' }}
              />
            </div>

            {hasPending ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
                Yêu cầu nâng cấp của bạn đang được xem xét ⏳<br />
                Mình sẽ kích hoạt Pro cho bạn <span className="font-medium text-violet-600">trong vài giờ</span>. Cảm ơn bạn đã ủng hộ! 🙏
              </p>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
                Bạn đã dùng hết {info.limit} lượt thử miễn phí 🎉<br />
                Mua cho mình <span className="font-medium text-amber-600">một ly cà phê</span> (~30k) để mình tiếp tục duy trì AI cho bạn nhé ☕
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 border-t border-zinc-100 dark:border-zinc-800 px-5 py-4">
            {hasPending ? (
              <Button
                className="flex-1 bg-violet-500 hover:bg-violet-600 text-white border-0"
                onClick={onClose}
              >
                <Clock className="h-4 w-4 mr-1.5" />
                Đã hiểu, chờ kích hoạt
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="flex-1 border border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={onClose}
                >
                  Để sau
                </Button>
                <Button
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white border-0"
                  onClick={() => setShowUpgrade(true)}
                >
                  <Coffee className="h-4 w-4 mr-1.5" />
                  Ủng hộ ngay
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {!hasPending && (
        <UpgradeModal
          open={showUpgrade}
          onClose={() => { setShowUpgrade(false); onClose() }}
          userEmail={user?.email ?? ''}
        />
      )}
    </>
  )
}
