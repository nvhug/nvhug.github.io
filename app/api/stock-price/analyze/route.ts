import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getServiceSupabaseClient } from '@/lib/supabase-admin'
import { formatCompanyContextForPrompt, type CompanyContext } from './companyContext'
import { fetchFinancialSnapshot, type FinancialSnapshot } from './fundamentals'
import { fetchGovernanceDisclosures, type GovernanceDisclosures } from './governanceDisclosures'
import { gradeFromOverallScore, overallScoreFromScores } from './scoring'
import { stockAnalysisSchema } from './schema'
import { cooldownMetadata } from './cooldown'
import { checkAITrialQuota, incrementAITrialUsage, trialExhaustedBody, QUOTA_EXHAUSTED_STATUS } from '@/lib/ai-trial'
import { logAiUsage, normalizeUsage } from '@/lib/ai-usage'
import { streamGeminiWithDeepSeekFallback, isProviderConfigured } from '@/lib/ai-provider'
import { parseCompleteSections, sectionProgressPercent } from '@/lib/json-stream'
import { sseMessage } from '@/lib/sse'

export const runtime = 'nodejs'
// The old single 50_000ms budget relied on an undeclared, ambiguous platform default —
// made explicit now that a primary attempt plus a fallback attempt need more headroom
// than that budget alone ever had to prove itself against.
export const maxDuration = 60

// The fallback runs on DeepSeek at maxTokens=3500, which at this codebase's own measured
// ~120 tokens/sec sustained rate (MEASURED_TOKENS_PER_SECOND in
// horoscope-interpretation.ts) needs at least ~29.2s to finish a genuinely long analysis —
// sizing it lower turns a slow-but-healthy fallback into a timeout instead. 31s covers
// that with margin; the primary gets most of what's left of maxDuration. This budget
// covers only the AI call itself — fetchCompanyContext/fetchFinancialSnapshot/
// fetchGovernanceDisclosures above (external HTTP, no timeout of their own) and the DB
// work after both run outside it and are NOT accounted for here.
const ANALYZE_PRIMARY_TIMEOUT_MS = 24_000
export const ANALYZE_FALLBACK_TIMEOUT_MS = 31_000
export const ANALYZE_MAX_TOKENS = 3500
// The top-level keys the prompt asks for — the denominator of the progress the reader
// sees. Progress counts keys that have fully arrived, so this only has to match the
// template's SIZE, not its order. Add a field to the prompt without adding it here and
// the bar stops short of full.
export const ANALYZE_SECTION_KEYS = [
  'grade', 'overallScore', 'scores', 'industryScores', 'industryOverallScore',
  'summary', 'confidence', 'scoreRationales', 'marketView', 'investmentThesis',
  'catalysts', 'scenarios', 'actionPlan', 'strengths', 'risks',
  'dataQuality', 'recommendation', 'sectorName', 'peers',
] as const

type StoredAnalysis = {
  result: unknown
  analyzed_at: string
}

