'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, BarChart2, Pencil, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { getSuggestedTickers, getUpsidePct, MIN_SUGGESTION_UPSIDE_PCT, type SuggestedTicker } from './stockSuggestions'

type StockHolding = {
  id: string
  user_id: string | null
  ticker: string
  company_name: string | null
  shares: number
  avg_cost: number
  sector: string | null
  note: string | null
}

type PriceData = {
  close: number
  change: number
  pct_change: number
  date: string
  volume?: number
  high?: number
  low?: number
}

type SortKey = 'ticker' | 'value' | 'pnl' | 'pnl_pct' | 'weight'
type SortDir = 'asc' | 'desc'

const SECTORS = ['', 'Ngân hàng', 'Bất động sản', 'Chứng khoán', 'Công nghiệp', 'Tiêu dùng', 'Năng lượng', 'Công nghệ', 'Y tế', 'Vật liệu', 'Tiện ích', 'Khác']
const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#ef4444', '#0ea5e9', '#d946ef']
// localStorage key kept as migration fallback only
const WATCH_KEY = 'stock-watchlist-v1'

type WatchRow = { id: string; ticker: string }

function fmt(v: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(v))
}

function compact(v: number) {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}T`
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${Math.round(abs)}`
}

function pnlCls(v: number) {
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-zinc-400'
}

function DonutChart({ slices }: { slices: { label: string; pct: number; color: string }[] }) {
  const R = 52, strokeW = 18, cx = 68, cy = 68, circ = 2 * Math.PI * R
  const arcs = slices.map((s, index) => ({
    ...s,
    len: circ * s.pct,
    offset: slices.slice(0, index).reduce((sum, item) => sum + circ * item.pct, 0),
  }))
  return (
    <svg width={136} height={136} viewBox="0 0 136 136">
      {arcs.map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={a.color} strokeWidth={strokeW}
          strokeDasharray={`${a.len} ${circ - a.len}`} strokeDashoffset={circ / 4 - a.offset} />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fill="#71717a" fontWeight="600">{slices.length}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fill="#a1a1aa">mã CP</text>
    </svg>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.15)]">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-zinc-400">{sub}</p>
    </div>
  )
}

