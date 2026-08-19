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

export type DailyPricePoint = {
  date: string
  close: number
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

// Yahoo silently coarsens interval=1d to monthly bars when range=max is used,
// so fetch true daily bars for the recent window and stitch on monthly bars for older history.
async function fetchChartPoints(symbol: string, interval: string, range: string): Promise<DailyPricePoint[] | null> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`
  const res = await fetch(url, { headers: YF_HEADERS })
  if (!res.ok) return null
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const timestamps: number[] = result?.timestamp ?? []
  const quote = result?.indicators?.quote?.[0] ?? {}
  const closes: (number | null)[] = quote.close ?? []
  const volumes: (number | null)[] = quote.volume ?? []
  const highs: (number | null)[] = quote.high ?? []
  const lows: (number | null)[] = quote.low ?? []

  const points: DailyPricePoint[] = []
  timestamps.forEach((timestamp, index) => {
    const close = closes[index]
    if (typeof close !== 'number' || close <= 0) return
    points.push({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close,
      volume: typeof volumes[index] === 'number' ? volumes[index]! : undefined,
      high: typeof highs[index] === 'number' ? highs[index]! : undefined,
      low: typeof lows[index] === 'number' ? lows[index]! : undefined,
    })
  })
  return points.length > 0 ? points : null
}

async function fetchDailyHistory(ticker: string): Promise<DailyPricePoint[] | null> {
  const suffixes = ['.VN', '.HNX', '']
  for (const suffix of suffixes) {
    const symbol = `${ticker}${suffix}`
    try {
      const dailyPoints = await fetchChartPoints(symbol, '1d', '10y')
      if (!dailyPoints) continue

      let monthlyPoints: DailyPricePoint[] | null = null
      try {
        monthlyPoints = await fetchChartPoints(symbol, '1mo', 'max')
      } catch {
        // long-term history is best-effort; daily window still returned below
      }

      const earliestDaily = dailyPoints[0].date
      return monthlyPoints
        ? [...monthlyPoints.filter((p) => p.date < earliestDaily), ...dailyPoints]
        : dailyPoints
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

  if (req.nextUrl.searchParams.get('history') === 'daily') {
    const history = await fetchDailyHistory(tickers[0])
    if (!history) return NextResponse.json({ error: 'No historical data found' }, { status: 502 })
    return NextResponse.json({ ticker: tickers[0], points: history }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' },
    })
  }

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
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
