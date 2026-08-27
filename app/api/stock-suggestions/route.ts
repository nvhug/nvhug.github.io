import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { logAiUsage, normalizeUsage, servedModel } from '@/lib/ai-usage'

const suggestedTickerSchema = z.object({
  ticker: z.string().min(1),
  sentiment: z.enum(['Tăng', 'Đi ngang', 'Cân nhắc']),
  reason: z.string(),
  currentPrice: z.number().positive(),
  targetPrice: z.number().positive(),
  catalyst: z.string(),
  targetUpdatedAt: z.string(),
})

export const runtime = 'nodejs'

// Default VN large-cap universe. The UI can override this list per generation.
export const DEFAULT_SCREENER_TICKERS = [
  'VCB', 'TCB', 'BID', 'CTG', 'MBB', 'VPB', 'ACB', 'HDB', 'STB', 'VIB', 'EIB', 'MSB', 'LPB', 'OCB', 'SHB',
  'VHM', 'VIC', 'NVL', 'KDH', 'DXG', 'NLG', 'PDR', 'BCM',
  'SSI', 'VND', 'HCM', 'VCI', 'FTS', 'MBS',
  'MWG', 'PNJ', 'MSN', 'VNM', 'SAB',
  'FPT', 'CMG',
  'HPG', 'HSG', 'NKG', 'GVR', 'DGC',
  'PLX', 'GAS', 'POW', 'PVD',
  'DHG', 'IMP', 'VRE', 'REE', 'VHC',
]

const MAX_SCREENER_TICKERS = 50

function normalizeTickers(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SCREENER_TICKERS]
  return [...new Set(value
    .filter((ticker): ticker is string => typeof ticker === 'string')
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => /^[A-Z0-9]{2,5}$/.test(ticker)))]
    .slice(0, MAX_SCREENER_TICKERS)
}

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

type TickerStats = {
  ticker: string
  currentPrice: number
  change1MPct: number | null
  change3MPct: number | null
  change6MPct: number | null
  high52W: number | null
  pos52WPct: number | null
  volumeTrendPct: number | null
}

async function fetchWeeklyStats(ticker: string): Promise<TickerStats | null> {
  for (const suffix of ['.VN', '.HNX', '']) {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}${suffix}?interval=1wk&range=1y`
    try {
      const res = await fetch(url, { headers: YF_HEADERS })
      if (!res.ok) continue
      const json = await res.json() as { chart?: { result?: { meta?: Record<string, unknown>; indicators?: { quote?: { close?: (number | null)[]; volume?: (number | null)[] }[] } }[] } }
      const result = json?.chart?.result?.[0]
      if (!result) continue

      const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []
      const volumes: (number | null)[] = result.indicators?.quote?.[0]?.volume ?? []

      const valid = closes
        .map((c, i) => ({ price: c, vol: volumes[i] ?? null }))
        .filter((item): item is { price: number; vol: number | null } => typeof item.price === 'number' && item.price > 0)

      if (valid.length < 8) continue

      const n = valid.length
      const currentPrice = (result.meta?.regularMarketPrice as number | undefined) ?? valid[n - 1].price

      const pct = (base: number | null) => base && base !== 0 ? ((currentPrice - base) / base) * 100 : null

      const prices = valid.map((item) => item.price)
      const high52W = Math.max(...prices)
      const low52W = Math.min(...prices)
      const pos52WPct = high52W !== low52W ? ((currentPrice - low52W) / (high52W - low52W)) * 100 : null

      const validVols = valid.map((item) => item.vol).filter((v): v is number => typeof v === 'number' && v > 0)
      const recentAvg = validVols.slice(-4).reduce((a, b) => a + b, 0) / Math.max(validVols.slice(-4).length, 1)
      const olderVols = validVols.slice(-13, -4)
      const olderAvg = olderVols.length > 0 ? olderVols.reduce((a, b) => a + b, 0) / olderVols.length : null
      const volumeTrendPct = olderAvg && olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : null

      return {
        ticker,
        currentPrice,
        change1MPct: pct(valid[Math.max(0, n - 5)]?.price ?? null),
        change3MPct: pct(valid[Math.max(0, n - 14)]?.price ?? null),
        change6MPct: pct(valid[Math.max(0, n - 27)]?.price ?? null),
        high52W,
        pos52WPct,
        volumeTrendPct,
      }
    } catch { /* try next suffix */ }
  }
  return null
}

function validateAscii(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not set`)
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 127) {
      throw new Error(`${name} contains non-ASCII character at position ${i} (value ${value.charCodeAt(i)}) — re-copy it from the Supabase dashboard`)
    }
  }
  return value
}