function applyEvidence(result: unknown, fundamentals: FinancialSnapshot | null, governanceDisclosures: GovernanceDisclosures | null): unknown {
  const parsed = stockAnalysisSchema.safeParse(result)
  if (!parsed.success) return result

  const assetQualityRationale = fundamentals?.nplPct != null
    ? `Dựa trên tỷ lệ nợ xấu (NPL) ${fundamentals.nplPct.toFixed(2)}% trong báo cáo ${fundamentals.reportPeriod} từ Vietcap.`
    : 'Chưa có tỷ lệ nợ xấu hoặc chỉ tiêu chất lượng tài sản có thể kiểm chứng trong nguồn dữ liệu hiện tại.'
  const scores = { ...parsed.data.scores, assetQuality: fundamentals?.assetQualityScore ?? null }
  const overallScore = overallScoreFromScores(scores)
  return {
    ...parsed.data,
    grade: gradeFromOverallScore(overallScore),
    overallScore,
    scores,
    industryScores: { liquidity: null, valuation: null, profitability: null, capitalSafety: null, assetQuality: null },
    industryOverallScore: null,
    scoreRationales: {
      ...parsed.data.scoreRationales,
      assetQuality: assetQualityRationale,
    },
    dataQuality: fundamentals
      ? {
          coverage: `Dữ liệu giá/khối lượng lịch sử và snapshot chỉ số cơ bản Vietcap kỳ ${fundamentals.reportPeriod}.`,
          missing: [
            ...(fundamentals.nplPct == null ? ['Tỷ lệ nợ xấu (NPL)'] : []),
          ],
          reliabilityNote: 'P/E, P/B, ROE, ROA, NIM và NPL (nếu có) lấy từ Vietcap; các nhận định còn lại phải được diễn giải trong phạm vi dữ liệu này.',
        }
      : parsed.data.dataQuality,
    peers: [],
    fundamentals: fundamentals ?? undefined,
    governanceDisclosures: governanceDisclosures ?? undefined,
  }
}

async function getStoredAnalysis(ticker: string): Promise<StoredAnalysis | null> {
  const supabase = getServiceSupabaseClient()
  const { data, error } = await supabase
    .from('stock_analysis_history')
    .select('result, analyzed_at')
    .eq('ticker', ticker)
    .maybeSingle()

  if (error) throw error
  return data as StoredAnalysis | null
}

