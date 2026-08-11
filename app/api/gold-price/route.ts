import { NextResponse } from 'next/server'
import { deriveGoldVariantPrices, extractLatestUsdPerOunce, extractUsdToVnd, usdOunceToVndChi } from './price-utils'

export const dynamic = 'force-dynamic'

const YAHOO_GOLD_PRICE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d'
const USD_RATE_URL = 'https://open.er-api.com/v6/latest/USD'

export async function GET() {
  try {
    const [goldRes, usdRes] = await Promise.all([
      fetch(YAHOO_GOLD_PRICE_URL, { cache: 'no-store' }),
      fetch(USD_RATE_URL, { cache: 'no-store' }),
    ])

    if (!goldRes.ok || !usdRes.ok) {
      throw new Error('upstream_fetch_failed')
    }

    const [goldData, usdData] = await Promise.all([goldRes.json(), usdRes.json()])
    const usdPerOunce = extractLatestUsdPerOunce(goldData)
    const usdToVnd = extractUsdToVnd(usdData)

    if (!usdPerOunce || !usdToVnd) {
      throw new Error('invalid_upstream_payload')
    }

    const pricePerChi = usdOunceToVndChi(usdPerOunce, usdToVnd)
    const { price24kPerChi, priceRing9999PerChi } = deriveGoldVariantPrices(pricePerChi)

    return NextResponse.json(
      {
        pricePerChi,
        price24kPerChi,
        priceRing9999PerChi,
        usdPerOunce,
        usdToVnd,
        source: 'yahoo-finance + open-er-api',
        updatedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch {
    return NextResponse.json(
      { error: 'could_not_fetch_gold_price' },
      { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}
