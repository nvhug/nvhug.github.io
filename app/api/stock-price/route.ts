import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

type PriceData = {
  close: number
  change: number
  pct_change: number
  date: string
  volume?: number
  high?: number
  low?: number
}

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

async function fetchTicker(ticker: string): Promise<PriceData | null> {
  // Try .VN (HOSE) first, fall back to .HNX, then bare ticker
  const suffixes = ['.VN', '.HNX', '']
  for (const suffix of suffixes) {
    const symbol = `${ticker}${suffix}`
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`
    try {
      const res = await fetch(url, { headers: YF_HEADERS })
      if (!res.ok) continue
      const json = await res.json()
      const result = json?.chart?.result?.[0]
      const meta = result?.meta
      if (!meta?.regularMarketPrice) continue

      const close = meta.regularMarketPrice as number

      // closes[0] = yesterday's close = correct reference price
      // chartPreviousClose with range=5d would be 5 days ago — wrong
      const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
      const prevClose = closes.find((c) => c !== null && c > 0) ?? (meta.previousClose as number | undefined) ?? close
      const change = close - prevClose
      const pct_change = prevClose !== 0 ? (change / prevClose) * 100 : 0

      const t = meta.regularMarketTime as number | undefined
      const date = t ? new Date(t * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)

      return {
        close,
        change,
        pct_change,
        date,
        volume: meta.regularMarketVolume as number | undefined,
        high: meta.regularMarketDayHigh as number | undefined,
        low: meta.regularMarketDayLow as number | undefined,
      }
    } catch {
      // try next suffix
    }
  }
  return null
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tickers')
  if (!raw) return NextResponse.json({ error: 'Missing tickers' }, { status: 400 })

  const tickers = raw
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^[A-Z0-9]{1,10}$/.test(t))

  if (tickers.length === 0) return NextResponse.json({ error: 'No valid tickers' }, { status: 400 })

  const results = await Promise.allSettled(tickers.map((t) => fetchTicker(t)))

  const result: Record<string, PriceData> = {}
  for (let i = 0; i < tickers.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled' && r.value) {
      result[tickers[i]] = r.value
    }
  }

  if (Object.keys(result).length === 0) {
    return NextResponse.json({ error: 'No price data found' }, { status: 502 })
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  })
}