async function fetchCompanyContext(ticker: string): Promise<CompanyContext | null> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=10&newsCount=0`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 86400 },
    })

    if (!res.ok) return null
    const json = await res.json() as { quotes?: Array<{ symbol?: string; longname?: string; shortname?: string; sector?: string; industry?: string; exchange?: string; quoteType?: string; name?: string }> }
    const quotes = json.quotes ?? []
    if (quotes.length === 0) return null

    const direct = quotes.find((quote) => {
      const symbol = quote.symbol ?? ''
      return symbol.toUpperCase() === ticker || symbol.toUpperCase() === `${ticker}.VN` || symbol.toUpperCase() === `${ticker}.HNX`
    }) ?? quotes.find((quote) => quote.quoteType === 'EQUITY')

    if (!direct) return null

    return {
      ticker,
      longName: direct.longname ?? direct.name ?? null,
      shortName: direct.shortname ?? null,
      sector: direct.sector ?? null,
      industry: direct.industry ?? null,
      exchange: direct.exchange ?? null,
      quoteType: direct.quoteType ?? null,
    }
  } catch (error) {
    console.warn('[stock-analysis] company context lookup failed:', error)
    return null
  }
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = profile?.role === 'admin'

  const ticker = new URL(request.url).searchParams.get('ticker')?.trim().toUpperCase()
  if (!ticker || !/^[A-Z0-9]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  try {
    const stored = await getStoredAnalysis(ticker)
    if (!stored) return NextResponse.json({ analysis: null, canAnalyze: true })
    const [fundamentals, governanceDisclosures] = await Promise.all([fetchFinancialSnapshot(ticker), fetchGovernanceDisclosures(ticker)])
    return NextResponse.json({ analysis: applyEvidence(stored.result, fundamentals, governanceDisclosures), ...cooldownMetadata(stored.analyzed_at, Date.now(), isAdmin) })
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

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role ?? 'user'
  const isAdmin = role === 'admin'

  const quota = await checkAITrialQuota(supabase, user.id, 'stock_analyze', role)
  if (!quota.allowed) {
    return NextResponse.json(
      trialExhaustedBody('stock_analyze', quota.used, quota.limit),
      { status: QUOTA_EXHAUSTED_STATUS },
    )
  }

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
    stored = await getStoredAnalysis(normalizedTicker)
  } catch (error) {
    console.error('[stock-analysis] cooldown read failed:', error)
    return NextResponse.json({ error: 'Không kiểm tra được lịch sử phân tích.' }, { status: 500 })
  }

  if (stored) {
    const metadata = cooldownMetadata(stored.analyzed_at, Date.now(), isAdmin)
    if (!metadata.canAnalyze && metadata.nextAnalyzeAt) {
      const retryAfterSeconds = Math.ceil((new Date(metadata.nextAnalyzeAt).getTime() - Date.now()) / 1000)
      const [fundamentals, governanceDisclosures] = await Promise.all([fetchFinancialSnapshot(normalizedTicker), fetchGovernanceDisclosures(normalizedTicker)])
      return NextResponse.json({
        error: 'Mỗi mã cổ phiếu chỉ được phân tích lại một lần trong 30 ngày.',
        analysis: applyEvidence(stored.result, fundamentals, governanceDisclosures),
        ...metadata,
        retryAfterSeconds,
      }, {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      })
    }
  }

  if (!isProviderConfigured()) {
    return NextResponse.json({ error: 'AI provider not configured' }, { status: 500 })
  }

  const [companyContext, fundamentals, governanceDisclosures] = await Promise.all([
    fetchCompanyContext(normalizedTicker),
    fetchFinancialSnapshot(normalizedTicker),
    fetchGovernanceDisclosures(normalizedTicker),
  ])
  const companyContextBlock = companyContext
    ? [
        '=== THÔNG TIN CÔNG TY CÓ SẴN TỪ NGUỒN CÔNG KHAI ===',
        formatCompanyContextForPrompt(companyContext),
        'Thông tin này chỉ xác nhận định danh doanh nghiệp/ngành/sàn. Nó không phải bằng chứng để chấm điểm chất lượng tài sản hoặc sức khỏe tài chính.',
      ].filter(Boolean).join('\n')
    : '=== THÔNG TIN CÔNG TY ===\nKhông có metadata công ty từ nguồn công khai để kiểm tra định danh ngành / doanh nghiệp.'

  const safeName = companyName?.replace(/[\n\r]/g, ' ').slice(0, 100) ?? null
  const companyLabel = safeName ? ` (${safeName})` : ''
  const fundamentalsBlock = fundamentals
    ? [
        '=== SỐ LIỆU CƠ BẢN ĐÃ XÁC MINH ===',
        `Nguồn: ${fundamentals.source}; kỳ báo cáo: ${fundamentals.reportPeriod}.`,
        `P/E: ${fundamentals.pe ?? 'không có'}; P/B: ${fundamentals.pb ?? 'không có'}; ROE: ${fundamentals.roePct?.toFixed(2) ?? 'không có'}%; ROA: ${fundamentals.roaPct?.toFixed(2) ?? 'không có'}%; NIM: ${fundamentals.nimPct?.toFixed(2) ?? 'không có'}%; NPL: ${fundamentals.nplPct?.toFixed(2) ?? 'không có'}%.`,
        'Đây là số liệu duy nhất được phép dùng cho nhận định cơ bản; nêu rõ nguồn và kỳ báo cáo khi viện dẫn.',
      ].join('\n')
    : '=== SỐ LIỆU CƠ BẢN ===\nKhông truy xuất được snapshot báo cáo tài chính có thể kiểm chứng.'
  const prompt = [
    `Bạn là chuyên gia phân tích chứng khoán Việt Nam. Dựa trên dữ liệu giá/khối lượng lịch sử và snapshot số liệu cơ bản đã xác minh (nếu có) dưới đây, hãy đánh giá cổ phiếu ${normalizedTicker}${companyLabel}.`,
    '',
    '=== DỮ LIỆU GIÁ & KHỐI LƯỢNG (đơn vị giá: VNĐ) ===',
    JSON.stringify(stats, null, 2),
    '',
    `Dữ liệu từ ${stats.dataFrom} đến ${stats.dataTo}.`,
    '',
    companyContextBlock,
    '',
    fundamentalsBlock,
    '',
    'NGUYÊN TẮC BẮT BUỘC:',
    '- Phân biệt rõ "số liệu quan sát được" và "nhận định/ước tính".',
    '- Không bịa P/E, P/B, ROE, tăng trưởng lợi nhuận, nợ vay, thị phần hoặc số liệu báo cáo tài chính không có trong input.',
    '- Khi thiếu dữ liệu cơ bản, phải ghi rõ giới hạn và giảm confidence.',
    '- Mọi nhận định quan trọng phải viện dẫn ít nhất một số liệu có trong input.',
    '- Metadata về ngành, quy mô hay việc là ngân hàng lớn KHÔNG phải bằng chứng để chấm assetQuality.',
    '- Bắt buộc trả về null cho assetQuality. Không được suy diễn điểm này từ tên công ty, ngành, quy mô, giá hoặc khối lượng.',
    '- Giọng điệu như báo cáo của chuyên gia đầu tư cấp cao: súc tích, phản biện, có điều kiện xác nhận/vô hiệu, không khẳng định chắc chắn tương lai.',
    '',
    'Hãy chấm điểm 0–10 cho 5 nhóm tiêu chí sau, dựa trên xu hướng giá/khối lượng có sẵn:',
    '- valuation (Định giá): vị trí giá hiện tại so với vùng đỉnh/đáy lịch sử — giá gần đáy có thể coi là định giá hấp dẫn hơn.',
    '- profitability (Sinh lợi): hiệu suất tăng giá theo các khung thời gian (1M/3M/6M/YTD/1Y/5Y).',
    '- liquidity (Thanh khoản): khối lượng giao dịch trung bình gần đây so với quy mô thị trường VN.',
    '- capitalSafety (An toàn vốn): mức biến động/drawdown so với đỉnh lịch sử — biến động thấp và gần đỉnh ổn định thì an toàn hơn.',
    '- assetQuality (Chất lượng tài sản): trả về null; hệ thống sẽ tự chấm lại từ NPL đã xác minh nếu nguồn có NPL.',
    '',
    'Không tạo industryScores hoặc peer scores từ kiến thức chung. Trả về null cho toàn bộ industryScores.',
    '',
    'Trả về peers là mảng rỗng vì hệ thống chưa có dữ liệu thị trường đồng nhất cho từng mã cùng ngành.',
    '',
    'Trả về CHỈ JSON hợp lệ theo đúng cấu trúc sau (không thêm field, không markdown):',
    '{',
    '  "grade": "A" | "B" | "C" | "D",',
    '  "overallScore": số 0-10 (trung bình có trọng số của các điểm có dữ liệu),',
    '  "scores": { "liquidity": number, "valuation": number, "profitability": number, "capitalSafety": number, "assetQuality": null },',
    '  "industryScores": { "liquidity": null, "valuation": null, "profitability": null, "capitalSafety": null, "assetQuality": null },',
    '  "industryOverallScore": null,',
    '  "summary": "2-3 câu tổng quan tiếng Việt",',
    '  "confidence": { "score": number 0-100, "level": "Cao" | "Trung bình" | "Thấp", "rationale": "lý do về độ tin cậy và dữ liệu thiếu" },',
    '  "scoreRationales": {',
    '    "liquidity": "lý do chấm điểm có số liệu",',
    '    "valuation": "lý do chấm điểm có số liệu",',
    '    "profitability": "lý do chấm điểm có số liệu",',
    '    "capitalSafety": "lý do chấm điểm có số liệu",',
    '    "assetQuality": "lý do chấm điểm"',
    '  },',
    '  "marketView": {',
    '    "trend": "Tăng" | "Đi ngang" | "Giảm",',
    '    "momentum": "Mạnh" | "Trung tính" | "Yếu",',
    '    "cycle": "Tích lũy" | "Tăng giá" | "Phân phối" | "Giảm giá",',
    '    "relativePosition": "nhận định vị trí giá với đỉnh/đáy có số liệu",',
    '    "volumeSignal": "nhận định dòng tiền có số liệu",',
    '    "volatilitySignal": "nhận định biến động/drawdown có số liệu"',
    '  },',
    '  "investmentThesis": {',
    '    "bullCase": ["3 luận điểm tăng giá có bằng chứng"],',
    '    "bearCase": ["3 luận điểm giảm giá/rủi ro có bằng chứng"],',
    '    "invalidation": "điều kiện làm luận điểm hiện tại không còn đúng"',
    '  },',
    '  "catalysts": { "positive": ["2-4 động lực cần theo dõi"], "negative": ["2-4 rủi ro kích hoạt"] },',
    '  "scenarios": [',
    '    { "name": "Tích cực", "probability": number, "priceZone": "vùng giá tham khảo", "conditions": ["điều kiện"] },',
    '    { "name": "Cơ sở", "probability": number, "priceZone": "vùng giá tham khảo", "conditions": ["điều kiện"] },',
    '    { "name": "Tiêu cực", "probability": number, "priceZone": "vùng giá tham khảo", "conditions": ["điều kiện"] }',
    '  ],',
    '  "actionPlan": {',
    '    "shortTerm": "kế hoạch 1-4 tuần",',
    '    "mediumTerm": "kế hoạch 3-12 tháng",',
    '    "longTerm": "kế hoạch trên 1 năm",',
    '    "riskManagement": ["3 nguyên tắc quản trị vị thế cụ thể"]',
    '  },',
    '  "strengths": ["3-5 điểm mạnh có số liệu"],',
    '  "risks": ["3-5 rủi ro/giới hạn dữ liệu"],',
    '  "dataQuality": { "coverage": "mô tả kỳ dữ liệu", "missing": ["dữ liệu quan trọng còn thiếu"], "reliabilityNote": "cách diễn giải kết quả" },',
    '  "recommendation": "Mua thêm | Nắm giữ | Theo dõi thêm | Thận trọng",',
    '  "sectorName": "tên ngành bằng tiếng Việt, VD: Tổ chức tín dụng",',
    '  "peers": [',
    '    { "ticker": "MÃ", "grade": "A" | "B" | "C" | "D", "overallScore": number, "scores": { "liquidity": number, "valuation": number, "profitability": number, "capitalSafety": number, "assetQuality": number } }',
    '  ]',
    '}',
  ].join('\n')

  // Before the call, so a request that straddles a peak boundary is priced at the rate it
  // was actually billed at.
  // From here the response is an SSE stream. Every gate above still answers with an
  // ordinary status code and JSON body — 401/400/429/500 — because a status can only be
  // set before the first byte, and the client reads the 429 body for the saved analysis it
  // shows during a cooldown. Only failures after generation starts travel as an event.
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseMessage(event, data)))

      try {
        // The completion is one JSON object whose top-level keys are the report's
        // sections, so a section is done the moment its value closes — real progress,
        // not a timer. See parseCompleteSections.
        let buffer = ''
        const sentKeys = new Set<string>()

        send('progress', { percent: 0, done: 0, total: ANALYZE_SECTION_KEYS.length })

        const startedAt = new Date()

        const providerResult = await streamGeminiWithDeepSeekFallback(
          {
            geminiModel: 'gemini-3.7-flash',
            deepseekModel: 'deepseek-v4-flash',
            prompt,
            temperature: 0.3,
            maxTokens: ANALYZE_MAX_TOKENS,
            primaryTimeoutMs: ANALYZE_PRIMARY_TIMEOUT_MS,
            fallbackTimeoutMs: ANALYZE_FALLBACK_TIMEOUT_MS,
          },
          {
            // Only the progress bar was ever driven from these deltas, so abandoning a
            // half-written answer costs the reader nothing but a bar that goes back to
            // zero. That is what makes the fallback safe here after the primary emitted.
            onRestart: () => {
              buffer = ''
              sentKeys.clear()
              send('progress', { percent: 0, done: 0, total: ANALYZE_SECTION_KEYS.length })
            },
            onDelta: (delta) => {
              buffer += delta
              const complete = parseCompleteSections(buffer)
              if (!complete) return
              let added = false
              for (const key of Object.keys(complete)) {
                if (sentKeys.has(key)) continue
                sentKeys.add(key)
                added = true
              }
              // Only the key name travels, never the value: the panel renders the
              // normalized report from `done`, so a half-written section would be a
              // preview of something the reader never ends up seeing.
              if (added) {
                send('progress', {
                  percent: sectionProgressPercent(sentKeys.size, ANALYZE_SECTION_KEYS.length),
                  done: sentKeys.size,
                  total: ANALYZE_SECTION_KEYS.length,
                  section: [...sentKeys].at(-1),
                })
              }
            },
          },
        )

        // No usage logged here: nothing was billed on a transport failure.
        if (!providerResult.ok) {
          send('error', { error: 'AI analysis unavailable' })
          controller.close()
          return
        }

        // Records this provider call whatever becomes of it. A failure does NOT imply zero cost:
        // every rejection below happens AFTER a completion arrived and was billed, so filing them
        // as successes would make wasted spend structurally invisible (FR-005a).
        const recordUsage = (outcome: 'success' | 'error') =>
          logAiUsage({
            surface: 'stock_analyze',
            provider: providerResult.provider,
            model: providerResult.model,
            usage: normalizeUsage(providerResult.usage, providerResult.provider),
            outcome,
            userId: user.id,
            actor: 'user',
            at: startedAt,
          })

        const content = providerResult.text
        if (!content) {
          await recordUsage('error')
          send('error', { error: 'Empty response from AI provider' })
          controller.close()
          return
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(content)
        } catch {
          await recordUsage('error')
          send('error', {
            error: providerResult.truncated
              ? 'AI bị cắt giữa chừng do vượt giới hạn độ dài. Vui lòng phân tích lại.'
              : 'AI provider returned invalid JSON',
            // Distinguishes the two ways a finished completion can be unusable:
            // cut off at our own token ceiling, or malformed at full length.
            truncated: providerResult.truncated,
            provider: providerResult.provider,
            raw: content.slice(0, 200),
          })
          controller.close()
          return
        }

        const result = stockAnalysisSchema.safeParse(parsed)
        if (!result.success) {
          await recordUsage('error')
          console.error('[stock-analysis] invalid response:', result.error.issues)
          send('error', { error: 'AI trả về báo cáo chưa đầy đủ. Vui lòng phân tích lại.' })
          controller.close()
          return
        }

        await recordUsage('success')

        const analyzedAt = new Date().toISOString()
        const finalResult = applyEvidence(result.data, fundamentals, governanceDisclosures)
        const { error: saveError } = await getServiceSupabaseClient()
          .from('stock_analysis_history')
          .upsert({
            user_id: user.id,
            ticker: normalizedTicker,
            company_name: companyName,
            result: finalResult,
            analyzed_at: analyzedAt,
          }, { onConflict: 'ticker' })

        if (saveError) {
          console.error('[stock-analysis] save failed:', saveError)
          send('error', { error: 'Phân tích xong nhưng không lưu được kết quả.' })
          controller.close()
          return
        }

        if (!quota.unlimited) {
          await incrementAITrialUsage(supabase, 'stock_analyze')
        }

        send('done', { analysis: finalResult, ...cooldownMetadata(analyzedAt, Date.now(), isAdmin) })
        controller.close()
      } catch (err) {
        // The stream is already open, so a throw here cannot become a 500 — without this
        // the connection would hang until the client gave up.
        console.error('[stock-analysis] stream failed:', err instanceof Error ? err.message : err)
        send('error', { error: 'AI analysis unavailable' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-store, no-transform',
      // Tells a proxy that buffers by default to pass bytes through as they arrive —
      // without it the hop in front of the function undoes the streaming.
      'X-Accel-Buffering': 'no',
    },
  })
}
