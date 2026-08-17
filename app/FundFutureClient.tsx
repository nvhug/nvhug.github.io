'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Landmark, Mail, Pencil, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, Users, WalletCards, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { DatePicker } from '@/components/ui/date-picker'
import { getTodayLocalISODate } from '@/lib/date'
import { buildTransactionDeleteAdjustments, buildTransactionDeltaMap } from '@/lib/fund-transaction-deltas'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatDigitInput, getAssetBreakdownEmptyText } from '@/lib/fund-ui'
import { supabase } from '@/lib/supabase'

type AssetType = 'gold' | 'cash' | 'bank' | 'other'
type DeleteTarget = { table: string; id: string } | null

type AssetSuggestion = {
  name: string
  type: AssetType
  detail: string
}

type FundAsset = {
  id: string
  name: string
  type: AssetType
  amount: number
  gold_chi?: number | null
  note: string | null
}

type FundTransaction = {
  id: string
  type: 'in' | 'out' | 'convert'
  amount: number
  who: string
  reason: string
  note: string | null
  date: string
  asset_id: string | null
  dest_asset_id: string | null
}

function getFundActorLabel(value: string) {
  return value.trim().toLowerCase() === 'nvhug001@gmail.com' ? 'Văn Hưng' : value
}

type FundDebt = {
  id: string
  debtor: string
  amount: number
  reason: string
  date: string
  is_settled: boolean
  note: string | null
  asset_id: string | null
}

type FundBorrowing = {
  id: string
  lender: string
  amount: number
  reason: string
  term: string | null
  date: string
  is_settled: boolean
}

type ShareStatus = 'pending' | 'accepted' | 'declined' | 'revoked'

type FundShare = {
  id: string
  owner_id: string
  owner_email: string
  member_id: string
  member_email: string
  status: ShareStatus
  created_at: string
}

type GoldPricePayload = {
  price24kPerChi: number
  priceRing9999PerChi: number
  updatedAt: string
}

type GoldPriceRow = {
  user_id: string
  price24k_per_chi: number
  price_ring9999_per_chi: number
  updated_at: string
}

type GoldPriceField = '24k' | 'ring9999'

const inputClass = 'h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-500'
const cardClass = 'rounded-2xl border border-emerald-100 bg-white shadow-[0_18px_36px_-30px_rgba(16,185,129,0.28)]'

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function shortLabel(n: number): string {
  if (n >= 1_000_000_000) return `${+(n / 1_000_000_000).toFixed(2)} tỷ`
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(2)} triệu`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(0)} nghìn`
  return `${n}`
}

function inferAssetTypeFromName(name: string, assets: FundAsset[]): AssetType {
  const normalized = normalizeSearchText(name.trim())
  if (!normalized) return 'other'

  const existing = assets.find((asset) => normalizeSearchText(asset.name) === normalized)
  if (existing) return existing.type

  if (normalized.includes('vang') || normalized.includes('gold') || normalized.includes('24k') || normalized.includes('sjc') || normalized.includes('nhan')) return 'gold'
  if (normalized.includes('tien mat') || normalized.includes('cash') || normalized.includes('vi')) return 'cash'
  if (normalized.includes('ngan hang') || normalized.includes('bank') || normalized.includes('tai khoan') || normalized.includes('tiet kiem') || normalized.includes('saving')) return 'bank'
  return 'other'
}

function inferGoldVariantFromName(name: string): '24k' | 'ring9999' {
  const normalized = normalizeSearchText(name.trim())
  return normalized.includes('nhan') || normalized.includes('ring') ? 'ring9999' : '24k'
}

function parseChiAmount(value: string): number {
  const normalized = value.replace(',', '.').trim()
  if (!/^\d+(\.\d+)?$/.test(normalized)) return Number.NaN
  return Number(normalized)
}

function formatChiAmount(value: number): string {
  if (!Number.isFinite(value)) return ''
  const nearestInt = Math.round(value)
  if (Math.abs(value - nearestInt) < 0.01) return String(nearestInt)
  return value.toFixed(4).replace(/\.?0+$/, '')
}

async function fetchLatestGoldPrice(): Promise<GoldPricePayload> {
  const res = await fetch('/api/gold-price', { cache: 'no-store' })
  const data = await res.json()
  if (
    !res.ok
    || typeof data?.price24kPerChi !== 'number'
    || typeof data?.priceRing9999PerChi !== 'number'
    || typeof data?.updatedAt !== 'string'
  ) {
    throw new Error('could_not_fetch_gold_price')
  }
  return {
    price24kPerChi: data.price24kPerChi,
    priceRing9999PerChi: data.priceRing9999PerChi,
    updatedAt: data.updatedAt,
  }
}

