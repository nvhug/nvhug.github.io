export type FinancialSnapshot = {
  source: 'Vietcap'
  reportPeriod: string
  pe: number | null
  pb: number | null
  roePct: number | null
  roaPct: number | null
  nimPct: number | null
  nplPct: number | null
  assetQualityScore: number | null
}

type VietcapRatio = {
  yearReport?: number
  quarter?: number
  pe?: number
  pb?: number
  roe?: number
  roa?: number
  netInterestMargin?: number
  npl?: number
}

const VIETCAP_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://trading.vietcap.com.vn',
  Referer: 'https://trading.vietcap.com.vn/priceboard',
  'User-Agent': 'Mozilla/5.0',
}

function toPercentage(value?: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value * 100 : null
}

function toMetric(value?: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function assetQualityScoreFromNpl(nplPct: number | null): number | null {
  if (nplPct == null) return null
  if (nplPct <= 1) return 9
  if (nplPct <= 1.5) return 8
  if (nplPct <= 2) return 7
  if (nplPct <= 3) return 6
  if (nplPct <= 4) return 5
  if (nplPct <= 5) return 4
  return 3
}

export function snapshotFromVietcapRatios(rows: VietcapRatio[]): FinancialSnapshot | null {
  const latest = [...rows]
    .filter((row) => typeof row.yearReport === 'number' && typeof row.quarter === 'number')
    .sort((left, right) => (right.yearReport! - left.yearReport!) || (right.quarter! - left.quarter!))[0]

  if (!latest) return null

  const nplPct = toPercentage(latest.npl)
  return {
    source: 'Vietcap',
    reportPeriod: `${latest.yearReport}-Q${latest.quarter}`,
    pe: toMetric(latest.pe),
    pb: toMetric(latest.pb),
    roePct: toPercentage(latest.roe),
    roaPct: toPercentage(latest.roa),
    nimPct: toPercentage(latest.netInterestMargin),
    nplPct,
    assetQualityScore: assetQualityScoreFromNpl(nplPct),
  }
}

export async function fetchFinancialSnapshot(ticker: string): Promise<FinancialSnapshot | null> {
  try {
    const response = await fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${encodeURIComponent(ticker)}/statistics-financial`, {
      headers: VIETCAP_HEADERS,
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null

    const payload = await response.json() as { data?: VietcapRatio[] }
    return snapshotFromVietcapRatios(payload.data ?? [])
  } catch (error) {
    console.warn('[stock-analysis] financial data lookup failed:', error)
    return null
  }
}