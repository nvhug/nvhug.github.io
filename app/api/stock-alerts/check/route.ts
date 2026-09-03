import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { alertArrow, alertTeamsColor, formatPct, formatVNPrice } from './utils'

export const runtime = 'nodejs'

const ALERT_THRESHOLD_PCT = 5

type PriceSnapshot = { close: number; pct_change: number }
type AlertItem = { ticker: string; pct_change: number; price: number; direction: 'rise' | 'fall' }

// Yahoo Finance fetch — mirrors /api/stock-price logic
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

async function fetchTickerPrice(ticker: string): Promise<PriceSnapshot | null> {
  for (const suffix of ['.VN', '.HNX', '']) {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}${suffix}?interval=1d&range=2d`
    try {
      const res = await fetch(url, { headers: YF_HEADERS })
      if (!res.ok) continue
      const json = await res.json()
      const result = json?.chart?.result?.[0]
      const meta = result?.meta
      if (!meta?.regularMarketPrice) continue
      const close = meta.regularMarketPrice as number
      const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
      const prevClose = closes.find((c) => c !== null && c > 0) ?? (meta.previousClose as number) ?? close
      const pct_change = prevClose !== 0 ? ((close - prevClose) / prevClose) * 100 : 0
      return { close, pct_change }
    } catch { /* try next suffix */ }
  }
  return null
}

async function sendTeamsAlert(alerts: AlertItem[]) {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL
  if (!webhookUrl) return
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: 'Cảnh báo giá cổ phiếu', size: 'Large', weight: 'Bolder' },
            {
              type: 'TextBlock',
              text: `Biến động ≥ ${ALERT_THRESHOLD_PCT}% so với phiên trước`,
              isSubtle: true,
              size: 'Small',
              spacing: 'None',
            },
            ...alerts.map((a) => ({
              type: 'TextBlock',
              text: `**${a.ticker}**  ${alertArrow(a.direction)} ${formatPct(a.pct_change)}%  —  ${formatVNPrice(a.price)}đ`,
              color: alertTeamsColor(a.direction),
              spacing: 'Small',
              wrap: true,
            })),
          ],
        },
      }],
    }),
  })
}

async function sendEmailAlert(alerts: AlertItem[]) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL_TO
  const from = process.env.ALERT_EMAIL_FROM ?? 'alerts@notez.vn'
  if (!apiKey || !to) return

  const rows = alerts.map((a) => `
    <tr style="border-top:1px solid #f4f4f5">
      <td style="padding:8px 12px;font-weight:700;font-size:14px">${a.ticker}</td>
      <td style="padding:8px 12px;color:${a.direction === 'rise' ? '#059669' : '#e11d48'};font-weight:700;font-size:14px">
        ${alertArrow(a.direction)} ${formatPct(a.pct_change)}%
      </td>
      <td style="padding:8px 12px;font-size:14px;color:#3f3f46">${formatVNPrice(a.price)}đ</td>
    </tr>`).join('')

  await new Resend(apiKey).emails.send({
    from,
    to,
    subject: `📊 Cảnh báo giá: ${alerts.map((a) => a.ticker).join(', ')}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 4px">Cảnh báo giá cổ phiếu</h2>
        <p style="color:#71717a;font-size:13px;margin:0 0 20px">Biến động ≥ ${ALERT_THRESHOLD_PCT}% so với phiên trước</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Mã CK</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Biến động</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Giá</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px;font-size:11px;color:#a1a1aa">
          ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} ICT
        </p>
      </div>`,
  })
}

async function runStockAlertCheck(request: Request) {
  const secret = process.env.ALERT_SECRET
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: watchlist, error: wErr } = await supabase
    .from('stock_watchlist')
    .select('ticker')
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })
  if (!watchlist?.length) return NextResponse.json({ message: 'Watchlist trống' })

  const tickers = [...new Set(watchlist.map((r: { ticker: string }) => r.ticker))]

  const priceResults = await Promise.allSettled(tickers.map((t) => fetchTickerPrice(t)))
  const prices: Record<string, PriceSnapshot> = {}
  tickers.forEach((t, i) => {
    const r = priceResults[i]
    if (r.status === 'fulfilled' && r.value) prices[t] = r.value
  })

  // Avoid duplicate alerts within 4h for same ticker+direction
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('stock_alert_log')
    .select('ticker, direction')
    .gte('notified_at', since)

  const recentSet = new Set((recent ?? []).map((a: { ticker: string; direction: string }) => `${a.ticker}:${a.direction}`))

  const alerts: AlertItem[] = tickers
    .filter((t) => prices[t] && Math.abs(prices[t].pct_change) >= ALERT_THRESHOLD_PCT)
    .map((t) => ({ ticker: t, pct_change: prices[t].pct_change, price: prices[t].close, direction: prices[t].pct_change >= 0 ? 'rise' : 'fall' } as AlertItem))
    .filter((a) => !recentSet.has(`${a.ticker}:${a.direction}`))

  if (alerts.length === 0) {
    return NextResponse.json({ message: 'Không có cảnh báo mới', checked: tickers.length })
  }

  await Promise.allSettled([
    sendTeamsAlert(alerts),
    sendEmailAlert(alerts),
    supabase.from('stock_alert_log').insert(
      alerts.map((a) => ({ ticker: a.ticker, pct_change: a.pct_change, price: a.price, direction: a.direction })),
    ),
  ])

  return NextResponse.json({
    message: `Đã gửi ${alerts.length} cảnh báo`,
    alerts: alerts.map((a) => ({ ticker: a.ticker, pct: `${a.pct_change.toFixed(2)}%`, direction: a.direction })),
  })
}

export async function GET(request: Request) {
  return runStockAlertCheck(request)
}

export async function POST(request: Request) {
  return runStockAlertCheck(request)
}
