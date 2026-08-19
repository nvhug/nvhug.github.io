// Shared domain types for the stock portfolio tab (holdings, watchlist, chart, modal).

export type StockHolding = {
  id: string
  user_id: string | null
  ticker: string
  company_name: string | null
  shares: number
  avg_cost: number
  sector: string | null
  note: string | null
}

export type PriceData = {
  close: number
  change: number
  pct_change: number
  date: string
  volume?: number
  high?: number
  low?: number
}

export type DailyPricePoint = {
  date: string
  close: number
  volume?: number
  high?: number
  low?: number
}

export type WatchRow = { id: string; ticker: string }

export type SortKey = 'ticker' | 'value' | 'pnl' | 'pnl_pct' | 'weight'
export type SortDir = 'asc' | 'desc'

export const RANGE_KEYS = ['5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'ALL'] as const
export type RangeKey = typeof RANGE_KEYS[number]
