export type CompanyContext = {
  ticker?: string
  longName?: string | null
  shortName?: string | null
  sector?: string | null
  industry?: string | null
  exchange?: string | null
  quoteType?: string | null
}

export function formatCompanyContextForPrompt(context: CompanyContext) {
  const parts = [
    context.longName ? `Tên: ${context.longName}` : null,
    context.shortName ? `Tên ngắn: ${context.shortName}` : null,
    context.ticker ? `Mã: ${context.ticker}` : null,
    context.sector ? `Ngành: ${context.sector}` : null,
    context.industry ? `Lĩnh vực: ${context.industry}` : null,
    context.exchange ? `Sàn: ${context.exchange}` : null,
    context.quoteType ? `Loại niêm yết: ${context.quoteType}` : null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' | ') : 'Không có thông tin công ty từ nguồn công khai.'
}
