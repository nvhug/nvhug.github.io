import { z } from 'zod'

const score = z.number().min(0).max(10)
const grade = z.enum(['A', 'B', 'C', 'D'])

const categoryScoresSchema = z.object({
  governance: score,
  liquidity: score,
  valuation: score,
  profitability: score,
  capitalSafety: score,
  assetQuality: score,
})

export const stockAnalysisSchema = z.object({
  grade,
  overallScore: score,
  scores: categoryScoresSchema,
  industryScores: categoryScoresSchema,
  industryOverallScore: score,
  summary: z.string().min(1),
  confidence: z.object({
    score: z.number().min(0).max(100),
    level: z.enum(['Cao', 'Trung bình', 'Thấp']),
    rationale: z.string().min(1),
  }),
  scoreRationales: z.object({
    governance: z.string().min(1),
    liquidity: z.string().min(1),
    valuation: z.string().min(1),
    profitability: z.string().min(1),
    capitalSafety: z.string().min(1),
    assetQuality: z.string().min(1),
  }),
  marketView: z.object({
    trend: z.enum(['Tăng', 'Đi ngang', 'Giảm']),
    momentum: z.enum(['Mạnh', 'Trung tính', 'Yếu']),
    cycle: z.enum(['Tích lũy', 'Tăng giá', 'Phân phối', 'Giảm giá']),
    relativePosition: z.string().min(1),
    volumeSignal: z.string().min(1),
    volatilitySignal: z.string().min(1),
  }),
  investmentThesis: z.object({
    bullCase: z.array(z.string().min(1)).min(1),
    bearCase: z.array(z.string().min(1)).min(1),
    invalidation: z.string().min(1),
  }),
  catalysts: z.object({
    positive: z.array(z.string().min(1)).min(1),
    negative: z.array(z.string().min(1)).min(1),
  }),
  scenarios: z.array(z.object({
    name: z.string().min(1),
    probability: z.number().min(0).max(100),
    priceZone: z.string().min(1),
    conditions: z.array(z.string().min(1)).min(1),
  })).length(3),
  actionPlan: z.object({
    shortTerm: z.string().min(1),
    mediumTerm: z.string().min(1),
    longTerm: z.string().min(1),
    riskManagement: z.array(z.string().min(1)).min(1),
  }),
  strengths: z.array(z.string().min(1)).min(1),
  risks: z.array(z.string().min(1)).min(1),
  dataQuality: z.object({
    coverage: z.string().min(1),
    missing: z.array(z.string().min(1)).min(1),
    reliabilityNote: z.string().min(1),
  }),
  recommendation: z.enum(['Mua thêm', 'Nắm giữ', 'Theo dõi thêm', 'Thận trọng']),
  sectorName: z.string().min(1),
  peers: z.array(z.object({
    ticker: z.string().min(1).max(10),
    grade,
    overallScore: score,
    scores: categoryScoresSchema,
  })).min(1),
})

export type StockAnalysisResult = z.infer<typeof stockAnalysisSchema>
