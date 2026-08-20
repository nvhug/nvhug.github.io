'use client'

import { useState, useEffect } from 'react'
import { X, Check, Copy, Coffee, Loader2 } from 'lucide-react'
import { PLANS, Plan, buildTransferNote, buildVietQRUrl, getPaymentConfig, isPaymentConfigured } from '@/lib/payment-config'

interface Props {
  open: boolean
  onClose: () => void
  userEmail: string
}

type Step = 'plan' | 'payment' | 'submitted'

const COFFEE_EQUIV: Record<string, string> = {
  '1m': '1 ly cà phê ☕',
  '6m': '1 ly trà sữa 🧋',
  '1y': '2 ly trà sữa 🧋🧋',
}

export function UpgradeModal({ open, onClose, userEmail }: Props) {
  const [step, setStep] = useState<Step>('plan')
  const [selectedPlan, setSelectedPlan] = useState<Plan>(PLANS[1])
  const [loading, setLoading] = useState(false)
  const [transferNote, setTransferNote] = useState('')
  const [copied, setCopied] = useState<'note' | 'account' | null>(null)
  const [qrError, setQrError] = useState(false)

  const payConfig = getPaymentConfig()
  const configured = isPaymentConfigured()

  useEffect(() => {
    if (open) {
      setStep('plan')
      setLoading(false)
      setTransferNote('')
      setQrError(false)
    }
  }, [open])

  if (!open) return null

  const note = buildTransferNote(userEmail, selectedPlan.id)
  const qrUrl = configured
    ? buildVietQRUrl(payConfig.bankId, payConfig.accountNo, payConfig.accountName, selectedPlan.price, note)
    : ''

  async function handleSelectPlan() {
    setLoading(true)
    try {
      const res = await fetch('/api/upgrade/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlan.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Lỗi gửi yêu cầu')
      setTransferNote(data.transferNote ?? note)
      setStep('payment')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string, key: 'note' | 'account') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-amber-500" />
            <span className="font-semibold text-zinc-900 dark:text-white">Ủng hộ &amp; mở khóa Pro</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>

        {/* Step 1 — Plan selection */}
        {step === 'plan' && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              AI phải trả phí API mỗi lần chạy — mua cho mình một ly để tiếp tục duy trì cho bạn nhé ☕
            </p>
            <div className="space-y-2">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan as Plan)}
                  className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    selectedPlan.id === plan.id
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-amber-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-zinc-900 dark:text-white">{plan.label}</span>
                      {plan.badge && (
                        <span className="rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                          {plan.badge}
                        </span>
                      )}
                      <span className="text-xs text-zinc-400">≈ {COFFEE_EQUIV[plan.id]}</span>
                    </div>
                    <span className="text-xs text-zinc-400">{plan.perMonth}</span>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-bold text-zinc-900 dark:text-white">{plan.priceLabel}</div>
                    {plan.savePct && (
                      <div className="text-xs text-green-600 dark:text-green-400">-{plan.savePct}%</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={handleSelectPlan}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-medium py-3 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coffee className="h-4 w-4" />}
              {loading ? 'Đang xử lý...' : 'Ủng hộ ngay'}
            </button>
            <p className="text-xs text-center text-zinc-400">
              Dùng không thích? Nhắn tin để được hoàn tiền trong 7 ngày 🙏
            </p>
          </div>
        )}

        {/* Step 2 — Payment */}
        {step === 'payment' && (
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 px-4 py-3">
              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                Chuyển khoản đúng nội dung — mình sẽ kích hoạt ngay trong ngày ✨
              </p>
            </div>

            {/* QR Code */}
            {configured && !qrError ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={qrUrl}
                  alt="VietQR"
                  className="w-52 h-52 rounded-xl border border-zinc-200 dark:border-zinc-700 object-contain bg-white"
                  onError={() => setQrError(true)}
                />
                <p className="text-xs text-zinc-400">Quét bằng app ngân hàng bất kỳ</p>
              </div>
            ) : (
              <div className="flex justify-center items-center h-40 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-sm text-zinc-400">
                Chuyển khoản theo thông tin bên dưới
              </div>
            )}

            {/* Bank info */}
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-700">
              <InfoRow label="Ngân hàng" value={payConfig.bankId || '—'} />
              <InfoRow
                label="Số tài khoản"
                value={payConfig.accountNo || '—'}
                onCopy={payConfig.accountNo ? () => copy(payConfig.accountNo, 'account') : undefined}
                copied={copied === 'account'}
              />
              <InfoRow label="Chủ tài khoản" value={payConfig.accountName || '—'} />
              <InfoRow label="Số tiền" value={selectedPlan.priceLabel} />
              <InfoRow
                label="Nội dung CK"
                value={transferNote || note}
                onCopy={() => copy(transferNote || note, 'note')}
                copied={copied === 'note'}
                highlight
              />
            </div>

            <p className="text-xs text-zinc-400 text-center">
              Nhập đúng nội dung chuyển khoản để mình xác nhận nhanh hơn 🙏
            </p>

            <button
              onClick={() => setStep('submitted')}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 transition-colors"
            >
              Tôi đã chuyển khoản xong ✓
            </button>
          </div>
        )}

        {/* Step 3 — Submitted */}
        {step === 'submitted' && (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="text-5xl">🎉</div>
            <div>
              <h3 className="font-semibold text-lg text-zinc-900 dark:text-white mb-2">
                Cảm ơn bạn rất nhiều!
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Mình sẽ kiểm tra và kích hoạt Pro cho bạn trong vài giờ. Cà phê/trà sữa hôm nay ngon lắm ☕🧋
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-700 px-6 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  onCopy,
  copied,
  highlight,
}: {
  label: string
  value: string
  onCopy?: () => void
  copied?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
      <span className="text-xs text-zinc-400 shrink-0">{label}</span>
      <span className={`text-sm font-medium truncate ${highlight ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
        {value}
      </span>
      {onCopy && (
        <button
          onClick={onCopy}
          className="shrink-0 rounded-lg p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          title="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
        </button>
      )}
    </div>
  )
}