function SortableHeader({ label, col, current, dir, onToggle, right = false }: {
  label: string; col: SortKey; current: SortKey; dir: SortDir; onToggle: (k: SortKey) => void; right?: boolean
}) {
  const active = current === col
  return (
    <th onClick={() => onToggle(col)}
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 ${right ? 'text-right' : 'text-left'}`}>
      {label}
      <span className={`ml-0.5 ${active ? 'text-emerald-500' : 'text-zinc-300'}`}>{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  )
}

// ── Watchlist card ─────────────────────────────────────────────
function WatchCard({ ticker, pd, onRemove }: {
  ticker: string; pd: PriceData | undefined; onRemove: () => void
}) {
  const isUp = pd ? pd.pct_change > 0 : null
  const isFlat = pd ? pd.pct_change === 0 : false
  const pctCls = isUp ? 'text-emerald-500' : isFlat ? 'text-zinc-400' : 'text-red-500'
  const topCls = isUp === null ? 'border-t-zinc-200' : isUp ? 'border-t-emerald-400' : isFlat ? 'border-t-zinc-300' : 'border-t-red-400'

  return (
    <div className={`group relative shrink-0 w-20 rounded-lg border border-zinc-100 border-t-2 bg-white p-2 transition-all hover:shadow-sm ${topCls}`}>
      <button type="button" onClick={onRemove}
        className="absolute right-1 top-1 hidden text-zinc-300 hover:text-zinc-600 group-hover:block">
        <X className="size-2.5" />
      </button>

      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-bold tracking-wide text-zinc-500">{ticker}</span>
        <span className="text-[10px] font-semibold tabular-nums text-zinc-700">{pd ? fmt(pd.close) : '—'}</span>
      </div>

      {pd ? (
        <p className={`mt-1 text-center text-[11px] font-bold tabular-nums ${pctCls}`}>
          {isUp ? '▲' : isFlat ? '─' : '▼'} {Math.abs(pd.pct_change).toFixed(2)}%
        </p>
      ) : (
        <p className="mt-1 text-center text-[10px] text-zinc-300">—</p>
      )}
    </div>
  )
}

function SuggestionCard({ suggestion, onAdd, disabled }: {
  suggestion: SuggestedTicker
  onAdd: () => void
  disabled?: boolean
}) {
  const sentimentCls = suggestion.sentiment === 'Tăng'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : suggestion.sentiment === 'Đi ngang'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-sky-50 text-sky-700 border-sky-200'

  const upsidePct = getUpsidePct(suggestion)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.18)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-wide text-zinc-900">{suggestion.ticker}</span>
            <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${sentimentCls}`}>
              {suggestion.sentiment}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-600">{suggestion.reason}</p>
        </div>
        <button type="button" onClick={onAdd} disabled={disabled}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">
          {disabled ? 'Đã có' : 'Thêm'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-zinc-50 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-400">Giá hiện tại</div>
          <div className="mt-0.5 text-xs font-bold tabular-nums text-zinc-800">
            {new Intl.NumberFormat('vi-VN').format(suggestion.currentPrice)}đ
          </div>
        </div>
        <div className="rounded-md bg-emerald-50 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-emerald-600">Target</div>
          <div className="mt-0.5 text-xs font-bold tabular-nums text-emerald-700">
            {new Intl.NumberFormat('vi-VN').format(suggestion.targetPrice)}đ
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Upside</span>
        <span className="font-semibold text-emerald-600">+{upsidePct.toFixed(1)}%</span>
      </div>

      <p className="mt-2 text-[10px] leading-4 text-zinc-500">
        <span className="font-semibold text-zinc-600">Catalyst:</span> {suggestion.catalyst}
      </p>
      <p className="mt-1 text-[9px] text-zinc-400">Target tham khảo · cập nhật {suggestion.targetUpdatedAt}</p>
    </div>
  )
}