function adminClient() {
  const url = validateAscii(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  const key = validateAscii(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// GET: return latest cached suggestions
export async function GET() {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('stock_suggestions_cache')
    .select('suggestions, generated_at, ticker_count')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ suggestions: [], generatedAt: null, screenerTickers: DEFAULT_SCREENER_TICKERS })
  return NextResponse.json({ suggestions: data.suggestions, generatedAt: data.generated_at, tickerCount: data.ticker_count, screenerTickers: DEFAULT_SCREENER_TICKERS })
}

// POST: generate new AI suggestions. Admin-only, and only on an explicit button press.
//
// There is deliberately no scheduled path any more. Generating on a timer meant paying for
// a completion nobody had asked for, on a schedule that happened to sit inside DeepSeek's
// peak window — double rate, for suggestions that might never be read. Everyone else reads
// the cached result through GET; only an admin decides when a fresh one is worth buying.
//
// The ALERT_SECRET bypass went with it. Keeping a secret that grants unauthenticated
// generation, for a feature now restricted to one role, is an auth surface with no
// remaining purpose. (The secret itself lives on: stock-alerts/check still uses it.)
//
// Uses adminClient().auth.getUser(token) to avoid createSupabaseServerClient's Set-Cookie
// which can contain non-Latin-1 characters and fail ByteString validation in fetch headers.
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')

  let callerUserId: string | null = null
  let callerRole: string = 'user'

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user } } = await adminClient().auth.getUser(token)
    if (user) {
      callerUserId = user.id
      const { data: profile } = await adminClient()
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      callerRole = profile?.role ?? 'user'
    }
  }

  if (!callerUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Enforced here, not only in the UI. StockWatchlist already hides the button from
  // non-admins, but a hidden button is not a permission: without this check any signed-in
  // account could POST directly and spend a generation.
  if (callerRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // No trial quota here any more. `checkAITrialQuota` is a lifetime free trial that
  // converts a `user` into a paying one, and it returns unlimited for `admin` — so with
  // the route restricted to admins it was a database round-trip that could only ever pass,
  // guarding a path no trial user can reach. The 402 / upgrade-modal branch went with it.
  // If generation is ever opened up beyond admins, the quota comes back with it.

  let requestedTickers: unknown
  try {
    requestedTickers = (await request.json() as { tickers?: unknown }).tickers
  } catch {
    requestedTickers = undefined
  }
  const screenerTickers = normalizeTickers(requestedTickers)
  if (screenerTickers.length < 5) {
    return NextResponse.json({ error: 'Cần ít nhất 5 mã cổ phiếu hợp lệ để phân tích' }, { status: 400 })
  }

  const supabase = adminClient()

  // Rate limit: max 3 generations per 8 hours
  const since = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('stock_suggestions_cache')
    .select('id', { count: 'exact', head: true })
    .gte('generated_at', since)
  if (count && count >= 3) {
    return NextResponse.json({ error: 'Đã tạo quá nhiều lần trong 8 giờ qua. Thử lại sau.' }, { status: 429 })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })

  // Fetch in batches of 15 to avoid IP-level rate limiting on Yahoo Finance
  const stats: TickerStats[] = []
  for (let i = 0; i < screenerTickers.length; i += 15) {
    const chunk = screenerTickers.slice(i, i + 15)
    const chunkResults = await Promise.allSettled(chunk.map((t) => fetchWeeklyStats(t)))
    for (const r of chunkResults) {
      if (r.status === 'fulfilled' && r.value) stats.push(r.value)
    }
    if (i + 15 < screenerTickers.length) await new Promise<void>((resolve) => setTimeout(resolve, 200))
  }

  if (stats.length < 5) {
    return NextResponse.json({ error: `Không đủ dữ liệu (${stats.length}/${screenerTickers.length} tickers)` }, { status: 502 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const fmt = (v: number | null) => v !== null ? `${v.toFixed(1)}%` : 'N/A'

  const dataLines = stats
    .map((s) => `${s.ticker}: giá=${s.currentPrice.toLocaleString('vi-VN')}đ | 1T=${fmt(s.change1MPct)} | 3T=${fmt(s.change3MPct)} | 6T=${fmt(s.change6MPct)} | pos52w=${fmt(s.pos52WPct)} | volTrend=${fmt(s.volumeTrendPct)}`)
    .join('\n')

  const prompt = `Bạn là chuyên gia quản lý danh mục top 1% thị trường chứng khoán Việt Nam, chuyên phân tích kỹ thuật định lượng và momentum investing. Mọi nhận định PHẢI dựa trực tiếp vào số liệu đầu vào — không cảm tính.

=== DỮ LIỆU KỸ THUẬT ${today} (${stats.length} mã) ===
${dataLines}

Chú thích: pos52w = vị trí giá trong dải 52 tuần (0%=đáy, 100%=đỉnh) | volTrend = xu hướng khối lượng gần đây vs trước | 1T/3T/6T = biến động 1/3/6 tháng

NHIỆM VỤ: Chọn chính xác 6 mã có tiềm năng risk-adjusted return tốt nhất, đảm bảo đa dạng ngành (tối đa 2 mã/ngành).

QUY TẮC LỌC (theo thứ tự ưu tiên):
1. Momentum đồng thuận: ít nhất 2/3 trong 1T, 3T, 6T đều dương (1T và 3T ưu tiên hơn)
2. Volume xác nhận: volTrend > 0% (dòng tiền đang vào)
3. Định giá kỹ thuật: pos52w trong khoảng 20%-85% (không overbought, không downtrend rõ)
4. Đa dạng ngành: tối đa 2 mã từ cùng nhóm ngành
5. Loại bỏ mã có cả 3T và 6T đều âm

TÍNH GIÁ MỤC TIÊU (dùng công thức sau, dựa trên dữ liệu):
- Nếu pos52w < 70%: targetPrice = high52W × 0.92 (hướng đến kháng cự gần đỉnh 52 tuần)
- Nếu pos52w >= 70%: targetPrice = currentPrice × 1.08 (mở rộng kỹ thuật 8%)
- Làm tròn đến hàng trăm gần nhất

Trả về CHỈ JSON hợp lệ (không markdown, không giải thích):
{
  "suggestions": [
    {
      "ticker": "MÃ_CK",
      "sentiment": "Tăng",
      "reason": "Momentum 3T +X.X% và 6T +Y.Y% đồng thuận tăng; volTrend +Z.Z% xác nhận dòng tiền tích cực.",
      "currentPrice": 85000,
      "targetPrice": 92000,
      "catalyst": "Một câu mô tả yếu tố kỹ thuật hoặc momentum kích hoạt.",
      "targetUpdatedAt": "${today}"
    }
  ]
}`

  // Before the call. This one matters most of the six: the cron fires at 02:00 UTC, inside
  // DeepSeek's 01:00-04:00 peak window, so pricing off the response time is the difference
  // between reporting half the bill and reporting it.
  const startedAt = new Date()

  let aiRes: Response
  try {
    aiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        // v4-flash reasons by default and spends those tokens out of max_tokens before
        // producing any content. This budget is the smallest in the codebase and predates
        // the model switch, so leaving thinking on empties it before a single suggestion.
        thinking: { type: 'disabled' },
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(50_000),
    })
  } catch {
    return NextResponse.json({ error: 'AI không phản hồi. Vui lòng thử lại sau.' }, { status: 504 })
  }

  if (!aiRes.ok) {
    const err = await aiRes.text()
    return NextResponse.json({ error: `DeepSeek error: ${err}` }, { status: 502 })
  }

  const aiData = await aiRes.json() as { choices?: { message?: { content?: string } }[] }

  // Always a real admin now that the scheduled path is gone, so there is no 'system' actor
  // from this route. The outcome is decided by the validation below, not assumed here:
  // every rejection past this point follows a completion that already arrived and was
  // billed (FR-005a).
  const recordUsage = (outcome: 'success' | 'error') =>
    logAiUsage({
      surface: 'stock_suggestions',
      provider: 'deepseek',
      model: servedModel(aiData, 'deepseek-v4-flash'),
      usage: normalizeUsage((aiData as { usage?: unknown }).usage, 'deepseek'),
      outcome,
      userId: callerUserId,
      actor: 'user',
      at: startedAt,
    })

  const content = aiData.choices?.[0]?.message?.content
  if (!content) {
    await recordUsage('error')
    return NextResponse.json({ error: 'Empty AI response' }, { status: 502 })
  }

  let parsed: { suggestions?: unknown[] }
  try {
    parsed = JSON.parse(content) as { suggestions?: unknown[] }
  } catch {
    await recordUsage('error')
    return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 502 })
  }

  const rawSuggestions = parsed.suggestions
  if (!Array.isArray(rawSuggestions) || rawSuggestions.length === 0) {
    await recordUsage('error')
    return NextResponse.json({ error: 'AI returned no suggestions' }, { status: 502 })
  }

  const suggestions = rawSuggestions
    .map((s) => suggestedTickerSchema.safeParse(s))
    .filter((r) => r.success)
    .map((r) => r.data)

  if (suggestions.length === 0) {
    await recordUsage('error')
    return NextResponse.json({ error: 'AI returned no valid suggestions' }, { status: 502 })
  }

  await recordUsage('success')

  const { error: insertError } = await supabase
    .from('stock_suggestions_cache')
    .insert({ suggestions, ticker_count: screenerTickers.length })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Keep only the latest 10 rows
  const { data: allRows } = await supabase
    .from('stock_suggestions_cache')
    .select('id')
    .order('generated_at', { ascending: false })
  if (allRows && allRows.length > 10) {
    const toDelete = (allRows as { id: string }[]).slice(10).map((r) => r.id)
    await supabase.from('stock_suggestions_cache').delete().in('id', toDelete)
  }

  return NextResponse.json({ message: 'Đã tạo gợi ý mới', count: suggestions.length, suggestions })
}
