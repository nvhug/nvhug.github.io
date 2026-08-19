import { describe, expect, it } from 'vitest'
import { formatCompanyContextForPrompt } from './companyContext'
import { stockAnalysisSchema } from './schema'

const scores = {
  liquidity: 7,
  valuation: 6,
  profitability: 6,
  capitalSafety: 5,
  assetQuality: 5,
}

const validAnalysis = {
  grade: 'B',
  overallScore: 5.7,
  scores,
  industryScores: scores,
  industryOverallScore: 5.7,
  summary: 'Xu hướng trung tính với thanh khoản khá.',
  confidence: { score: 62, level: 'Trung bình', rationale: 'Chỉ có dữ liệu giá và khối lượng.' },
  scoreRationales: {
    liquidity: 'Thanh khoản gần đây khá.',
    valuation: 'Giá nằm giữa biên lịch sử.',
    profitability: 'Hiệu suất trung hạn trung tính.',
    capitalSafety: 'Drawdown ở mức vừa phải.',
    assetQuality: 'Thiếu dữ liệu báo cáo tài chính.',
  },
  marketView: {
    trend: 'Đi ngang',
    momentum: 'Trung tính',
    cycle: 'Tích lũy',
    relativePosition: 'Giá ở giữa biên lịch sử.',
    volumeSignal: 'Khối lượng ổn định.',
    volatilitySignal: 'Biến động vừa phải.',
  },
  investmentThesis: {
    bullCase: ['Thanh khoản duy trì tốt.'],
    bearCase: ['Động lượng chưa rõ ràng.'],
    invalidation: 'Giá phá vùng hỗ trợ gần nhất.',
  },
  catalysts: { positive: ['Khối lượng tăng.'], negative: ['Thanh khoản suy yếu.'] },
  scenarios: [
    { name: 'Tích cực', probability: 25, priceZone: 'Trên giá hiện tại', conditions: ['Động lượng cải thiện.'] },
    { name: 'Cơ sở', probability: 50, priceZone: 'Quanh giá hiện tại', conditions: ['Đi ngang tích lũy.'] },
    { name: 'Tiêu cực', probability: 25, priceZone: 'Dưới giá hiện tại', conditions: ['Mất hỗ trợ.'] },
  ],
  actionPlan: {
    shortTerm: 'Theo dõi phản ứng giá.',
    mediumTerm: 'Chờ xu hướng rõ hơn.',
    longTerm: 'Bổ sung báo cáo tài chính.',
    riskManagement: ['Giới hạn tỷ trọng.'],
  },
  strengths: ['Thanh khoản khá.'],
  risks: ['Thiếu dữ liệu cơ bản.'],
  dataQuality: {
    coverage: 'Dữ liệu lịch sử nhiều năm.',
    missing: ['Báo cáo tài chính.'],
    reliabilityNote: 'Chỉ dùng như tham khảo kỹ thuật.',
  },
  recommendation: 'Theo dõi thêm',
  sectorName: 'Ngân hàng',
  peers: [{ ticker: 'MBB', grade: 'B', overallScore: 5.7, scores }],
}

describe('stockAnalysisSchema', () => {
  it('accepts a complete expert report', () => {
    expect(stockAnalysisSchema.safeParse(validAnalysis).success).toBe(true)
  })

  it('rejects incomplete or out-of-range reports', () => {
    const invalid = { ...validAnalysis, confidence: { ...validAnalysis.confidence, score: 120 } }
    expect(stockAnalysisSchema.safeParse(invalid).success).toBe(false)
  })

  it('formats public company identity without treating it as financial evidence', () => {
    const companyContext = {
      ticker: 'MBB',
      sector: 'Financial Services',
      industry: 'Banks - Regional',
      exchange: 'HNX',
      longName: 'MBBank',
      quoteType: 'EQUITY',
    }

    expect(formatCompanyContextForPrompt(companyContext)).toContain('Financial Services')
  })
})
