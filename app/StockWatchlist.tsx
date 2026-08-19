'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, RefreshCw, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getSuggestedTickers, getUpsidePct, MIN_SUGGESTION_UPSIDE_PCT, type SuggestedTicker } from './stockSuggestions'
import { fmt } from './stockChartUtils'
import { type PriceData, type WatchRow } from './stockTypes'

// localStorage key kept as migration fallback only
const WATCH_KEY = 'stock-watchlist-v1'

function activateOnEnterOrSpace(handler: () => void) {
  return (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handler()
    }
  }
}

// ── Watchlist card ─────────────────────────────────────────────
function WatchCard({ ticker, pd, onRemove, onSelect }: {
  ticker: string; pd: PriceData | undefined; onRemove: () => void; onSelect: () => void
}) {
  const isUp = pd ? pd.pct_change > 0 : null
  const isFlat = pd ? pd.pct_change === 0 : false
  const pctCls = isUp ? 'text-emerald-500' : isFlat ? 'text-zinc-400' : 'text-red-500'
  const topCls = isUp === null ? 'border-t-zinc-200' : isUp ? 'border-t-emerald-400' : isFlat ? 'border-t-zinc-300' : 'border-t-red-400'

  return (
    <button type="button" onClick={onSelect}
      className={`group relative shrink-0 w-20 rounded-lg border border-zinc-100 border-t-2 bg-white p-2 text-left transition-all hover:shadow-sm ${topCls}`}>
      <span onClick={(event) => { event.stopPropagation(); onRemove() }}
        onKeyDown={activateOnEnterOrSpace(onRemove)}
        role="button" tabIndex={0}
        className="absolute right-1 top-1 hidden text-zinc-300 hover:text-zinc-600 group-hover:block">
        <X className="size-2.5" />
      </span>

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
    </button>
  )
}

function SuggestionCard({ suggestion, onAdd, onSelect, disabled }: {
  suggestion: SuggestedTicker
  onAdd: () => void
  onSelect: () => void
  disabled?: boolean
}) {
  const sentimentCls = suggestion.sentiment === 'Tăng'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : suggestion.sentiment === 'Đi ngang'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-sky-50 text-sky-700 border-sky-200'

  const upsidePct = getUpsidePct(suggestion)

  return (
    <div onClick={onSelect} onKeyDown={activateOnEnterOrSpace(onSelect)} role="button" tabIndex={0}
      className="cursor-pointer rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.18)] transition-shadow hover:shadow-[0_4px_16px_-4px_rgba(15,23,42,0.25)]">
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
        <button type="button" onClick={(event) => { event.stopPropagation(); onAdd() }} disabled={disabled}
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
export function WatchlistSection({
  onSuggestionsChange,
  onWatchlistActionChange,
  onSelectTicker,
}: {
  onSuggestionsChange?: (list: SuggestedTicker[]) => void
  onWatchlistActionChange?: (addTicker: (ticker: string) => void) => void
  onSelectTicker?: (ticker: string) => void
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
            <form onSubmit={(e) => { e.preventDefault(); void addTicker() }} className="flex items-center gap-1.5">
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
              onRemove={() => removeTicker(r.id, r.ticker)}
              onSelect={() => onSelectTicker?.(r.ticker)} />
          ))}
        </div>
      )}

    </div>
  )
}

// ── Sector suggestions section ─────────────────────────────────
export function SuggestionsSection({ suggestions, onAdd, onSelect }: {
  suggestions: SuggestedTicker[]
  onAdd: (ticker: string) => void
  onSelect: (ticker: string) => void
}) {
  if (suggestions.length === 0) return null
  return (
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
            onAdd={() => onAdd(suggestion.ticker)}
            onSelect={() => onSelect(suggestion.ticker)}
          />
        ))}
      </div>
    </div>
  )
}
