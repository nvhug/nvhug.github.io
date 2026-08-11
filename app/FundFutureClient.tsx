'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle, Landmark, Pencil, Plus, Trash2, TrendingDown, TrendingUp, WalletCards, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { DatePicker } from '@/components/ui/date-picker'
import { getTodayLocalISODate } from '@/lib/date'
import { useLanguage } from '@/lib/i18n/language-context'
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
        value={value}
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
  const [goldPricePerChi, setGoldPricePerChi] = useState('9500000')

  const [transactionFormOpen, setTransactionFormOpen] = useState(false)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [transactionType, setTransactionType] = useState<'in' | 'out' | 'convert'>('in')
  const [transactionAmount, setTransactionAmount] = useState('')
  const [transactionReason, setTransactionReason] = useState('')
  const [transactionDate, setTransactionDate] = useState(getTodayLocalISODate)
  const [transactionConvertFromId, setTransactionConvertFromId] = useState('')
  const [transactionConvertToName, setTransactionConvertToName] = useState('')
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'in' | 'out' | 'convert'>('all')

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string; email?: string | null } | null } }) => {
      setUserId(data.user?.id ?? null)
      setUserAccountLabel(data.user?.email ?? data.user?.id ?? '')
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    void fetchAll()
  }, [userId])

  async function fetchAll() {
    const [assetResult, transactionResult, debtResult, borrowingResult] = await Promise.all([
      supabase.from('fund_assets').select('*').order('created_at', { ascending: false }),
      supabase.from('fund_transactions').select('*').order('date', { ascending: false }),
      supabase.from('fund_debts').select('*').order('date', { ascending: false }),
      supabase.from('fund_borrowings').select('*').order('date', { ascending: false }),
    ])
    setAssets(assetResult.data ?? [])
    setTransactions(transactionResult.data ?? [])
    setDebts(debtResult.data ?? [])
    setBorrowings(borrowingResult.data ?? [])
  }

  function resetAsset() {
    setAssetId(null); setAssetName(''); setAssetAmount(''); setAssetNote(''); setAssetFormOpen(false)
  }

  async function saveAsset(event: React.FormEvent) {
    event.preventDefault()
    const amount = Number(assetAmount)
    if (!assetName.trim() || !Number.isFinite(amount) || amount < 0) return toast.error(vi ? 'Dữ liệu tài sản không hợp lệ.' : 'Invalid asset data.')
    setSaving(true)
    const resolvedType = inferAssetTypeFromName(assetName, assets)
    const row = { user_id: userId!, name: assetName.trim(), type: resolvedType, amount, note: assetNote.trim() || null }
    const { error } = assetId
      ? await supabase.from('fund_assets').update(row).eq('id', assetId)
      : await supabase.from('fund_assets').insert(row)
    await finishSave(error, resetAsset)
  }

  function resetTransaction() {
    setTransactionId(null); setTransactionType('in'); setTransactionAmount(''); setTransactionReason(''); setTransactionDate(getTodayLocalISODate()); setTransactionConvertFromId(''); setTransactionConvertToName(''); setTransactionFormOpen(false)
  }

  async function applyAssetDelta(assetId: string, delta: number) {
    const { data } = await supabase.from('fund_assets').select('amount').eq('id', assetId).single()
    if (!data) return
    await supabase.from('fund_assets').update({ amount: Number(data.amount) + delta }).eq('id', assetId)
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
    const srcId = isConvert ? transactionConvertFromId : (assets.find((a) => a.type === 'bank')?.id ?? '')

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
          .insert({ user_id: userId!, name: transactionConvertToName.trim(), type: resolvedType, amount: 0 })
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
    const deltas = new Map<string, number>()
    const add = (id: string, d: number) => deltas.set(id, (deltas.get(id) ?? 0) + d)
    if (transactionId) {
      const old = transactions.find((t) => t.id === transactionId)
      if (old?.asset_id) add(old.asset_id, old.type === 'in' ? -Number(old.amount) : Number(old.amount))
      if (old?.dest_asset_id) add(old.dest_asset_id, -Number(old.amount))
    }
    if (isConvert) {
      if (srcId) add(srcId, -amount)
      if (dstId) add(dstId, amount)
    } else {
      if (srcId) add(srcId, transactionType === 'in' ? amount : -amount)
    }

    const actor = userAccountLabel || userId || (vi ? 'Tài khoản hiện tại' : 'Current account')
    const row = { user_id: userId!, type: transactionType, amount, who: actor, reason: transactionReason.trim(), note: null, date: transactionDate, asset_id: srcId || null, dest_asset_id: dstId || null }
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

    const row = { user_id: userId!, debtor: debtor.trim(), amount, reason: debtReason.trim(), note: debtNote.trim() || null, date: debtDate, asset_id: debtAssetId }
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
    const row = { user_id: userId!, lender: lender.trim(), amount, reason: borrowingReason.trim(), term: borrowingTerm.trim() || null, date: borrowingDate }
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
      await fetchAll()
    }
    setSaving(false)
  }

  async function removeItem() {
    if (!deleteTarget) return
    if (deleteTarget.table === 'fund_transactions') {
      const tx = transactions.find((t) => t.id === deleteTarget.id)
      if (tx) {
        const deltas = new Map<string, number>()
        const add = (id: string, d: number) => deltas.set(id, (deltas.get(id) ?? 0) + d)
        if (tx.asset_id) add(tx.asset_id, tx.type === 'in' ? -Number(tx.amount) : Number(tx.amount))
        if (tx.dest_asset_id) add(tx.dest_asset_id, -Number(tx.amount))
        await applyDeltas(deltas)
      }
    } else if (deleteTarget.table === 'fund_debts') {
      const debt = debts.find((d) => d.id === deleteTarget.id)
      const assetId = debt?.asset_id ?? assets.find((a) => a.type === 'bank')?.id
      if (debt && !debt.is_settled && assetId) await applyAssetDelta(assetId, Number(debt.amount))
    }
    const { error } = await supabase.from(deleteTarget.table).delete().eq('id', deleteTarget.id)
    if (error) toast.error(vi ? 'Không thể xoá.' : 'Could not delete.')
    else {
      toast.success(vi ? 'Đã xoá.' : 'Deleted.')
      await fetchAll()
    }
    setDeleteTarget(null)
  }

  async function toggleSettled(table: 'fund_debts' | 'fund_borrowings', id: string, settled: boolean) {
    const { error } = await supabase.from(table).update({ is_settled: !settled }).eq('id', id)
    if (error) return toast.error(vi ? 'Không thể cập nhật.' : 'Could not update.')
    if (table === 'fund_debts') {
      const debt = debts.find((d) => d.id === id)
      const assetId = debt?.asset_id ?? assets.find((a) => a.type === 'bank')?.id
      if (debt && assetId) await applyAssetDelta(assetId, settled ? -Number(debt.amount) : Number(debt.amount))
    }
    await fetchAll()
  }

  const totalAssets = assets.reduce((sum, item) => sum + Number(item.amount), 0)
  const totalIn = transactions.filter((item) => item.type === 'in').reduce((sum, item) => sum + Number(item.amount), 0)
  const totalOut = transactions.filter((item) => item.type === 'out').reduce((sum, item) => sum + Number(item.amount), 0)
  const totalConvert = transactions.filter((item) => item.type === 'convert').reduce((sum, item) => sum + Number(item.amount), 0)
  const filteredTransactions = transactionFilter === 'all' ? transactions : transactions.filter((item) => item.type === transactionFilter)
  const outstandingDebt = debts.filter((item) => !item.is_settled).reduce((sum, item) => sum + Number(item.amount), 0)
  const outstandingBorrowing = borrowings.filter((item) => !item.is_settled).reduce((sum, item) => sum + Number(item.amount), 0)

  if (userId === undefined) return <main className="min-h-svh bg-[#f7fef9] pt-24" />

  if (!userId) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f7fef9] px-4 pt-20">
        <div className={`${cardClass} max-w-sm p-8 text-center`}>
          <Landmark className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="mt-4 font-poppins text-2xl font-semibold text-zinc-900">{vi ? 'Quỹ Tương Lai' : 'Future Fund'}</h1>
          <p className="mt-2 text-sm text-zinc-500">{vi ? 'Đăng nhập để quản lý tài sản của bạn.' : 'Sign in to manage your assets.'}</p>
          <a href="/login" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            {vi ? 'Đăng nhập' : 'Sign in'}
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-[#f7fef9] pb-16 pt-24">
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 sm:px-6">
        <header className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white"><Landmark className="size-5" /></div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">{vi ? 'Tài sản cá nhân' : 'Personal assets'}</p>
            <h1 className="font-poppins text-2xl font-semibold text-zinc-900">{vi ? 'Quỹ Tương Lai' : 'Future Fund'}</h1>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            [vi ? 'Tổng tài sản' : 'Total assets', totalAssets, WalletCards, 'text-emerald-600'],
            [vi ? 'Tiền vào' : 'Money in', totalIn, TrendingUp, 'text-emerald-600'],
            [vi ? 'Tiền ra' : 'Money out', totalOut, TrendingDown, 'text-red-500'],
            [vi ? 'Nợ chưa thu' : 'Receivables', outstandingDebt, Circle, 'text-amber-600'],
          ] as [string, number, LucideIcon, string][]).map(([label, value, Icon, color]) => (
            <div key={String(label)} className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between"><p className="text-xs text-zinc-500">{String(label)}</p><Icon className={`size-4 ${color}`} /></div>
              <p className="mt-2 text-xl font-semibold text-zinc-900">{formatMoney(Number(value))}</p>
            </div>
          ))}
        </section>

        {/* Allocation + quick analysis */}
        <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className={`${cardClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-zinc-700">{vi ? 'Phân bổ tài sản' : 'Asset breakdown'}</p>
            {assets.length === 0 ? (
              <Empty text={vi ? 'Chưa có tài sản.' : 'No assets yet.'} />
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
                <MoneyInput
                  value={assetAmount}
                  onChange={setAssetAmount}
                  min="0"
                  required
                  isGold={inferAssetTypeFromName(assetName, assets) === 'gold'}
                  pricePerChi={Number(goldPricePerChi) || 9_500_000}
                  placeholder={inferAssetTypeFromName(assetName, assets) === 'gold' ? (vi ? 'Số chỉ hoặc VND' : 'Chỉ count or VND') : 'VD: 5 → 5,000,000'}
                />
              </Field>
              {inferAssetTypeFromName(assetName, assets) === 'gold' && (
                <Field label={vi ? 'Giá 1 chỉ (VND)' : 'Price/chỉ (VND)'}>
                  <input className={inputClass} inputMode="numeric" value={goldPricePerChi} onChange={(event) => setGoldPricePerChi(event.target.value.replace(/\D/g, ''))} placeholder="9500000" />
                </Field>
              )}
              <Field label={vi ? 'Ghi chú' : 'Note'}><input className={inputClass} value={assetNote} onChange={(event) => setAssetNote(event.target.value)} placeholder={vi ? 'Ghi chú thêm...' : 'Optional note...'} /></Field>
            </CrudForm>
          )}
          {assets.length === 0 ? <Empty text={vi ? 'Chưa có tài sản.' : 'No assets yet.'} /> : (
            <div className="divide-y divide-zinc-100">
              {assets.map((item) => (
                <Row key={item.id} title={item.name} subtitle={`${item.type}${item.note ? ` · ${item.note}` : ''}`} amount={formatMoney(item.amount)}
                  actions={<ActionButtons onEdit={() => { setAssetId(item.id); setAssetName(item.name); setAssetAmount(String(item.amount)); setAssetNote(item.note ?? ''); setAssetFormOpen(true) }} onDelete={() => setDeleteTarget({ table: 'fund_assets', id: item.id })} />} />
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
                  <Row key={item.id} title={item.reason} subtitle={`${assetLabel ? assetLabel + ' · ' : ''}${item.date}`} amount={amountStr} amountClass={amountCls}
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
