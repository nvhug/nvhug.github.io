import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { stockAnalysisSchema } from './schema'
import { cooldownMetadata } from './cooldown'

export const runtime = 'nodejs'

type StoredAnalysis = {
  result: unknown
  analyzed_at: string
}

async function getStoredAnalysis(userId: string, ticker: string): Promise<StoredAnalysis | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('stock_analysis_history')
    .select('result, analyzed_at')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .maybeSingle()

  if (error) throw error
  return data as StoredAnalysis | null
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticker = new URL(request.url).searchParams.get('ticker')?.trim().toUpperCase()
  if (!ticker || !/^[A-Z0-9]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  try {
    const stored = await getStoredAnalysis(user.id, ticker)
    if (!stored) return NextResponse.json({ analysis: null, canAnalyze: true })
    return NextResponse.json({ analysis: stored.result, ...cooldownMetadata(stored.analyzed_at) })
  } catch (error) {
    console.error('[stock-analysis] cache read failed:', error)
    return NextResponse.json({ error: 'Không tải được phân tích đã lưu.' }, { status: 500 })
  }
}

type AnalyzeRequest = {
  ticker: string
  companyName: string | null
  stats: {
    currentPrice: number
    change1M: number | null
    change3M: number | null
    change6M: number | null
    changeYTD: number | null
    change1Y: number | null
    change5Y: number | null
    allTimeHigh: number | null
    allTimeLow: number | null
    distanceFromHighPct: number | null
    avgVolume30d: number | null
    volumeTrendPct: number | null
    volatility30dPct: number | null
    maxDrawdown1YPct: number | null
    positiveDays30Pct: number | null
    positionInAllTimeRangePct: number | null
    high52Week: number | null
    low52Week: number | null
    dataFrom: string
    dataTo: string
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: AnalyzeRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { ticker, companyName, stats } = body
  const normalizedTicker = ticker?.trim().toUpperCase()
  if (!normalizedTicker || !/^[A-Z0-9]{1,10}$/.test(normalizedTicker) || !stats) {
    return NextResponse.json({ error: 'Missing or invalid ticker/stats' }, { status: 400 })
  }

  let stored: StoredAnalysis | null
  try {
    stored = await getStoredAnalysis(user.id, normalizedTicker)
  } catch (error) {
    console.error('[stock-analysis] cooldown read failed:', error)
    return NextResponse.json({ error: 'Không kiểm tra được lịch sử phân tích.' }, { status: 500 })
  }

  if (stored) {
    const metadata = cooldownMetadata(stored.analyzed_at)
    if (!metadata.canAnalyze) {
      const retryAfterSeconds = Math.ceil((new Date(metadata.nextAnalyzeAt).getTime() - Date.now()) / 1000)
      return NextResponse.json({
        error: 'Mỗi mã cổ phiếu chỉ được phân tích lại một lần trong 30 ngày.',
        analysis: stored.result,
        ...metadata,
        retryAfterSeconds,
      }, {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      })
    }
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })

  const prompt = `Bạn là chuyên gia phân tích chứng khoán Việt Nam. Dựa CHỈ trên dữ liệu giá/khối lượng lịch sử dưới đây (không có báo cáo tài chính), hãy đánh giá cổ phiếu ${normalizedTicker}${companyName ? ` (${companyName})` : ''}.

=== DỮ LIỆU GIÁ & KHỐI LƯỢNG (đơn vị giá: VNĐ) ===
${JSON.stringify(stats, null, 2)}

Dữ liệu từ ${stats.dataFrom} đến ${stats.dataTo}.

NGUYÊN TẮC BẮT BUỘC:
- Phân biệt rõ "số liệu quan sát được" và "nhận định/ước tính".
- Không bịa P/E, P/B, ROE, tăng trưởng lợi nhuận, nợ vay, thị phần hoặc số liệu báo cáo tài chính không có trong input.
- Khi thiếu dữ liệu cơ bản, phải ghi rõ giới hạn và giảm confidence.
- Mọi nhận định quan trọng phải viện dẫn ít nhất một số liệu có trong input.
- Giọng điệu như báo cáo của chuyên gia đầu tư cấp cao: súc tích, phản biện, có điều kiện xác nhận/vô hiệu, không khẳng định chắc chắn tương lai.

Hãy chấm điểm 0–10 cho 6 nhóm tiêu chí sau, dựa trên xu hướng giá/khối lượng có sẵn:
- valuation (Định giá): vị trí giá hiện tại so với vùng đỉnh/đáy lịch sử — giá gần đáy có thể coi là định giá hấp dẫn hơn.
- profitability (Sinh lợi): hiệu suất tăng giá theo các khung thời gian (1M/3M/6M/YTD/1Y/5Y).
- liquidity (Thanh khoản): khối lượng giao dịch trung bình gần đây so với quy mô thị trường VN.
- capitalSafety (An toàn vốn): mức biến động/drawdown so với đỉnh lịch sử — biến động thấp và gần đỉnh ổn định thì an toàn hơn.
- assetQuality (Chất lượng tài sản) và governance (Quản trị): KHÔNG thể suy ra chính xác chỉ từ dữ liệu giá — chấm điểm trung tính (quanh 5) trừ khi có hiểu biết chung đáng tin cậy về doanh nghiệp, và nêu rõ giới hạn này trong phần risks.

Ngoài ra, ước tính thêm điểm "industryScores" — mức điểm trung bình THAM KHẢO của các doanh nghiệp cùng ngành tại Việt Nam cho cùng 6 tiêu chí trên, dựa trên hiểu biết chung (không cần chính xác tuyệt đối, chỉ mang tính tham chiếu so sánh).

Cuối cùng, liệt kê "peers" — 8 đến 10 mã cổ phiếu niêm yết tại Việt Nam cùng ngành với ${normalizedTicker} (bao gồm cả ${normalizedTicker}), mỗi mã kèm điểm 6 tiêu chí và điểm cơ bản ước tính tương tự trên, dựa trên hiểu biết chung về ngành này.

Trả về CHỈ JSON hợp lệ theo đúng cấu trúc sau (không thêm field, không markdown):
{
  "grade": "A" | "B" | "C" | "D",
  "overallScore": số 0-10 (trung bình có trọng số của 6 điểm trên),
  "scores": { "governance": number, "liquidity": number, "valuation": number, "profitability": number, "capitalSafety": number, "assetQuality": number },
  "industryScores": { "governance": number, "liquidity": number, "valuation": number, "profitability": number, "capitalSafety": number, "assetQuality": number },
  "industryOverallScore": số 0-10 (trung bình của industryScores),
  "summary": "2-3 câu tổng quan tiếng Việt",
  "confidence": { "score": number 0-100, "level": "Cao" | "Trung bình" | "Thấp", "rationale": "lý do về độ tin cậy và dữ liệu thiếu" },
  "scoreRationales": {
    "governance": "lý do chấm điểm",
    "liquidity": "lý do chấm điểm có số liệu",
    "valuation": "lý do chấm điểm có số liệu",
    "profitability": "lý do chấm điểm có số liệu",
    "capitalSafety": "lý do chấm điểm có số liệu",
    "assetQuality": "lý do chấm điểm"
  },
  "marketView": {
    "trend": "Tăng" | "Đi ngang" | "Giảm",
    "momentum": "Mạnh" | "Trung tính" | "Yếu",
    "cycle": "Tích lũy" | "Tăng giá" | "Phân phối" | "Giảm giá",
    "relativePosition": "nhận định vị trí giá với đỉnh/đáy có số liệu",
    "volumeSignal": "nhận định dòng tiền có số liệu",
    "volatilitySignal": "nhận định biến động/drawdown có số liệu"
  },
  "investmentThesis": {
    "bullCase": ["3 luận điểm tăng giá có bằng chứng"],
    "bearCase": ["3 luận điểm giảm giá/rủi ro có bằng chứng"],
    "invalidation": "điều kiện làm luận điểm hiện tại không còn đúng"
  },
  "catalysts": { "positive": ["2-4 động lực cần theo dõi"], "negative": ["2-4 rủi ro kích hoạt"] },
  "scenarios": [
    { "name": "Tích cực", "probability": number, "priceZone": "vùng giá tham khảo", "conditions": ["điều kiện"] },
    { "name": "Cơ sở", "probability": number, "priceZone": "vùng giá tham khảo", "conditions": ["điều kiện"] },
    { "name": "Tiêu cực", "probability": number, "priceZone": "vùng giá tham khảo", "conditions": ["điều kiện"] }
  ],
  "actionPlan": {
    "shortTerm": "kế hoạch 1-4 tuần",
    "mediumTerm": "kế hoạch 3-12 tháng",
    "longTerm": "kế hoạch trên 1 năm",
    "riskManagement": ["3 nguyên tắc quản trị vị thế cụ thể"]
  },
  "strengths": ["3-5 điểm mạnh có số liệu"],
  "risks": ["3-5 rủi ro/giới hạn dữ liệu"],
  "dataQuality": { "coverage": "mô tả kỳ dữ liệu", "missing": ["dữ liệu quan trọng còn thiếu"], "reliabilityNote": "cách diễn giải kết quả" },
  "recommendation": "Mua thêm | Nắm giữ | Theo dõi thêm | Thận trọng",
  "sectorName": "tên ngành bằng tiếng Việt, VD: Tổ chức tín dụng",
  "peers": [
    { "ticker": "MÃ", "grade": "A" | "B" | "C" | "D", "overallScore": number, "scores": { "governance": number, "liquidity": number, "valuation": number, "profitability": number, "capitalSafety": number, "assetQuality": number } }
  ]
}`

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 3500,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `DeepSeek API error: ${err}` }, { status: 502 })
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) return NextResponse.json({ error: 'Empty response from DeepSeek' }, { status: 502 })

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return NextResponse.json({ error: 'DeepSeek returned invalid JSON' }, { status: 502 })
  }

  const result = stockAnalysisSchema.safeParse(parsed)
  if (!result.success) {
    console.error('[stock-analysis] invalid response:', result.error.issues)
    return NextResponse.json({ error: 'AI trả về báo cáo chưa đầy đủ. Vui lòng phân tích lại.' }, { status: 502 })
  }

  const analyzedAt = new Date().toISOString()
  const { error: saveError } = await supabase
    .from('stock_analysis_history')
    .upsert({
      user_id: user.id,
      ticker: normalizedTicker,
      company_name: companyName,
      result: result.data,
      analyzed_at: analyzedAt,
    }, { onConflict: 'user_id,ticker' })

  if (saveError) {
    console.error('[stock-analysis] save failed:', saveError)
    return NextResponse.json({ error: 'Phân tích xong nhưng không lưu được kết quả.' }, { status: 500 })
  }

  return NextResponse.json({ analysis: result.data, ...cooldownMetadata(analyzedAt) }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