// ── Watchlist section ──────────────────────────────────────────
function WatchlistSection({
  onSuggestionsChange,
  onWatchlistActionChange,
}: {
  onSuggestionsChange?: (list: SuggestedTicker[]) => void
  onWatchlistActionChange?: (addTicker: (ticker: string) => void) => void
}) {
  const [rows, setRows] = useState<WatchRow[]>([])
  const [prices, setPrices] = useState<Record<string, PriceData>>({})
  const [loading, setLoading] = useState(true)
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [watchlistError, setWatchlistError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const addTickerRef = useRef<(ticker: string) => void>(() => undefined)

  const baseSuggestions = useMemo(() => getSuggestedTickers(rows.map((r) => r.ticker)), [rows])
  const suggestions = useMemo(() => baseSuggestions
    .map((suggestion) => ({
      ...suggestion,
      currentPrice: prices[suggestion.ticker]?.close ?? suggestion.currentPrice,
    }))
    .filter((suggestion) => getUpsidePct(suggestion) >= MIN_SUGGESTION_UPSIDE_PCT), [baseSuggestions, prices])

  useEffect(() => {
    onSuggestionsChange?.(suggestions)
  }, [suggestions, onSuggestionsChange])

  useEffect(() => {
    onWatchlistActionChange?.((ticker) => { addTickerRef.current(ticker) })
  }, [onWatchlistActionChange])

  const fetchPrices = useCallback(async (list: string[]) => {
    if (list.length === 0) return
    try {
      const res = await fetch(`/api/stock-price?tickers=${list.join(',')}`)
      if (res.ok) {
        const data = await res.json() as Record<string, PriceData>
        setPrices((prev) => ({ ...prev, ...data }))
      }
    } catch { /* ignore */ }
  }, [])

  // Load from Supabase; migrate any localStorage leftovers once
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('stock_watchlist')
        .select('id, ticker')
        .order('created_at')
      if (!error && data) {
        setWatchlistError(false)
        setRows(data as WatchRow[])
        const tickers = (data as WatchRow[]).map((r) => r.ticker)
        if (tickers.length > 0) fetchPrices(tickers)

        // one-time migration: lift any localStorage entries into Supabase
        try {
          const raw = localStorage.getItem(WATCH_KEY)
          if (raw) {
            const old = JSON.parse(raw) as string[]
            const existing = new Set(tickers)
            const fresh = old.filter((t) => !existing.has(t))
            if (fresh.length > 0) {
              const { data: { user } } = await supabase.auth.getUser()
              await supabase.from('stock_watchlist').insert(
                fresh.map((ticker) => ({ ticker, user_id: user?.id ?? null }))
              )
            }
            localStorage.removeItem(WATCH_KEY)
          }
        } catch { /* ignore migration errors */ }
      } else {
        setWatchlistError(true)
      }
      setLoading(false)
    }
    load()
  }, [fetchPrices])

  useEffect(() => {
    if (showInput) setTimeout(() => inputRef.current?.focus(), 50)
  }, [showInput])

  useEffect(() => {
    // Network refresh intentionally updates the price state asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (baseSuggestions.length > 0) fetchPrices(baseSuggestions.map((suggestion) => suggestion.ticker))
  }, [baseSuggestions, fetchPrices])

  async function addTicker(nextTicker?: string) {
    const t = (nextTicker ?? input).trim().toUpperCase()
    setInput('')
    setShowInput(false)
    if (!t || rows.some((r) => r.ticker === t)) return
    setSaving(true)
    const priceResponse = await fetch(`/api/stock-price?tickers=${t}`)
    const priceData = priceResponse.ok ? await priceResponse.json() as Record<string, PriceData> : null
    if (!priceData?.[t]) {
      setSaving(false)
      toast.error('Không tìm thấy mã cổ phiếu')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('stock_watchlist')
      .insert({ ticker: t, user_id: user?.id ?? null })
      .select('id, ticker')
      .single()
    setSaving(false)
    if (error) { toast.error('Không thêm được'); return }
    setRows((prev) => [...prev, data as WatchRow])
    setPrices((prev) => ({ ...prev, ...priceData }))
  }

  useEffect(() => {
    addTickerRef.current = (ticker) => { void addTicker(ticker) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  async function removeTicker(id: string, ticker: string) {
    const { error } = await supabase.from('stock_watchlist').delete().eq('id', id)
    if (error) {
      toast.error('Không xoá được mã theo dõi')
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
    setPrices((p) => { const n = { ...p }; delete n[ticker]; return n })
  }

  return (
    <div className="rounded-xl border border-emerald-100 bg-white/60 px-4 py-3 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.1)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Theo dõi yêu thích</p>
          {loading && <RefreshCw className="size-3 animate-spin text-zinc-400" />}
        </div>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <button type="button" onClick={() => fetchPrices(rows.map((r) => r.ticker))}
              className="text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors">
              Làm mới
            </button>
          )}
          {showInput ? (
            <form onSubmit={(e) => { e.preventDefault(); addTicker() }} className="flex items-center gap-1.5">
              <input ref={inputRef} value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="VNM"
                maxLength={10}
                className="h-7 w-20 rounded-lg border border-emerald-300 bg-white px-2 text-xs font-bold tracking-wider text-zinc-900 outline-none focus:border-emerald-500"
              />
              <button type="submit" disabled={saving}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {saving ? '...' : 'Thêm'}
              </button>
              <button type="button" onClick={() => { setShowInput(false); setInput('') }}
                className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-50">
                Huỷ
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setShowInput(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors">
              <Plus className="size-3" /> Thêm mã
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-32 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100" />
          ))}
        </div>
      ) : watchlistError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <span>Không tải được watchlist.</span>
          <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">Thử lại</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-zinc-400">Chưa có mã nào. Nhấn <strong>+ Thêm mã</strong> để theo dõi giá yêu thích.</p>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {rows.map((r) => (
            <WatchCard key={r.id} ticker={r.ticker} pd={prices[r.ticker]}
              onRemove={() => removeTicker(r.id, r.ticker)} />
          ))}
        </div>
      )}

    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export function StocksPortfolio() {
  const [holdings, setHoldings] = useState<StockHolding[]>([])
  const [prices, setPrices] = useState<Record<string, PriceData>>({})
  const [loading, setLoading] = useState(true)
  const [fetchingPrices, setFetchingPrices] = useState(false)
  const [priceError, setPriceError] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StockHolding | null>(null)
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedTicker[]>([])
  const [addToWatchlist, setAddToWatchlist] = useState<(ticker: string) => void>(() => () => undefined)
  const registerWatchlistAction = useCallback((action: (ticker: string) => void) => {
    setAddToWatchlist(() => action)
  }, [])

  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [fTicker, setFTicker] = useState('')
  const [fCompany, setFCompany] = useState('')
  const [fShares, setFShares] = useState('')
  const [fAvgCost, setFAvgCost] = useState('')
  const [fSector, setFSector] = useState('')
  const [fNote, setFNote] = useState('')

  useEffect(() => {
    supabase
      .from('stock_holdings')
      .select('*')
      .order('created_at')
      .then(({ data, error }: { data: StockHolding[] | null; error: { message: string } | null }) => {
        if (error) toast.error('Không tải được danh mục')
        else setHoldings(data ?? [])
        setLoading(false)
      })
  }, [])

  const fetchPrices = useCallback(async (list: StockHolding[]) => {
    const tickers = [...new Set(list.map((h) => h.ticker))]
    if (tickers.length === 0) return
    setFetchingPrices(true)
    setPriceError(false)
    try {
      const res = await fetch(`/api/stock-price?tickers=${tickers.join(',')}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPrices(data as Record<string, PriceData>)
    } catch {
      setPriceError(true)
    } finally {
      setFetchingPrices(false)
    }
  }, [])

  useEffect(() => {
    // Network refresh intentionally updates the price state asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!loading && holdings.length > 0) fetchPrices(holdings)
  }, [loading, holdings, fetchPrices])

  const totalValue = useMemo(() => holdings.reduce((s, h) => s + h.shares * (prices[h.ticker]?.close ?? 0), 0), [holdings, prices])
  const totalCost = useMemo(() => holdings.reduce((s, h) => s + h.shares * h.avg_cost, 0), [holdings])
  const totalPnl = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  const rows = useMemo(() => {
    const computed = holdings.map((h, idx) => {
      const price = prices[h.ticker]?.close ?? 0
      const value = h.shares * price
      const cost = h.shares * h.avg_cost
      const pnl = value - cost
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
      const weight = totalValue > 0 ? (value / totalValue) * 100 : 0
      return { ...h, price, value, cost, pnl, pnlPct, weight, color: PALETTE[idx % PALETTE.length] }
    })
    return computed.sort((a, b) => {
      let diff = 0
      if (sortKey === 'ticker') diff = a.ticker.localeCompare(b.ticker)
      else if (sortKey === 'value') diff = a.value - b.value
      else if (sortKey === 'pnl') diff = a.pnl - b.pnl
      else if (sortKey === 'pnl_pct') diff = a.pnlPct - b.pnlPct
      else if (sortKey === 'weight') diff = a.weight - b.weight
      return sortDir === 'asc' ? diff : -diff
    })
  }, [holdings, prices, totalValue, sortKey, sortDir])

  const donutSlices = useMemo(() => {
    const nonZero = rows.filter((r) => r.value > 0)
    return nonZero.map((r) => ({ label: r.ticker, pct: r.value / totalValue, color: r.color }))
  }, [rows, totalValue])

  function openAdd() {
    setEditingId(null)
    setFTicker(''); setFCompany(''); setFShares(''); setFAvgCost(''); setFSector(''); setFNote('')
    setFormOpen(true)
  }

  function openEdit(h: StockHolding) {
    setEditingId(h.id)
    setFTicker(h.ticker); setFCompany(h.company_name ?? '')
    setFShares(String(h.shares)); setFAvgCost(String(h.avg_cost))
    setFSector(h.sector ?? ''); setFNote(h.note ?? '')
    setFormOpen(true)
  }

  function closeForm() { setFormOpen(false); setEditingId(null) }

  async function handleSave() {
    const ticker = fTicker.trim().toUpperCase()
    if (!ticker) { toast.error('Nhập mã cổ phiếu'); return }
    const shares = parseFloat(fShares.replace(',', '.'))
    const avgCost = parseFloat(fAvgCost.replace(',', '.'))
    if (isNaN(shares) || shares < 0) { toast.error('Số lượng không hợp lệ'); return }
    if (isNaN(avgCost) || avgCost < 0) { toast.error('Giá vốn không hợp lệ'); return }

    setSaving(true)
    const payload = {
      ticker, company_name: fCompany.trim() || null, shares, avg_cost: avgCost,
      sector: fSector || null, note: fNote.trim() || null, updated_at: new Date().toISOString(),
    }

    if (editingId) {
      const { error } = await supabase.from('stock_holdings').update(payload).eq('id', editingId)
      if (error) { toast.error('Lưu thất bại'); setSaving(false); return }
      setHoldings((prev) => prev.map((x) => (x.id === editingId ? { ...x, ...payload } : x)))
      toast.success('Đã cập nhật')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('stock_holdings')
        .insert({ ...payload, user_id: user?.id ?? null })
        .select().single()
      if (error) { toast.error('Thêm thất bại: ' + error.message); setSaving(false); return }
      const newList = [...holdings, data as StockHolding]
      setHoldings(newList)
      if (!prices[ticker]) fetchPrices(newList)
      toast.success(`Đã thêm ${ticker}`)
    }
    setSaving(false)
    closeForm()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('stock_holdings').delete().eq('id', deleteTarget.id)
    if (error) { toast.error('Xoá thất bại'); return }
    setHoldings((prev) => prev.filter((x) => x.id !== deleteTarget.id))
    toast.success(`Đã xoá ${deleteTarget.ticker}`)
    setDeleteTarget(null)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const inputCls = 'h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 transition-colors'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400">
        <RefreshCw className="mr-2 size-4 animate-spin" />
        <span className="text-sm">Đang tải danh mục...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-poppins text-base font-semibold text-zinc-900">Danh mục cổ phiếu</h2>
          <p className="text-xs text-zinc-500">Giá tự động từ Yahoo Finance · Dữ liệu cá nhân</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fetchPrices(holdings)}
            disabled={fetchingPrices || holdings.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40">
            <RefreshCw className={`size-3.5 ${fetchingPrices ? 'animate-spin' : ''}`} />
            {fetchingPrices ? 'Đang lấy giá...' : 'Làm mới giá'}
          </button>
          <button type="button" onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
            <Plus className="size-3.5" /> Thêm mã
          </button>
        </div>
      </div>

      {/* Watchlist */}
      <WatchlistSection
        onSuggestionsChange={setSuggestions}
        onWatchlistActionChange={registerWatchlistAction}
      />

      {/* Summary */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Giá trị TT" value={compact(totalValue)} sub={`${fmt(totalValue)}đ`} accent="text-zinc-900" />
          <StatCard label="Vốn đầu tư" value={compact(totalCost)} sub={`${fmt(totalCost)}đ`} accent="text-blue-600" />
          <StatCard label="Lãi / Lỗ"
            value={(totalPnl >= 0 ? '+' : '') + compact(totalPnl)}
            sub={(totalPnlPct >= 0 ? '+' : '') + totalPnlPct.toFixed(2) + '%'}
            accent={pnlCls(totalPnl)} />
          <StatCard label="Số mã" value={String(holdings.length)} sub={`${donutSlices.length} đang có giá`} accent="text-purple-600" />
        </div>
      )}

      {priceError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <AlertCircle className="size-4 shrink-0" />
          Không lấy được giá danh mục. Nhấn &quot;Làm mới giá&quot; để thử lại.
        </div>
      )}

      {holdings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-emerald-200 bg-white py-20 text-center">
          <BarChart2 className="size-12 text-emerald-200" />
          <div>
            <p className="font-semibold text-zinc-700">Chưa có cổ phiếu nào</p>
            <p className="mt-1 text-sm text-zinc-400">Thêm mã để bắt đầu theo dõi danh mục của bạn</p>
          </div>
          <button type="button" onClick={openAdd}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Thêm cổ phiếu đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
          {/* Holdings table */}
          <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.15)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-emerald-100 bg-emerald-50/40">
                    <SortableHeader label="Mã" col="ticker" current={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500">Công ty</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-zinc-500">Số CP</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-zinc-500">GVB (đ)</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-zinc-500">Giá TT (đ)</th>
                    <SortableHeader label="Giá trị" col="value" current={sortKey} dir={sortDir} onToggle={toggleSort} right />
                    <SortableHeader label="Lãi/Lỗ" col="pnl" current={sortKey} dir={sortDir} onToggle={toggleSort} right />
                    <SortableHeader label="L/L%" col="pnl_pct" current={sortKey} dir={sortDir} onToggle={toggleSort} right />
                    <SortableHeader label="Tỉ trọng" col="weight" current={sortKey} dir={sortDir} onToggle={toggleSort} right />
                    <th className="w-16 px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {rows.map((r) => {
                    const pd = prices[r.ticker]
                    return (
                      <tr key={r.id} className="group transition-colors hover:bg-zinc-50/70">
                        <td className="px-3 py-3">
                          <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold tracking-wide"
                            style={{ background: r.color + '20', color: r.color }}>
                            {r.ticker}
                          </span>
                        </td>
                        <td className="max-w-[110px] truncate px-3 py-3 text-xs text-zinc-500">
                          {r.company_name ?? <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-xs tabular-nums text-zinc-700">
                          {r.shares > 0 ? r.shares.toLocaleString('vi-VN') : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-xs tabular-nums text-zinc-600">
                          {r.avg_cost > 0 ? fmt(r.avg_cost) : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {r.price > 0 ? (
                            <div>
                              <div className="text-xs font-semibold tabular-nums text-zinc-800">{fmt(r.price)}</div>
                              {pd && (
                                <div className={`text-[10px] tabular-nums ${pd.pct_change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {pd.pct_change >= 0 ? '+' : ''}{pd.pct_change.toFixed(2)}%
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-medium tabular-nums text-zinc-800">
                          {r.value > 0 ? compact(r.value) : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className={`px-3 py-3 text-right text-xs font-semibold tabular-nums ${pnlCls(r.pnl)}`}>
                          {r.cost > 0 && r.value > 0 ? (r.pnl >= 0 ? '+' : '') + compact(r.pnl) : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className={`px-3 py-3 text-right text-xs font-semibold tabular-nums ${pnlCls(r.pnlPct)}`}>
                          {r.cost > 0 && r.value > 0 ? (r.pnlPct >= 0 ? '+' : '') + r.pnlPct.toFixed(2) + '%' : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          {r.value > 0 ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="h-1.5 w-10 overflow-hidden rounded-full bg-zinc-100">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(r.weight, 100)}%`, background: r.color }} />
                              </div>
                              <span className="w-9 text-right text-[11px] tabular-nums text-zinc-500">{r.weight.toFixed(1)}%</span>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button type="button" onClick={() => openEdit(r)}
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                              <Pencil className="size-3.5" />
                            </button>
                            <button type="button" onClick={() => setDeleteTarget(r)}
                              className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalValue > 0 && (
              <div className="flex items-center justify-between border-t border-emerald-100 bg-emerald-50/30 px-4 py-2.5">
                <span className="text-xs font-semibold text-zinc-600">Tổng cộng</span>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-xs text-zinc-500">Giá trị: </span>
                    <span className="text-xs font-bold text-zinc-800">{compact(totalValue)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500">L/L: </span>
                    <span className={`text-xs font-bold ${pnlCls(totalPnl)}`}>
                      {totalPnl >= 0 ? '+' : ''}{compact(totalPnl)} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {donutSlices.length > 0 && (
              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.15)]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Phân bổ danh mục</p>
                <div className="flex flex-col items-center gap-4">
                  <DonutChart slices={donutSlices} />
                  <div className="w-full space-y-2">
                    {rows.filter((r) => r.value > 0).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="size-2 shrink-0 rounded-sm" style={{ background: r.color }} />
                          <span className="truncate text-xs font-medium text-zinc-700">{r.ticker}</span>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-zinc-500">{r.weight.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {holdings.some((h) => h.sector) && (
              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.15)]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Theo ngành</p>
                <div className="space-y-2">
                  {Object.entries(
                    rows.reduce<Record<string, number>>((acc, r) => {
                      const sec = r.sector ?? 'Chưa phân loại'
                      acc[sec] = (acc[sec] ?? 0) + r.value
                      return acc
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).map(([sec, val]) => (
                    <div key={sec} className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-zinc-600">{sec}</span>
                      <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-800">{compact(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-[0_8px_24px_-8px_rgba(251,191,36,0.2)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-amber-500" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Gợi ý tiềm năng</p>
            </div>
            <span className="text-[10px] text-zinc-400">Gợi ý mẫu, không phải lời khuyên đầu tư</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.ticker}
                suggestion={suggestion}
                onAdd={() => addToWatchlist(suggestion.ticker)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm() }}>
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h3 className="font-poppins text-base font-semibold text-zinc-900">
                {editingId ? 'Sửa cổ phiếu' : 'Thêm cổ phiếu'}
              </h3>
              <button type="button" onClick={closeForm} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
                  Mã cổ phiếu *
                  <input value={fTicker} onChange={(e) => setFTicker(e.target.value.toUpperCase())}
                    placeholder="VNM" maxLength={10} className={inputCls + ' font-bold tracking-wider'} />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
                  Số lượng CP *
                  <input type="number" value={fShares} onChange={(e) => setFShares(e.target.value)}
                    placeholder="1000" min="0" step="1" className={inputCls} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
                  Giá vốn bình quân (đ)
                  <input type="number" value={fAvgCost} onChange={(e) => setFAvgCost(e.target.value)}
                    placeholder="50000" min="0" className={inputCls} />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
                  Ngành
                  <select value={fSector} onChange={(e) => setFSector(e.target.value)} className={inputCls}>
                    {SECTORS.map((s) => (<option key={s} value={s}>{s || '— Chọn ngành —'}</option>))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
                Tên công ty
                <input value={fCompany} onChange={(e) => setFCompany(e.target.value)}
                  placeholder="Vinamilk" className={inputCls} />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
                Ghi chú
                <input value={fNote} onChange={(e) => setFNote(e.target.value)}
                  placeholder="Ghi chú thêm..." className={inputCls} />
              </label>
            </div>

            <div className="flex gap-2.5 border-t border-zinc-100 px-5 py-4">
              <button type="button" onClick={closeForm}
                className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
                Huỷ
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm vào danh mục'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        itemContent={deleteTarget?.ticker ?? ''}
        itemMeta={deleteTarget?.company_name ?? undefined}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