function AssetSuggest({ value, assets, vi, onChange, onSelect }: {
  value: string
  assets: FundAsset[]
  vi: boolean
  onChange: (value: string) => void
  onSelect: (suggestion: AssetSuggestion) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const commonSuggestions: AssetSuggestion[] = vi
    ? [
        { name: 'Tiền mặt', type: 'cash', detail: 'Tiền mặt' },
        { name: 'Vàng 24K', type: 'gold', detail: 'Vàng' },
        { name: 'Vàng nhẫn', type: 'gold', detail: 'Vàng' },
        { name: 'Tài khoản', type: 'bank', detail: 'Ngân hàng' },
        { name: 'Tiền gửi tiết kiệm', type: 'bank', detail: 'Ngân hàng' },
        { name: 'Quỹ dự phòng', type: 'other', detail: 'Khác' },
        { name: 'Chứng khoán', type: 'other', detail: 'Đầu tư' },
        { name: 'Quỹ đầu tư', type: 'other', detail: 'Đầu tư' },
      ]
    : [
        { name: 'Cash', type: 'cash', detail: 'Cash' },
        { name: '24K Gold', type: 'gold', detail: 'Gold' },
        { name: 'Gold ring', type: 'gold', detail: 'Gold' },
        { name: 'Bank account', type: 'bank', detail: 'Bank' },
        { name: 'Savings deposit', type: 'bank', detail: 'Bank' },
        { name: 'Emergency fund', type: 'other', detail: 'Other' },
        { name: 'Stocks', type: 'other', detail: 'Investment' },
        { name: 'Investment fund', type: 'other', detail: 'Investment' },
      ]
  const suggestions = [...commonSuggestions]

  assets.forEach((asset) => {
    if (!suggestions.some((item) => normalizeSearchText(item.name) === normalizeSearchText(asset.name))) {
      suggestions.push({ name: asset.name, type: asset.type, detail: vi ? 'Đã sử dụng' : 'Previously used' })
    }
  })

  const [showAll, setShowAll] = useState(false)
  const normalizedValue = normalizeSearchText(value.trim())
  const filtered = (showAll || !normalizedValue)
    ? suggestions
    : suggestions.filter((item) => normalizeSearchText(`${item.name} ${item.detail}`).includes(normalizedValue))

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        className={inputClass}
        value={value}
        onChange={(event) => { setShowAll(false); onChange(event.target.value); setOpen(true) }}
        onFocus={() => { setShowAll(true); setOpen(true) }}
        placeholder={vi ? 'Nhập hoặc chọn tài sản' : 'Enter or select an asset'}
        autoComplete="off"
        required
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {filtered.map((item) => (
            <button
              key={`${item.type}-${item.name}`}
              type="button"
              onClick={() => { onSelect(item); setOpen(false) }}
              className="flex w-full flex-col border-b border-zinc-50 px-3 py-2 text-left transition-colors last:border-0 hover:bg-emerald-50"
            >
              <span className="text-sm font-medium text-zinc-800">{item.name}</span>
              <span className="text-[11px] text-zinc-400">{item.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MoneyInput({ value, onChange, required, min = '0', placeholder = 'VD: 5 → 5,000,000', isGold = false, pricePerChi = 9_500_000 }: { value: string; onChange: (v: string) => void; required?: boolean; min?: string; placeholder?: string; isGold?: boolean; pricePerChi?: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const digits = value.replace(/\D/g, '')
  const displayValue = formatDigitInput(value)

  const suggestions = digits
    ? isGold
      ? [
          { key: 'chi', value: Number(digits) * pricePerChi, label: `${digits} chỉ` },
          { key: 'luong', value: Number(digits) * 10 * pricePerChi, label: `${digits} lượng (${Number(digits) * 10} chỉ)` },
        ]
      : [
          { key: '100k', value: Number(digits) * 100_000, label: shortLabel(Number(digits) * 100_000) },
          { key: '1m', value: Number(digits) * 1_000_000, label: shortLabel(Number(digits) * 1_000_000) },
          { key: '10m', value: Number(digits) * 10_000_000, label: shortLabel(Number(digits) * 10_000_000) },
        ].filter((item) => item.value >= Number(min || 0))
    : []

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        className={inputClass}
        type="text"
        inputMode="numeric"
        value={displayValue}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => { onChange(event.target.value.replace(/[^\d]/g, '')); setOpen(true) }}
        onFocus={() => { if (digits) setOpen(true) }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          {suggestions.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { onChange(String(item.value)); setOpen(false) }}
              className="flex w-full items-center justify-between border-b border-zinc-50 px-3 py-2 text-left transition-colors last:border-0 hover:bg-emerald-50"
            >
              <span className="text-sm font-medium text-zinc-800">
                {new Intl.NumberFormat('vi-VN').format(item.value)} đ
              </span>
              <span className="text-[11px] text-zinc-400">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" onClick={onEdit} aria-label="Edit" className="rounded-md p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-700 sm:p-1">
        <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      </button>
      <button type="button" onClick={onDelete} aria-label="Delete" className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 sm:p-1">
        <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      </button>
    </div>
  )
}

export default function FundFutureClient() {
  const { lang } = useLanguage()
  const vi = lang === 'vi'
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [userAccountLabel, setUserAccountLabel] = useState('')
  const [assets, setAssets] = useState<FundAsset[]>([])
  const [transactions, setTransactions] = useState<FundTransaction[]>([])
  const [debts, setDebts] = useState<FundDebt[]>([])
  const [borrowings, setBorrowings] = useState<FundBorrowing[]>([])
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [saving, setSaving] = useState(false)

  const [assetFormOpen, setAssetFormOpen] = useState(false)
  const [assetId, setAssetId] = useState<string | null>(null)
  const [assetName, setAssetName] = useState('')
  const [assetAmount, setAssetAmount] = useState('')
  const [assetNote, setAssetNote] = useState('')
  const [goldPrice24kPerChi, setGoldPrice24kPerChi] = useState(9_800_000)
  const [goldPriceRing9999PerChi, setGoldPriceRing9999PerChi] = useState(9_500_000)
  const [goldPriceLoading, setGoldPriceLoading] = useState(false)
  const [goldPriceUpdatedAt, setGoldPriceUpdatedAt] = useState<string | null>(null)
  const [editingGoldField, setEditingGoldField] = useState<GoldPriceField | null>(null)
  const [editingGoldValue, setEditingGoldValue] = useState('')

  const [transactionFormOpen, setTransactionFormOpen] = useState(false)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [transactionType, setTransactionType] = useState<'in' | 'out' | 'convert'>('in')
  const [transactionAmount, setTransactionAmount] = useState('')
  const [transactionReason, setTransactionReason] = useState('')
  const [transactionDate, setTransactionDate] = useState(getTodayLocalISODate)
  const [transactionConvertFromId, setTransactionConvertFromId] = useState('')
  const [transactionConvertToName, setTransactionConvertToName] = useState('')
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'in' | 'out' | 'convert'>('all')
  const [transactionActorFilter, setTransactionActorFilter] = useState('all')

  const [debtFormOpen, setDebtFormOpen] = useState(false)
  const [debtId, setDebtId] = useState<string | null>(null)
  const [debtor, setDebtor] = useState('')
  const [debtAmount, setDebtAmount] = useState('')
  const [debtReason, setDebtReason] = useState('')
  const [debtNote, setDebtNote] = useState('')
  const [debtDate, setDebtDate] = useState(getTodayLocalISODate)
  const [debtAssetId, setDebtAssetId] = useState('')

  const [borrowingFormOpen, setBorrowingFormOpen] = useState(false)
  const [borrowingId, setBorrowingId] = useState<string | null>(null)
  const [lender, setLender] = useState('')
  const [borrowingAmount, setBorrowingAmount] = useState('')
  const [borrowingReason, setBorrowingReason] = useState('')
  const [borrowingTerm, setBorrowingTerm] = useState('')
  const [borrowingDate, setBorrowingDate] = useState(getTodayLocalISODate)

  const [shares, setShares] = useState<FundShare[]>([])
  const [sharesLoaded, setSharesLoaded] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitingBusy, setInvitingBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string; email?: string | null; user_metadata?: { full_name?: string | null } } | null } }) => {
      setUserId(data.user?.id ?? null)
      setUserAccountLabel(getFundActorLabel(data.user?.user_metadata?.full_name?.trim() || data.user?.email || data.user?.id || ''))
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    void fetchShares()
  }, [userId])

  // Once an accepted invite exists where I'm the member, all reads/writes target the owner's data instead of mine
  const effectiveOwnerId = shares.find((s) => s.member_id === userId && s.status === 'accepted')?.owner_id ?? userId ?? null

  useEffect(() => {
    if (!sharesLoaded || !effectiveOwnerId) return
    void fetchAll(effectiveOwnerId)
  }, [sharesLoaded, effectiveOwnerId])

  async function fetchShares() {
    const { data } = await supabase.from('fund_shares').select('*').order('created_at', { ascending: false })
    setShares(data ?? [])
    setSharesLoaded(true)
  }

  async function fetchAll(ownerId: string) {
    const [assetResult, transactionResult, debtResult, borrowingResult, goldPriceResult] = await Promise.all([
      supabase.from('fund_assets').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }),
      supabase.from('fund_transactions').select('*').eq('user_id', ownerId).order('date', { ascending: false }),
      supabase.from('fund_debts').select('*').eq('user_id', ownerId).order('date', { ascending: false }),
      supabase.from('fund_borrowings').select('*').eq('user_id', ownerId).order('date', { ascending: false }),
      supabase.from('fund_gold_prices').select('*').eq('user_id', ownerId).maybeSingle(),
    ])
    setAssets(assetResult.data ?? [])
    setTransactions(transactionResult.data ?? [])
    setDebts(debtResult.data ?? [])
    setBorrowings(borrowingResult.data ?? [])
    const storedGoldPrice = goldPriceResult.data as GoldPriceRow | null
    if (storedGoldPrice) {
      const p24 = Number(storedGoldPrice.price24k_per_chi)
      const pRing = Number(storedGoldPrice.price_ring9999_per_chi)
      if (Number.isFinite(p24) && p24 > 0) {
        setGoldPrice24kPerChi(p24)
      }
      if (Number.isFinite(pRing) && pRing > 0) {
        setGoldPriceRing9999PerChi(pRing)
      }
      setGoldPriceUpdatedAt(storedGoldPrice.updated_at)
    }
  }

  async function saveGoldPriceToDb(ownerId: string, price24k: number, priceRing9999: number, updatedAt: string) {
    const { error } = await supabase.from('fund_gold_prices').upsert(
      {
        user_id: ownerId,
        price24k_per_chi: Math.round(price24k),
        price_ring9999_per_chi: Math.round(priceRing9999),
        updated_at: updatedAt,
      },
      { onConflict: 'user_id' }
    )
    if (error) throw error
  }

  async function revalueGoldAssets(ownerId: string, next24k: number, nextRing9999: number, base24k: number, baseRing9999: number) {
    const { data, error } = await supabase
      .from('fund_assets')
      .select('id, name, amount, gold_chi')
      .eq('user_id', ownerId)
      .eq('type', 'gold')

    if (error || !data?.length) return
    const goldAssets = data as Pick<FundAsset, 'id' | 'name' | 'amount' | 'gold_chi'>[]

    await Promise.all(
      goldAssets.map(async (asset) => {
        const variant = inferGoldVariantFromName(asset.name)
        const basePrice = variant === 'ring9999' ? baseRing9999 : base24k
        const nextPrice = variant === 'ring9999' ? nextRing9999 : next24k
        const storedChi = Number(asset.gold_chi)
        const derivedChi = Number(asset.amount) / basePrice
        const chi = Number.isFinite(storedChi) && storedChi > 0 ? storedChi : derivedChi
        if (!Number.isFinite(chi) || chi <= 0 || !Number.isFinite(nextPrice) || nextPrice <= 0) return

        await supabase
          .from('fund_assets')
          .update({
            amount: Math.round(chi * nextPrice),
            gold_chi: chi,
          })
          .eq('id', asset.id)
      })
    )
  }

  async function refreshGoldPrice() {
    if (!effectiveOwnerId) return
    setGoldPriceLoading(true)
    try {
      const base24k = goldPrice24kPerChi
      const baseRing9999 = goldPriceRing9999PerChi
      const latest = await fetchLatestGoldPrice()
      await saveGoldPriceToDb(effectiveOwnerId, latest.price24kPerChi, latest.priceRing9999PerChi, latest.updatedAt)
      await revalueGoldAssets(effectiveOwnerId, latest.price24kPerChi, latest.priceRing9999PerChi, base24k, baseRing9999)
      setGoldPrice24kPerChi(latest.price24kPerChi)
      setGoldPriceRing9999PerChi(latest.priceRing9999PerChi)
      setGoldPriceUpdatedAt(latest.updatedAt)
      setEditingGoldField(null)
      await fetchAll(effectiveOwnerId)
      toast.success(vi ? 'Đã cập nhật giá vàng mới nhất.' : 'Latest gold price updated.')
    } catch {
      toast.error(vi ? 'Không lấy được giá vàng mới nhất.' : 'Could not fetch the latest gold price.')
    } finally {
      setGoldPriceLoading(false)
    }
  }

  function startInlineGoldEdit(field: GoldPriceField) {
    if (goldPriceLoading) return
    setEditingGoldField(field)
    setEditingGoldValue(String(Math.round(field === '24k' ? goldPrice24kPerChi : goldPriceRing9999PerChi)))
  }

  async function commitInlineGoldEdit() {
    if (!effectiveOwnerId || !editingGoldField) return
    const nextValue = Number(editingGoldValue)
    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      return toast.error(vi ? 'Giá vàng không hợp lệ.' : 'Invalid gold prices.')
    }
    const next24k = editingGoldField === '24k' ? Math.round(nextValue) : Math.round(goldPrice24kPerChi)
    const nextRing = editingGoldField === 'ring9999' ? Math.round(nextValue) : Math.round(goldPriceRing9999PerChi)
    setGoldPriceLoading(true)
    try {
      const base24k = goldPrice24kPerChi
      const baseRing9999 = goldPriceRing9999PerChi
      const updatedAt = new Date().toISOString()
      await saveGoldPriceToDb(effectiveOwnerId, next24k, nextRing, updatedAt)
      await revalueGoldAssets(effectiveOwnerId, next24k, nextRing, base24k, baseRing9999)
      setGoldPrice24kPerChi(next24k)
      setGoldPriceRing9999PerChi(nextRing)
      setGoldPriceUpdatedAt(updatedAt)
      setEditingGoldField(null)
      await fetchAll(effectiveOwnerId)
      toast.success(vi ? 'Đã lưu giá vàng mới.' : 'Gold prices saved.')
    } catch {
      toast.error(vi ? 'Không thể lưu giá vàng.' : 'Could not save gold prices.')
    } finally {
      setGoldPriceLoading(false)
    }
  }

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault()
    if (!inviteEmail.trim()) return
    setInvitingBusy(true)
    const { error } = await supabase.rpc('fund_send_invite', { p_email: inviteEmail.trim() })
    if (error) {
      const messages: Record<string, string> = {
        user_not_found: vi ? 'Không tìm thấy tài khoản với email này.' : 'No account found with this email.',
        cannot_invite_self: vi ? 'Không thể tự mời chính mình.' : 'You cannot invite yourself.',
        already_shared: vi ? 'Người này đã đang quản lý chung với bạn.' : 'This person is already co-managing with you.',
      }
      toast.error(messages[error.message] ?? (vi ? 'Không thể gửi lời mời.' : 'Could not send invite.'))
    } else {
      toast.success(vi ? 'Đã gửi lời mời.' : 'Invite sent.')
      setInviteEmail('')
      await fetchShares()
    }
    setInvitingBusy(false)
  }

  async function respondInvite(id: string, accept: boolean) {
    const { error } = await supabase.rpc('fund_respond_invite', { p_invite_id: id, p_accept: accept })
    if (error) {
      const messages: Record<string, string> = {
        already_in_a_shared_fund: vi ? 'Bạn đang quản lý chung với người khác. Hãy rời nhóm đó trước.' : 'You already belong to another shared fund. Leave it first.',
      }
      toast.error(messages[error.message] ?? (vi ? 'Không thể xử lý lời mời.' : 'Could not process the invite.'))
    } else {
      toast.success(accept ? (vi ? 'Đã chấp nhận. Đang chuyển sang dữ liệu chung.' : 'Accepted. Switching to shared data.') : (vi ? 'Đã từ chối lời mời.' : 'Invite declined.'))
      await fetchShares()
    }
  }

  async function endShare(id: string) {
    const { error } = await supabase.rpc('fund_end_share', { p_invite_id: id })
    if (error) toast.error(vi ? 'Không thể thực hiện.' : 'Could not complete the action.')
    else {
      toast.success(vi ? 'Đã cập nhật.' : 'Updated.')
      await fetchShares()
    }
  }

  function resetAsset() {
    setAssetId(null); setAssetName(''); setAssetAmount(''); setAssetNote(''); setAssetFormOpen(false)
  }

  function getGoldPricePerChi(name: string): number {
    return inferGoldVariantFromName(name) === 'ring9999' ? goldPriceRing9999PerChi : goldPrice24kPerChi
  }

  function getStoredGoldChi(asset: FundAsset): number | null {
    const parsed = Number(asset.gold_chi)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
    return null
  }

  function getEditableAmount(asset: FundAsset): string {
    if (asset.type !== 'gold') return String(asset.amount)
    const storedChi = getStoredGoldChi(asset)
    if (storedChi !== null) return formatChiAmount(storedChi)
    const perChi = getGoldPricePerChi(asset.name)
    if (!Number.isFinite(perChi) || perChi <= 0) return ''
    return formatChiAmount(Number(asset.amount) / perChi)
  }

  function startEditAsset(asset: FundAsset) {
    setAssetId(asset.id)
    setAssetName(asset.name)
    setAssetAmount(getEditableAmount(asset))
    setAssetNote(asset.note ?? '')
    setAssetFormOpen(true)
  }

  async function saveAsset(event: React.FormEvent) {
    event.preventDefault()
    const resolvedType = inferAssetTypeFromName(assetName, assets)
    let amount = Number(assetAmount)
    let goldChi: number | null = null
    if (resolvedType === 'gold') {
      const chi = parseChiAmount(assetAmount)
      if (!assetName.trim() || !Number.isFinite(chi) || chi <= 0) return toast.error(vi ? 'Vui lòng nhập số chỉ hợp lệ.' : 'Please enter a valid chi amount.')
      goldChi = chi
      amount = chi * getGoldPricePerChi(assetName)
    } else if (!assetName.trim() || !Number.isFinite(amount) || amount < 0) {
      return toast.error(vi ? 'Dữ liệu tài sản không hợp lệ.' : 'Invalid asset data.')
    }
    setSaving(true)
    const row = { user_id: effectiveOwnerId!, name: assetName.trim(), type: resolvedType, amount, gold_chi: goldChi, note: assetNote.trim() || null }
    const { error } = assetId
      ? await supabase.from('fund_assets').update(row).eq('id', assetId)
      : await supabase.from('fund_assets').insert(row)
    await finishSave(error, resetAsset)
  }

  function resetTransaction() {
    setTransactionId(null); setTransactionType('in'); setTransactionAmount(''); setTransactionReason(''); setTransactionDate(getTodayLocalISODate()); setTransactionConvertFromId(''); setTransactionConvertToName(''); setTransactionFormOpen(false)
  }

  async function applyAssetDelta(assetId: string, delta: number, options?: { floorAtZero?: boolean }) {
    const { data } = await supabase.from('fund_assets').select('amount').eq('id', assetId).single()
    if (!data) return
    const nextAmount = Number(data.amount) + delta
    await supabase.from('fund_assets').update({ amount: options?.floorAtZero ? Math.max(0, nextAmount) : nextAmount }).eq('id', assetId)
  }

  async function applyDeltas(deltas: Map<string, number>) {
    for (const [id, delta] of deltas) if (delta !== 0) await applyAssetDelta(id, delta)
  }

  async function saveTransaction(event: React.FormEvent) {
    event.preventDefault()
    const amount = Number(transactionAmount)
    if (!transactionReason.trim() || !Number.isFinite(amount) || amount <= 0) return toast.error(vi ? 'Vui lòng nhập đủ thông tin giao dịch.' : 'Complete the transaction details.')
    if (transactionType === 'convert' && (!transactionConvertFromId || !transactionConvertToName.trim())) return toast.error(vi ? 'Chọn tài sản nguồn và nhập tên tài sản đích.' : 'Select source asset and enter destination asset name.')
    setSaving(true)

    const isConvert = transactionType === 'convert'
    let defaultAssetId = assets.find((a) => a.type === 'bank')?.id ?? ''
    if (!isConvert && !defaultAssetId) {
      const { data: created, error: createError } = await supabase
        .from('fund_assets')
        .insert({
          user_id: effectiveOwnerId!,
          name: vi ? 'Tài khoản chính' : 'Main account',
          type: 'bank',
          amount: 0,
        })
        .select('id')
        .single()
      if (createError || !created) {
        toast.error(vi ? 'Không thể tạo tài sản mặc định cho giao dịch.' : 'Could not create a default asset for this transaction.')
        setSaving(false)
        return
      }
      defaultAssetId = created.id
    }

    const srcId = isConvert ? transactionConvertFromId : defaultAssetId

    // Destination asset may not exist yet (e.g. buying gold for the first time) — create it with a 0 balance
    let dstId = ''
    if (isConvert) {
      const normalized = normalizeSearchText(transactionConvertToName.trim())
      const existingDst = assets.find((a) => normalizeSearchText(a.name) === normalized)
      if (existingDst) {
        dstId = existingDst.id
      } else {
        const resolvedType = inferAssetTypeFromName(transactionConvertToName, assets)
        const { data: created, error: createError } = await supabase
          .from('fund_assets')
          .insert({ user_id: effectiveOwnerId!, name: transactionConvertToName.trim(), type: resolvedType, amount: 0 })
          .select('id')
          .single()
        if (createError || !created) {
          toast.error(vi ? 'Không thể tạo tài sản đích.' : 'Could not create destination asset.')
          setSaving(false)
          return
        }
        dstId = created.id
      }
    }

    // Compute all deltas upfront from current snapshot — avoids stale-state bugs on same-asset edits
    const deltas = buildTransactionDeltaMap({
      transactionType,
      amount,
      srcId,
      dstId,
      previousTransaction: transactionId ? transactions.find((t) => t.id === transactionId) ?? null : null,
    })

    const actor = userAccountLabel || userId || (vi ? 'Tài khoản hiện tại' : 'Current account')
    const row = { user_id: effectiveOwnerId!, type: transactionType, amount, who: actor, reason: transactionReason.trim(), note: null, date: transactionDate, asset_id: srcId || null, dest_asset_id: dstId || null }
    const { error } = transactionId
      ? await supabase.from('fund_transactions').update(row).eq('id', transactionId)
      : await supabase.from('fund_transactions').insert(row)
    if (!error) await applyDeltas(deltas)
    await finishSave(error, resetTransaction)
  }

  function resetDebt() {
    setDebtId(null); setDebtor(''); setDebtAmount(''); setDebtReason(''); setDebtNote(''); setDebtDate(getTodayLocalISODate()); setDebtAssetId(''); setDebtFormOpen(false)
  }

  async function saveDebt(event: React.FormEvent) {
    event.preventDefault()
    const amount = Number(debtAmount)
    if (!debtor.trim() || !debtReason.trim() || !Number.isFinite(amount) || amount <= 0 || !debtAssetId) return toast.error(vi ? 'Vui lòng nhập đủ thông tin khoản nợ.' : 'Complete the debt details.')
    setSaving(true)

    // Lending money moves it out of an asset; a settled debt no longer ties up that asset
    const deltas = new Map<string, number>()
    const add = (id: string, d: number) => deltas.set(id, (deltas.get(id) ?? 0) + d)
    const old = debtId ? debts.find((d) => d.id === debtId) : undefined
    if (old?.asset_id && !old.is_settled) add(old.asset_id, Number(old.amount))
    if (!old?.is_settled) add(debtAssetId, -amount)

    const row = { user_id: effectiveOwnerId!, debtor: debtor.trim(), amount, reason: debtReason.trim(), note: debtNote.trim() || null, date: debtDate, asset_id: debtAssetId }
    const { error } = debtId
      ? await supabase.from('fund_debts').update(row).eq('id', debtId)
      : await supabase.from('fund_debts').insert(row)
    if (!error) await applyDeltas(deltas)
    await finishSave(error, resetDebt)
  }

  function resetBorrowing() {
    setBorrowingId(null); setLender(''); setBorrowingAmount(''); setBorrowingReason(''); setBorrowingTerm(''); setBorrowingDate(getTodayLocalISODate()); setBorrowingFormOpen(false)
  }

  async function saveBorrowing(event: React.FormEvent) {
    event.preventDefault()
    const amount = Number(borrowingAmount)
    if (!lender.trim() || !borrowingReason.trim() || !Number.isFinite(amount) || amount <= 0) return toast.error(vi ? 'Vui lòng nhập đủ thông tin khoản vay.' : 'Complete the borrowing details.')
    setSaving(true)
    const row = { user_id: effectiveOwnerId!, lender: lender.trim(), amount, reason: borrowingReason.trim(), term: borrowingTerm.trim() || null, date: borrowingDate }
    const { error } = borrowingId
      ? await supabase.from('fund_borrowings').update(row).eq('id', borrowingId)
      : await supabase.from('fund_borrowings').insert(row)
    await finishSave(error, resetBorrowing)
  }

  async function finishSave(error: { message: string } | null, reset: () => void) {
    if (error) toast.error(vi ? 'Không thể lưu dữ liệu.' : 'Could not save data.')
    else {
      toast.success(vi ? 'Đã lưu.' : 'Saved.')
      reset()
      await fetchAll(effectiveOwnerId!)
    }
    setSaving(false)
  }

  async function removeItem() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)

    if (deleteTarget.table === 'fund_transactions') {
      const tx = transactions.find((t) => t.id === deleteTarget.id)
      const { error } = await supabase.from(target.table).delete().eq('id', target.id)
      if (error) {
        toast.error(vi ? 'Không thể xoá.' : 'Could not delete.')
        return
      }
      if (tx) {
        for (const adjustment of buildTransactionDeleteAdjustments(tx)) {
          await applyAssetDelta(adjustment.assetId, adjustment.delta, {
            floorAtZero: adjustment.floorAtZero,
          })
        }
      }
      toast.success(vi ? 'Đã xoá.' : 'Deleted.')
      await fetchAll(effectiveOwnerId!)
      return
    } else if (deleteTarget.table === 'fund_debts') {
      const debt = debts.find((d) => d.id === deleteTarget.id)
      const { error } = await supabase.from(target.table).delete().eq('id', target.id)
      if (error) {
        toast.error(vi ? 'Không thể xoá.' : 'Could not delete.')
        return
      }
      const assetId = debt?.asset_id ?? assets.find((a) => a.type === 'bank')?.id
      if (debt && !debt.is_settled && assetId) await applyAssetDelta(assetId, Number(debt.amount))
      toast.success(vi ? 'Đã xoá.' : 'Deleted.')
      await fetchAll(effectiveOwnerId!)
      return
    }

    const { error } = await supabase.from(target.table).delete().eq('id', target.id)
    if (error) toast.error(vi ? 'Không thể xoá.' : 'Could not delete.')
    else {
      toast.success(vi ? 'Đã xoá.' : 'Deleted.')
      await fetchAll(effectiveOwnerId!)
    }
  }

  async function toggleSettled(table: 'fund_debts' | 'fund_borrowings', id: string, settled: boolean) {
    const { error } = await supabase.from(table).update({ is_settled: !settled }).eq('id', id)
    if (error) return toast.error(vi ? 'Không thể cập nhật.' : 'Could not update.')
    if (table === 'fund_debts') {
      const debt = debts.find((d) => d.id === id)
      const assetId = debt?.asset_id ?? assets.find((a) => a.type === 'bank')?.id
      if (debt && assetId) await applyAssetDelta(assetId, settled ? -Number(debt.amount) : Number(debt.amount))
    }
    await fetchAll(effectiveOwnerId!)
  }

  const totalAssets = assets.reduce((sum, item) => sum + Number(item.amount), 0)
  const totalIn = transactions.filter((item) => item.type === 'in').reduce((sum, item) => sum + Number(item.amount), 0)
  const totalOut = transactions.filter((item) => item.type === 'out').reduce((sum, item) => sum + Number(item.amount), 0)
  const totalConvert = transactions.filter((item) => item.type === 'convert').reduce((sum, item) => sum + Number(item.amount), 0)
  const transactionActors = [...new Set(transactions.map((item) => getFundActorLabel(item.who)).filter(Boolean))]
  const filteredTransactions = transactions.filter((item) => (
    (transactionFilter === 'all' || item.type === transactionFilter) &&
    (transactionActorFilter === 'all' || getFundActorLabel(item.who) === transactionActorFilter)
  ))
  const outstandingDebt = debts.filter((item) => !item.is_settled).reduce((sum, item) => sum + Number(item.amount), 0)
  const outstandingBorrowing = borrowings.filter((item) => !item.is_settled).reduce((sum, item) => sum + Number(item.amount), 0)
  const assetIsGold = inferAssetTypeFromName(assetName, assets) === 'gold'

  if (userId === undefined) return <main className="min-h-svh bg-[#f7fef9] pt-24" />

  if (!userId) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f7fef9] px-4 pt-20">
        <div className={`${cardClass} max-w-sm p-8 text-center`}>
          <Landmark className="mx-auto h-10 w-10 text-emerald-600" />
          <p className="mt-4 text-sm text-zinc-500">{vi ? 'Đăng nhập để quản lý tài sản của bạn.' : 'Sign in to manage your assets.'}</p>
          <a href="/login" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            {vi ? 'Đăng nhập' : 'Sign in'}
          </a>
        </div>
      </main>
    )
  }

  if (!sharesLoaded) return <main className="min-h-svh bg-[#f7fef9] pt-24" />

  return (
    <main className="min-h-svh bg-[#f7fef9] pb-16 pt-24">
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 sm:px-6">
        <header className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white"><Landmark className="size-5" /></div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">{vi ? 'Tài sản cá nhân' : 'Personal assets'}</p>
          </div>
        </header>

        <ShareCard
          vi={vi}
          userId={userId}
          shares={shares}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          invitingBusy={invitingBusy}
          onInvite={sendInvite}
          onRespond={respondInvite}
          onEnd={endShare}
        />

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {([
            [vi ? 'Tổng tài sản' : 'Total assets', totalAssets, WalletCards, 'text-emerald-600'],
            [vi ? 'Tiền vào' : 'Money in', totalIn, TrendingUp, 'text-emerald-600'],
            [vi ? 'Tiền ra' : 'Money out', totalOut, TrendingDown, 'text-red-500'],
            [vi ? 'Nợ chưa thu' : 'Receivables', outstandingDebt, Circle, 'text-amber-600'],
          ] as [string, number, LucideIcon, string][]).map(([label, value, Icon, color]) => (
            <div key={String(label)} className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-600">{String(label)}</p>
                <Icon className={`size-4 ${color}`} />
              </div>
              <p className="mt-3 text-lg font-semibold text-zinc-900">{formatMoney(Number(value))}</p>
            </div>
          ))}

          <div className={`${cardClass} col-span-2 p-4 xl:col-span-1`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-zinc-600">{vi ? 'Giá vàng' : 'Gold price'}</p>
                {goldPriceUpdatedAt && (
                  <p className="mt-1 text-[10px] text-zinc-400">
                    {new Date(goldPriceUpdatedAt).toLocaleTimeString(vi ? 'vi-VN' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void refreshGoldPrice()}
                disabled={goldPriceLoading}
                className="inline-flex size-7 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50"
                title={goldPriceLoading
                  ? (vi ? 'Đang lấy giá mới nhất' : 'Fetching latest gold price')
                  : (vi ? 'Lấy giá vàng mới nhất' : 'Fetch latest gold price')}
                aria-label={goldPriceLoading
                  ? (vi ? 'Đang lấy giá vàng mới nhất' : 'Fetching latest gold price')
                  : (vi ? 'Lấy giá vàng mới nhất' : 'Fetch latest gold price')}
              >
                <RefreshCw className={`size-3.5 ${goldPriceLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-500">24K</span>
                {editingGoldField === '24k' ? (
                  <input
                    className="h-7 w-28 rounded-md border border-emerald-300 bg-white px-2 text-right text-xs font-semibold text-zinc-900 outline-none focus:border-emerald-500"
                    inputMode="numeric"
                    value={formatDigitInput(editingGoldValue)}
                    onChange={(event) => setEditingGoldValue(event.target.value.replace(/[^\d]/g, ''))}
                    onBlur={() => void commitInlineGoldEdit()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void commitInlineGoldEdit()
                      }
                      if (event.key === 'Escape') {
                        setEditingGoldField(null)
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => startInlineGoldEdit('24k')}
                    className="text-right text-xs font-semibold text-zinc-900"
                    title={vi ? 'Nhấp đúp để sửa giá 24K' : 'Double-click to edit 24K price'}
                  >
                    {formatMoney(goldPrice24kPerChi)}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-500">{vi ? 'Nhẫn' : 'Ring'}</span>
                {editingGoldField === 'ring9999' ? (
                  <input
                    className="h-7 w-28 rounded-md border border-amber-300 bg-white px-2 text-right text-xs font-semibold text-zinc-900 outline-none focus:border-amber-500"
                    inputMode="numeric"
                    value={formatDigitInput(editingGoldValue)}
                    onChange={(event) => setEditingGoldValue(event.target.value.replace(/[^\d]/g, ''))}
                    onBlur={() => void commitInlineGoldEdit()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void commitInlineGoldEdit()
                      }
                      if (event.key === 'Escape') {
                        setEditingGoldField(null)
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => startInlineGoldEdit('ring9999')}
                    className="text-right text-xs font-semibold text-zinc-900"
                    title={vi ? 'Nhấp đúp để sửa giá vàng nhẫn' : 'Double-click to edit ring gold price'}
                  >
                    {formatMoney(goldPriceRing9999PerChi)}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Allocation + quick analysis */}
        <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className={`${cardClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-zinc-700">{vi ? 'Phân bổ tài sản' : 'Asset breakdown'}</p>
            {assets.length === 0 ? (
              <Empty text={getAssetBreakdownEmptyText({ hasTransactions: transactions.length > 0, vi })} />
            ) : (
              <DonutChart
                slices={(['gold', 'cash', 'bank', 'other'] as AssetType[])
                  .map((type) => ({
                    type,
                    sum: assets.filter((a) => a.type === type).reduce((s, a) => s + Number(a.amount), 0),
                    label: vi
                      ? { gold: 'Vàng', cash: 'Tiền mặt', bank: 'Tài khoản', other: 'Khác' }[type]
                      : { gold: 'Gold', cash: 'Cash', bank: 'Bank', other: 'Other' }[type],
                  }))
                  .filter((s) => s.sum > 0)}
                total={totalAssets}
                formatMoney={formatMoney}
              />
            )}
          </div>
          <div className={`${cardClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-zinc-700">{vi ? 'Phân tích nhanh' : 'Quick analysis'}</p>
            <div className="space-y-2">
              <Metric label={vi ? 'Dòng tiền ròng' : 'Net cash flow'} value={formatMoney(totalIn - totalOut)} />
              <Metric label={vi ? 'Nợ phải trả' : 'Outstanding loans'} value={formatMoney(outstandingBorrowing)} />
              <Metric label={vi ? 'Tài sản ròng ước tính' : 'Estimated net assets'} value={formatMoney(totalAssets + outstandingDebt - outstandingBorrowing)} />
            </div>
          </div>
        </section>

        {/* Assets */}
        <SectionCard
          title={vi ? 'Tài sản' : 'Assets'}
          formOpen={assetFormOpen}
          onToggleForm={() => (assetFormOpen ? resetAsset() : setAssetFormOpen(true))}
          addLabel={vi ? 'Thêm tài sản' : 'Add asset'}
          vi={vi}
        >
          {assetFormOpen && (
            <CrudForm title={assetId ? (vi ? 'Sửa tài sản' : 'Edit asset') : (vi ? 'Thêm tài sản' : 'Add asset')} onSubmit={saveAsset} saving={saving} onCancel={resetAsset} vi={vi} inline>
              <Field label={vi ? 'Tên tài sản' : 'Asset name'}>
                <AssetSuggest
                  value={assetName}
                  assets={assets}
                  vi={vi}
                  onChange={setAssetName}
                  onSelect={(suggestion) => { setAssetName(suggestion.name) }}
                />
              </Field>
              <Field label={vi ? 'Giá trị' : 'Value'}>
                {assetIsGold ? (
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={assetAmount}
                    onChange={(event) => setAssetAmount(event.target.value.replace(/[^\d.,]/g, ''))}
                    placeholder={vi ? 'VD: 1.5 chỉ' : 'e.g. 1.5 chi'}
                    required
                  />
                ) : (
                  <MoneyInput
                    value={assetAmount}
                    onChange={setAssetAmount}
                    min="0"
                    required
                    placeholder="VD: 5 → 5,000,000"
                  />
                )}
              </Field>
              <Field label={vi ? 'Ghi chú' : 'Note'}><input className={inputClass} value={assetNote} onChange={(event) => setAssetNote(event.target.value)} placeholder={vi ? 'Ghi chú thêm...' : 'Optional note...'} /></Field>
            </CrudForm>
          )}
          {assets.length === 0 ? <Empty text={vi ? 'Chưa có tài sản.' : 'No assets yet.'} /> : (
            <div className="divide-y divide-zinc-100">
              {assets.map((item) => (
                <Row key={item.id} title={item.name} subtitle={`${item.type}${item.type === 'gold' ? ` · ${formatChiAmount(getStoredGoldChi(item) ?? (Number(item.amount) / getGoldPricePerChi(item.name)))} ${vi ? 'chỉ' : 'chi'}` : ''}${item.note ? ` · ${item.note}` : ''}`} amount={formatMoney(item.amount)}
                  actions={<ActionButtons onEdit={() => startEditAsset(item)} onDelete={() => setDeleteTarget({ table: 'fund_assets', id: item.id })} />} />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Transactions */}
        <SectionCard
          title={vi ? 'Giao dịch' : 'Transactions'}
          formOpen={transactionFormOpen}
          onToggleForm={() => (transactionFormOpen ? resetTransaction() : setTransactionFormOpen(true))}
          addLabel={vi ? 'Thêm giao dịch' : 'Add transaction'}
          vi={vi}
        >
          {transactionFormOpen && (
            <CrudForm title={transactionId ? (vi ? 'Sửa giao dịch' : 'Edit transaction') : (vi ? 'Thêm giao dịch' : 'Add transaction')} onSubmit={saveTransaction} saving={saving} onCancel={resetTransaction} vi={vi} inline="transaction">
              {transactionType === 'convert' ? (
                <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
                  <div className="w-28">
                    <label className="mb-1 block text-xs font-medium text-zinc-500">{vi ? 'Loại' : 'Type'}</label>
                    <select className={inputClass} value={transactionType} onChange={(event) => { const t = event.target.value as 'in' | 'out' | 'convert'; setTransactionType(t); if (t === 'convert') setTransactionConvertFromId(assets.find((a) => a.type === 'bank')?.id ?? '') }}>
                      <option value="in">{vi ? '💰 Tiền vào' : 'Money in'}</option>
                      <option value="out">{vi ? '💸 Tiền ra' : 'Money out'}</option>
                      <option value="convert">{vi ? '🔄 Đầu tư' : 'Invest'}</option>
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-xs font-medium text-zinc-500">{vi ? 'Số tiền' : 'Amount'}</label>
                    <MoneyInput value={transactionAmount} onChange={setTransactionAmount} min="1" required />
                  </div>
                  <div className="min-w-36 flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-500">{vi ? 'Nội dung' : 'Description'}</label>
                    <input className={inputClass} value={transactionReason} onChange={(event) => setTransactionReason(event.target.value)} required placeholder={vi ? 'VD: Mua vàng 1 chỉ...' : 'e.g. Buy gold...'} />
                  </div>
                  <div className="w-32">
                    <label className="mb-1 block text-xs font-medium text-zinc-500">{vi ? 'Ngày' : 'Date'}</label>
                    <DatePicker value={transactionDate} onChange={setTransactionDate} className="w-full" />
                  </div>
                  <div className="w-26.5">
                    <label className="mb-1 block text-xs font-medium text-zinc-500">{vi ? 'Từ' : 'From'}</label>
                    <select className={inputClass} value={transactionConvertFromId} onChange={(event) => setTransactionConvertFromId(event.target.value)}>
                      {[...assets].sort((a, b) => (a.type === 'bank' ? -1 : b.type === 'bank' ? 1 : 0)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <span className="shrink-0 pb-2 text-zinc-400">→</span>
                  <div className="w-28">
                    <label className="mb-1 block text-xs font-medium text-zinc-500">{vi ? 'Sang' : 'To'}</label>
                    <AssetSuggest
                      value={transactionConvertToName}
                      assets={assets}
                      vi={vi}
                      onChange={setTransactionConvertToName}
                      onSelect={(suggestion) => setTransactionConvertToName(suggestion.name)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <Field label={vi ? 'Loại' : 'Type'}><select className={inputClass} value={transactionType} onChange={(event) => { const t = event.target.value as 'in' | 'out' | 'convert'; setTransactionType(t); if (t === 'convert') setTransactionConvertFromId(assets.find((a) => a.type === 'bank')?.id ?? '') }}><option value="in">{vi ? '💰 Tiền vào' : 'Money in'}</option><option value="out">{vi ? '💸 Tiền ra' : 'Money out'}</option><option value="convert">{vi ? '🔄 Đầu tư' : 'Invest'}</option></select></Field>
                  <Field label={vi ? 'Số tiền' : 'Amount'}><MoneyInput value={transactionAmount} onChange={setTransactionAmount} min="1" required /></Field>
                  <Field label={vi ? 'Nội dung' : 'Description'}><input className={inputClass} value={transactionReason} onChange={(event) => setTransactionReason(event.target.value)} required placeholder={vi ? 'VD: Mua vàng 1 chỉ, mua cổ phiếu...' : 'e.g. Buy gold, buy stocks...'} /></Field>
                  <Field label={vi ? 'Ngày' : 'Date'}><DatePicker value={transactionDate} onChange={setTransactionDate} /></Field>
                </>
              )}
            </CrudForm>
          )}
          <div className="flex flex-wrap gap-2 border-b border-emerald-100 px-5 py-3">
            {([
              ['in', vi ? '💰 Tiền vào' : 'Money in', totalIn, 'border-emerald-200 bg-emerald-50 text-emerald-700'],
              ['out', vi ? '💸 Tiền ra' : 'Money out', totalOut, 'border-red-200 bg-red-50 text-red-600'],
              ['convert', vi ? '🔄 Đầu tư' : 'Invest', totalConvert, 'border-amber-200 bg-amber-50 text-amber-700'],
            ] as const).map(([type, label, total, activeClass]) => (
              <button key={type} type="button" onClick={() => setTransactionFilter((current) => (current === type ? 'all' : type))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${transactionFilter === type ? activeClass : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}>
                {label}<span className="tabular-nums">{formatMoney(total)}</span>
              </button>
            ))}
            {transactionActors.length > 0 && (
              <>
                <span className="self-center text-xs text-zinc-300">|</span>
                <button type="button" onClick={() => setTransactionActorFilter('all')}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${transactionActorFilter === 'all' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}>
                  All
                </button>
                {transactionActors.map((actor) => (
                  <button key={actor} type="button" onClick={() => setTransactionActorFilter((current) => current === actor ? 'all' : actor)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${transactionActorFilter === actor ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}>
                    {actor}
                  </button>
                ))}
              </>
            )}
          </div>
          {filteredTransactions.length === 0 ? <Empty text={vi ? 'Chưa có giao dịch.' : 'No transactions.'} /> : (
            <div className="divide-y divide-zinc-100">
              {filteredTransactions.map((item) => {
                const isConvert = item.type === 'convert'
                const fromAsset = isConvert && item.asset_id ? assets.find((a) => a.id === item.asset_id) : null
                const toAsset = item.dest_asset_id ? assets.find((a) => a.id === item.dest_asset_id) : null
                const assetLabel = isConvert && fromAsset && toAsset ? `${fromAsset.name} → ${toAsset.name}` : toAsset ? `→ ${toAsset.name}` : null
                const amountStr = isConvert ? formatMoney(item.amount) : `${item.type === 'in' ? '+' : '-'}${formatMoney(item.amount)}`
                const amountCls = isConvert ? 'text-amber-600' : item.type === 'in' ? 'text-emerald-600' : 'text-red-500'
                return (
                  <Row key={item.id} title={item.reason} subtitle={`${assetLabel ? assetLabel + ' · ' : ''}${item.date} · ${vi ? 'Người nộp' : 'Submitted by'}: ${getFundActorLabel(item.who)}`} amount={amountStr} amountClass={amountCls}
                    actions={<ActionButtons onEdit={() => { setTransactionId(item.id); setTransactionType(item.type); setTransactionAmount(String(item.amount)); setTransactionReason(item.reason); setTransactionDate(item.date); setTransactionConvertFromId(isConvert ? (item.asset_id ?? '') : ''); setTransactionConvertToName(isConvert ? (toAsset?.name ?? '') : ''); setTransactionFormOpen(true) }} onDelete={() => setDeleteTarget({ table: 'fund_transactions', id: item.id })} />} />
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Debt & Loans */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title={vi ? 'Nợ (người khác nợ quỹ)' : 'Receivables'}
            formOpen={debtFormOpen}
            onToggleForm={() => { if (debtFormOpen) resetDebt(); else { setDebtAssetId(assets.find((a) => a.type === 'bank')?.id ?? ''); setDebtFormOpen(true) } }}
            addLabel={vi ? 'Thêm khoản nợ' : 'Add receivable'}
            vi={vi}
          >
            {debtFormOpen && (
              <CrudForm title={debtId ? (vi ? 'Sửa khoản nợ' : 'Edit receivable') : (vi ? 'Thêm khoản nợ' : 'Add receivable')} onSubmit={saveDebt} saving={saving} onCancel={resetDebt} vi={vi}>
                <Field label={vi ? 'Ai nợ' : 'Debtor'}><input className={inputClass} value={debtor} onChange={(event) => setDebtor(event.target.value)} required placeholder={vi ? 'Tên người nợ' : 'Debtor name'} /></Field>
                <Field label={vi ? 'Số tiền' : 'Amount'}><MoneyInput value={debtAmount} onChange={setDebtAmount} min="1" required /></Field>
                <Field label={vi ? 'Từ' : 'From'}>
                  <select className={inputClass} value={debtAssetId} onChange={(event) => setDebtAssetId(event.target.value)} required>
                    {[...assets].sort((a, b) => (a.type === 'bank' ? -1 : b.type === 'bank' ? 1 : 0)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label={vi ? 'Lý do' : 'Reason'}><input className={inputClass} value={debtReason} onChange={(event) => setDebtReason(event.target.value)} required placeholder={vi ? 'VD: Cho mượn tiền mua xe' : 'e.g. Loan for motorbike'} /></Field>
                <Field label={vi ? 'Ngày' : 'Date'}><DatePicker value={debtDate} onChange={setDebtDate} /></Field>
                <Field label={vi ? 'Ghi chú' : 'Note'}><input className={inputClass} value={debtNote} onChange={(event) => setDebtNote(event.target.value)} placeholder={vi ? 'Ghi chú thêm...' : 'Optional note...'} /></Field>
              </CrudForm>
            )}
            {debts.length === 0 ? <Empty text={vi ? 'Chưa có khoản nợ.' : 'No receivables.'} /> : (
              <div className="divide-y divide-zinc-100">
                {debts.map((item) => (
                  <SettledRow key={item.id} settled={item.is_settled} onToggle={() => toggleSettled('fund_debts', item.id, item.is_settled)} title={item.debtor} subtitle={`${item.reason} · ${item.date}`} amount={formatMoney(item.amount)}
                    actions={<ActionButtons onEdit={() => { setDebtId(item.id); setDebtor(item.debtor); setDebtAmount(String(item.amount)); setDebtReason(item.reason); setDebtNote(item.note ?? ''); setDebtDate(item.date); setDebtAssetId(item.asset_id ?? ''); setDebtFormOpen(true) }} onDelete={() => setDeleteTarget({ table: 'fund_debts', id: item.id })} />} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={vi ? 'Vay (quỹ đang vay)' : 'Loans payable'}
            formOpen={borrowingFormOpen}
            onToggleForm={() => (borrowingFormOpen ? resetBorrowing() : setBorrowingFormOpen(true))}
            addLabel={vi ? 'Thêm khoản vay' : 'Add loan'}
            vi={vi}
          >
            {borrowingFormOpen && (
              <CrudForm title={borrowingId ? (vi ? 'Sửa khoản vay' : 'Edit loan') : (vi ? 'Thêm khoản vay' : 'Add loan')} onSubmit={saveBorrowing} saving={saving} onCancel={resetBorrowing} vi={vi}>
                <Field label={vi ? 'Vay từ ai' : 'Lender'}><input className={inputClass} value={lender} onChange={(event) => setLender(event.target.value)} required placeholder={vi ? 'Tên người / tổ chức' : 'Person or institution'} /></Field>
                <Field label={vi ? 'Số tiền' : 'Amount'}><MoneyInput value={borrowingAmount} onChange={setBorrowingAmount} min="1" required /></Field>
                <Field label={vi ? 'Lý do' : 'Reason'}><input className={inputClass} value={borrowingReason} onChange={(event) => setBorrowingReason(event.target.value)} required placeholder={vi ? 'VD: Vay mua thiết bị' : 'e.g. Loan for equipment'} /></Field>
                <Field label={vi ? 'Ngày' : 'Date'}><DatePicker value={borrowingDate} onChange={setBorrowingDate} /></Field>
                <Field label={vi ? 'Thời hạn' : 'Term'}><input className={inputClass} value={borrowingTerm} onChange={(event) => setBorrowingTerm(event.target.value)} placeholder={vi ? 'VD: 6 tháng, 1 năm' : 'e.g. 6 months, 1 year'} /></Field>
              </CrudForm>
            )}
            {borrowings.length === 0 ? <Empty text={vi ? 'Chưa có khoản vay.' : 'No loans.'} /> : (
              <div className="divide-y divide-zinc-100">
                {borrowings.map((item) => (
                  <SettledRow key={item.id} settled={item.is_settled} onToggle={() => toggleSettled('fund_borrowings', item.id, item.is_settled)} title={item.lender} subtitle={`${item.reason} · ${item.date}${item.term ? ` · ${item.term}` : ''}`} amount={formatMoney(item.amount)}
                    actions={<ActionButtons onEdit={() => { setBorrowingId(item.id); setLender(item.lender); setBorrowingAmount(String(item.amount)); setBorrowingReason(item.reason); setBorrowingTerm(item.term ?? ''); setBorrowingDate(item.date); setBorrowingFormOpen(true) }} onDelete={() => setDeleteTarget({ table: 'fund_borrowings', id: item.id })} />} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <ConfirmModal open={!!deleteTarget} onConfirm={removeItem} onCancel={() => setDeleteTarget(null)} />
    </main>
  )
}

function ShareCard({ vi, userId, shares, inviteEmail, setInviteEmail, invitingBusy, onInvite, onRespond, onEnd }: {
  vi: boolean
  userId: string
  shares: FundShare[]
  inviteEmail: string
  setInviteEmail: (value: string) => void
  invitingBusy: boolean
  onInvite: (event: React.FormEvent) => void
  onRespond: (id: string, accept: boolean) => void
  onEnd: (id: string) => void
}) {
  const joined = shares.find((s) => s.member_id === userId && s.status === 'accepted')
  const pendingReceived = shares.filter((s) => s.member_id === userId && s.status === 'pending')
  const sent = shares.filter((s) => s.owner_id === userId && (s.status === 'pending' || s.status === 'accepted'))
  const expandStateKey = `fund-share-card-expanded:${userId}`
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = window.localStorage.getItem(expandStateKey)
    return saved === null ? true : saved === 'true'
  })
  const statusLabel: Record<ShareStatus, string> = vi
    ? { pending: 'Đang chờ', accepted: 'Đã tham gia', declined: 'Đã từ chối', revoked: 'Đã huỷ' }
    : { pending: 'Pending', accepted: 'Joined', declined: 'Declined', revoked: 'Revoked' }

  useEffect(() => {
    window.localStorage.setItem(expandStateKey, String(expanded))
  }, [expandStateKey, expanded])

  if (joined) return null

  return (
    <section className={`${cardClass} ${expanded ? 'p-3 sm:p-4' : 'p-2.5 sm:p-3'}`}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={`flex w-full items-center justify-between rounded-lg px-1 text-left ${expanded ? 'mb-2 py-0.5 sm:mb-2.5 sm:py-0.5' : 'py-0 sm:py-0'}`}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Users className="size-4 text-emerald-600" />
          <p className="text-sm font-semibold text-zinc-700">{vi ? 'Quản lý chung' : 'Shared management'}</p>
        </div>
        {expanded ? <ChevronUp className="size-4 text-zinc-400" /> : <ChevronDown className="size-4 text-zinc-400" />}
      </button>

      {expanded && (
        <>
          <form onSubmit={onInvite} className="flex flex-wrap items-end gap-1.5 sm:gap-2">
            <div className="min-w-48 flex-1">
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 sm:text-xs">{vi ? 'Mời quản lý chung (email)' : 'Invite to co-manage (email)'}</label>
              <input className={inputClass} type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder={vi ? 'email@vidu.com' : 'email@example.com'} required />
            </div>
            <button type="submit" disabled={invitingBusy} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:h-8.5 sm:px-3.5 sm:text-sm">
              <Mail className="size-4" />{invitingBusy ? (vi ? 'Đang gửi...' : 'Sending...') : (vi ? 'Gửi lời mời' : 'Send invite')}
            </button>
          </form>

          {pendingReceived.length > 0 && (
            <div className="mt-3 space-y-1.5 sm:mt-3 sm:space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">{vi ? 'Lời mời nhận được' : 'Invites received'}</p>
              {pendingReceived.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 px-2.5 py-2 sm:px-3">
                  <p className="text-xs text-zinc-700 sm:text-sm"><strong>{item.owner_email}</strong>{vi ? ' mời bạn quản lý chung tài sản.' : ' invited you to co-manage their fund.'}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => onRespond(item.id, true)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">{vi ? 'Chấp nhận' : 'Accept'}</button>
                    <button type="button" onClick={() => onRespond(item.id, false)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">{vi ? 'Từ chối' : 'Decline'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sent.length > 0 && (
            <div className="mt-3 space-y-1.5 sm:mt-3 sm:space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">{vi ? 'Lời mời đã gửi' : 'Invites sent'}</p>
              {sent.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 px-2.5 py-2 sm:px-3">
                  <p className="text-xs text-zinc-700 sm:text-sm">{item.member_email}</p>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{statusLabel[item.status]}</span>
                    <button type="button" onClick={() => onEnd(item.id)} className="text-xs font-medium text-zinc-400 hover:text-red-600">{vi ? 'Huỷ' : 'Cancel'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function SectionCard({ title, formOpen, onToggleForm, addLabel, vi, children }: { title: string; formOpen: boolean; onToggleForm: () => void; addLabel: string; vi: boolean; children: React.ReactNode }) {
  return (
    <section className={`${cardClass} ${formOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
      <div className="flex items-center justify-between border-b border-emerald-100 px-5 py-3.5">
        <h2 className="font-poppins text-base font-semibold text-zinc-900">{title}</h2>
        <button type="button" onClick={onToggleForm}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${formOpen ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
          {formOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {formOpen ? (vi ? 'Đóng' : 'Close') : addLabel}
        </button>
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-zinc-500">{label}{children}</label>
}

function CrudForm({ title, children, onSubmit, saving, onCancel, vi, inline = false }: { title: string; children: React.ReactNode; onSubmit: (event: React.FormEvent) => void; saving: boolean; onCancel: () => void; vi: boolean; inline?: boolean | 'transaction' }) {
  const inlineGridClass = inline === 'transaction'
    ? 'lg:grid-cols-[0.85fr_0.95fr_1fr_1.25fr_auto] lg:items-end'
    : inline
      ? 'lg:grid-cols-[1.55fr_1fr_1.35fr_auto] lg:items-end'
      : ''

  return (
    <form onSubmit={onSubmit} className={`grid gap-3 border-b border-emerald-100 bg-emerald-50/40 px-5 py-4 sm:grid-cols-2 ${inlineGridClass}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 sm:col-span-2 ${inline ? 'lg:sr-only' : ''}`}>{title}</p>
      {children}
      <div className={`flex gap-2 sm:col-span-2 ${inline ? 'lg:col-span-1 lg:self-end' : ''}`}>
        <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {saving ? (vi ? 'Đang lưu...' : 'Saving...') : (vi ? 'Lưu' : 'Save')}
        </button>
        <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50">{vi ? 'Huỷ' : 'Cancel'}</button>
      </div>
    </form>
  )
}

function Row({ title, subtitle, amount, amountClass = 'text-zinc-900', actions }: { title: string; subtitle: string; amount: string; amountClass?: string; actions: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-800">{title}</p><p className="truncate text-xs text-zinc-400">{subtitle}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`text-sm font-semibold ${amountClass}`}>{amount}</span>{actions}</div></div>
}

function SettledRow({ settled, onToggle, ...row }: { settled: boolean; onToggle: () => void; title: string; subtitle: string; amount: string; actions: React.ReactNode }) {
  return <div className={`flex items-center gap-2 ${settled ? 'opacity-50' : ''}`}><button type="button" onClick={onToggle} className="ml-5 shrink-0 text-zinc-400 hover:text-emerald-600">{settled ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4" />}</button><div className="min-w-0 flex-1"><Row {...row} /></div></div>
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-sm text-zinc-400">{text}</p>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3"><span className="text-sm text-zinc-600">{label}</span><strong className="text-sm text-zinc-900">{value}</strong></div>
}

const SLICE_COLORS: Record<string, string> = {
  gold: '#f59e0b',
  cash: '#10b981',
  bank: '#3b82f6',
  other: '#8b5cf6',
}

function DonutChart({ slices, total, formatMoney }: {
  slices: { type: string; sum: number; label: string }[]
  total: number
  formatMoney: (v: number) => string
}) {
  const R = 56, r = 36, cx = 70, cy = 70
  const circumference = 2 * Math.PI * R
  const arcs = slices.reduce<{ type: string; sum: number; label: string; pct: number; dash: number; offset: number }[]>((acc, s) => {
    const pct = total > 0 ? s.sum / total : 0
    const dash = pct * circumference
    const prev = acc[acc.length - 1]
    acc.push({ ...s, pct, dash, offset: prev ? prev.offset + prev.dash : 0 })
    return acc
  }, [])

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg width={140} height={140} className="shrink-0">
        {/* gap ring */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f4f4f5" strokeWidth={r - 2} />
        {arcs.map((arc) => (
          <circle
            key={arc.type}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={SLICE_COLORS[arc.type] ?? '#a1a1aa'}
            strokeWidth={20}
            strokeDasharray={`${arc.dash - 1.5} ${circumference - arc.dash + 1.5}`}
            strokeDashoffset={circumference / 4 - arc.offset}
            strokeLinecap="butt"
          />
        ))}
        <circle cx={cx} cy={cy} r={r} fill="white" />
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-xs" fontSize={9} fill="#71717a">tổng</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fontWeight={600} fill="#18181b">
          {total >= 1_000_000 ? `${(total / 1_000_000).toFixed(0)}M` : total >= 1_000 ? `${(total / 1_000).toFixed(0)}K` : String(total)}
        </text>
      </svg>
      <div className="flex flex-1 flex-col gap-2">
        {arcs.map((arc) => (
          <div key={arc.type} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: SLICE_COLORS[arc.type] ?? '#a1a1aa' }} />
              <span className="text-xs text-zinc-600">{arc.label}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-zinc-900">{formatMoney(arc.sum)}</span>
              <span className="ml-1.5 text-[11px] text-zinc-400">{(arc.pct * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
