import { describe, expect, it } from 'vitest'
import { deriveGoldVariantPrices, extractLatestUsdPerOunce, extractUsdToVnd, usdOunceToVndChi } from './price-utils'

describe('gold price utils', () => {
  it('extracts latest USD/ounce from yahoo payload', () => {
    const payload = {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 3360.5,
            },
          },
        ],
      },
    }

    expect(extractLatestUsdPerOunce(payload)).toBe(3360.5)
  })

  it('falls back to previous close when regularMarketPrice is missing', () => {
    const payload = {
      chart: {
        result: [
          {
            meta: {
              previousClose: 3355.1,
            },
          },
        ],
      },
    }

    expect(extractLatestUsdPerOunce(payload)).toBe(3355.1)
  })

  it('extracts USD to VND exchange rate', () => {
    const payload = { rates: { VND: 26250.12 } }
    expect(extractUsdToVnd(payload)).toBe(26250.12)
  })

  it('converts USD/ounce to VND/chi', () => {
    const value = usdOunceToVndChi(3300, 26000)
    expect(value).toBe(10307822)
  })

  it('derives separate prices for 24K and ring 9999', () => {
    const variants = deriveGoldVariantPrices(10_000_000)
    expect(variants).toEqual({
      price24kPerChi: 10_300_000,
      priceRing9999PerChi: 10_000_000,
    })
  })
})
