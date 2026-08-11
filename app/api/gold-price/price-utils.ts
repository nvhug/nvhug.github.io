const GRAMS_PER_CHI = 3.75
const GRAMS_PER_TROY_OUNCE = 31.1034768
const GOLD_24K_MULTIPLIER = 1.03
const GOLD_RING_9999_MULTIPLIER = 1

export type GoldVariantPrices = {
  price24kPerChi: number
  priceRing9999PerChi: number
}

export function extractLatestUsdPerOunce(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number
          previousClose?: number
        }
      }>
    }
  }

  const meta = data.chart?.result?.[0]?.meta
  if (!meta) return null

  if (typeof meta.regularMarketPrice === 'number' && Number.isFinite(meta.regularMarketPrice) && meta.regularMarketPrice > 0) {
    return meta.regularMarketPrice
  }

  if (typeof meta.previousClose === 'number' && Number.isFinite(meta.previousClose) && meta.previousClose > 0) {
    return meta.previousClose
  }

  return null
}

export function extractUsdToVnd(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as { rates?: Record<string, number> }
  const rate = data.rates?.VND
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null
}

export function usdOunceToVndChi(usdPerOunce: number, usdToVnd: number): number {
  if (!Number.isFinite(usdPerOunce) || usdPerOunce <= 0) throw new Error('invalid_usd_per_ounce')
  if (!Number.isFinite(usdToVnd) || usdToVnd <= 0) throw new Error('invalid_usd_to_vnd')

  const chiPerOunce = GRAMS_PER_TROY_OUNCE / GRAMS_PER_CHI
  const vndPerChi = (usdPerOunce * usdToVnd) / chiPerOunce
  return Math.round(vndPerChi)
}

export function deriveGoldVariantPrices(basePricePerChi: number): GoldVariantPrices {
  if (!Number.isFinite(basePricePerChi) || basePricePerChi <= 0) throw new Error('invalid_base_price')

  return {
    price24kPerChi: Math.round(basePricePerChi * GOLD_24K_MULTIPLIER),
    priceRing9999PerChi: Math.round(basePricePerChi * GOLD_RING_9999_MULTIPLIER),
  }
}
