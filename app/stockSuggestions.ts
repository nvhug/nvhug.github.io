export type FactorScore = {
  growth: number
  profitability: number
  cashFlow: number
  balanceSheet: number
  valuation: number
  outlook: number
  trend: number
  industry: number
  risk: number
}

export type SuggestedTicker = {
  ticker: string
  reason: string
  catalyst: string
  sentiment: 'Tăng' | 'Đi ngang' | 'Cân nhắc'
  score: number
  summary: string
  currentPrice: number
  targetPrice: number
  targetUpdatedAt: string
  factors: FactorScore
}

export const MIN_SUGGESTION_UPSIDE_PCT = 20

export function getUpsidePct(suggestion: Pick<SuggestedTicker, 'currentPrice' | 'targetPrice'>): number {
  return ((suggestion.targetPrice - suggestion.currentPrice) / suggestion.currentPrice) * 100
}

const SUGGESTIONS: SuggestedTicker[] = [
  {
    ticker: 'FPT',
    reason: 'Công nghệ, AI/ERP và dịch vụ số vẫn ở nhịp tăng trưởng tốt',
    catalyst: 'Tăng trưởng doanh thu và hiệu suất triển khai dự án lớn',
    sentiment: 'Tăng',
    score: 82,
    summary: 'Tổng thể tốt nhờ tăng trưởng, lợi nhuận và triển vọng rõ ràng.',
    currentPrice: 122000,
    targetPrice: 150000,
    targetUpdatedAt: '2026-08-18',
    factors: { growth: 88, profitability: 82, cashFlow: 80, balanceSheet: 78, valuation: 74, outlook: 86, trend: 83, industry: 85, risk: 74 },
  },
  {
    ticker: 'VNM',
    reason: 'Nền tảng tiêu thụ bền và quy mô thương hiệu lớn tạo sức chịu đựng tốt',
    catalyst: 'Giữ thị phần, nâng hiệu suất sản xuất và lợi nhuận bền',
    sentiment: 'Tăng',
    score: 79,
    summary: 'Ổn định và ít rủi ro hơn, phù hợp nếu muốn theo chiều điềm tĩnh.',
    currentPrice: 69000,
    targetPrice: 82000,
    targetUpdatedAt: '2026-08-18',
    factors: { growth: 72, profitability: 84, cashFlow: 82, balanceSheet: 80, valuation: 76, outlook: 78, trend: 80, industry: 79, risk: 81 },
  },
  {
    ticker: 'HPG',
    reason: 'Ngành kim loại và vật liệu có thể hồi phục khi đầu tư xây dựng tăng',
    catalyst: 'Lợi nhuận có thể cải thiện khi chu kỳ sản xuất và giá vật liệu ổn hơn',
    sentiment: 'Tăng',
    score: 76,
    summary: 'Cân bằng giữa định giá và triển vọng, nhạy với chu kỳ ngành.',
    currentPrice: 25500,
    targetPrice: 32000,
    targetUpdatedAt: '2026-08-18',
    factors: { growth: 74, profitability: 72, cashFlow: 76, balanceSheet: 74, valuation: 78, outlook: 75, trend: 79, industry: 77, risk: 69 },
  },
  {
    ticker: 'SSI',
    reason: 'Chứng khoán hưởng lợi từ khối lượng giao dịch và tâm lý thị trường tốt hơn',
    catalyst: 'Khối lượng giao dịch và doanh thu hoạt động có thể tăng cùng nhịp thị trường',
    sentiment: 'Tăng',
    score: 75,
    summary: 'Tăng trưởng và định giá đang theo hướng hấp dẫn nhưng nhạy biến động mạnh.',
    currentPrice: 28400,
    targetPrice: 36000,
    targetUpdatedAt: '2026-08-18',
    factors: { growth: 80, profitability: 68, cashFlow: 72, balanceSheet: 72, valuation: 79, outlook: 78, trend: 82, industry: 81, risk: 58 },
  },
  {
    ticker: 'HDB',
    reason: 'Ngân hàng lớn với nền tảng vốn và tín dụng tốt hơn nhiều đối thủ',
    catalyst: 'Lợi nhuận từ tín dụng doanh nghiệp và lãi suất có thể ổn định hơn',
    sentiment: 'Tăng',
    score: 78,
    summary: 'Mô hình tài chính ổn định, điểm mạnh ở thanh khoản và vốn.',
    currentPrice: 19200,
    targetPrice: 23200,
    targetUpdatedAt: '2026-08-18',
    factors: { growth: 70, profitability: 81, cashFlow: 82, balanceSheet: 88, valuation: 74, outlook: 79, trend: 76, industry: 80, risk: 77 },
  },
  {
    ticker: 'CTG',
    reason: 'Ngân hàng và tài chính có triển vọng tốt nếu tín dụng và hiệu quả hoạt động cải thiện',
    catalyst: 'Tăng quy mô tín dụng và nâng biên lợi nhuận',
    sentiment: 'Cân nhắc',
    score: 72,
    summary: 'Tốt về nền tảng tài chính nhưng cần xem thêm tín hiệu thanh khoản và định giá.',
    currentPrice: 37100,
    targetPrice: 44600,
    targetUpdatedAt: '2026-08-18',
    factors: { growth: 68, profitability: 74, cashFlow: 71, balanceSheet: 83, valuation: 66, outlook: 72, trend: 70, industry: 78, risk: 71 },
  },
  {
    ticker: 'MWG',
    reason: 'Bán lẻ tiêu dùng có thể hồi phục nhờ quy mô và khả năng khai thác kênh phân phối',
    catalyst: 'Tăng lưu lượng khách hàng và hiệu quả hoạt động nếu doanh số ổn định',
    sentiment: 'Cân nhắc',
    score: 71,
    summary: 'Chưa quá mạnh ở lợi nhuận nhưng có cơ hội nếu chu kỳ tiêu dùng cải thiện.',
    currentPrice: 41300,
    targetPrice: 50000,
    targetUpdatedAt: '2026-08-18',
    factors: { growth: 69, profitability: 66, cashFlow: 70, balanceSheet: 75, valuation: 77, outlook: 71, trend: 68, industry: 73, risk: 65 },
  },
  {
    ticker: 'VIC',
    reason: 'Bất động sản và hạ tầng có tiềm năng dài hạn, dù nhạy theo chu kỳ',
    catalyst: 'Dòng cổ tức, quỹ đất và triển vọng đầu tư cơ sở hạ tầng hỗ trợ',
    sentiment: 'Cân nhắc',
    score: 70,
    summary: 'Khả năng dài hạn tốt, nhưng cần theo dõi rủi ro chu kỳ và giá đất.',
    currentPrice: 45500,
    targetPrice: 55000,
    targetUpdatedAt: '2026-08-18',
    factors: { growth: 66, profitability: 72, cashFlow: 74, balanceSheet: 79, valuation: 63, outlook: 73, trend: 67, industry: 74, risk: 60 },
  },
  {
    ticker: 'GAS',
    reason: 'Năng lượng có tính ổn định và ít biến động, phù hợp nếu ưu tiên an toàn',
    catalyst: 'Tiêu thụ ổn định và hiệu suất vận hành có thể duy trì',
    sentiment: 'Đi ngang',
    score: 68,
    summary: 'An toàn về doanh nghiệp nhưng tăng trưởng và định giá không quá mạnh.',
    currentPrice: 141000,
    targetPrice: 158000,
    targetUpdatedAt: '2026-08-18',
    factors: { growth: 62, profitability: 73, cashFlow: 78, balanceSheet: 81, valuation: 60, outlook: 66, trend: 71, industry: 69, risk: 80 },
  },
  {
    ticker: 'POW',
    reason: 'Điện lực và năng lượng cơ sở hạ tầng vẫn là trụ đỡ giá trị dài hạn',
    catalyst: 'Tăng nhu cầu điện và đầu tư hạ tầng',
    sentiment: 'Đi ngang',
    score: 69,
    summary: 'Một lựa chọn ổn định hơn là tăng trưởng, nhưng không phải mã “bứt phá”.',
    currentPrice: 12700,
    targetPrice: 15300,
    targetUpdatedAt: '2026-08-18',
    factors: { growth: 64, profitability: 70, cashFlow: 74, balanceSheet: 77, valuation: 62, outlook: 70, trend: 69, industry: 71, risk: 79 },
  },
]

export function getSuggestedTickers(currentTickers: string[] = []): SuggestedTicker[] {
  const existing = new Set(currentTickers.map((t) => t.trim().toUpperCase()))
  const pool = SUGGESTIONS.filter((item) => (
    !existing.has(item.ticker) && getUpsidePct(item) >= MIN_SUGGESTION_UPSIDE_PCT
  ))
  return [...pool].sort((a, b) => b.score - a.score).slice(0, 10)
}
