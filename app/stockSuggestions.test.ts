import { describe, expect, it } from 'vitest'
import { getSuggestedTickers, getUpsidePct, MIN_SUGGESTION_UPSIDE_PCT } from './stockSuggestions'

describe('getSuggestedTickers', () => {
  it('returns 5 to 10 tickers with six-factor scoring and excludes current watchlist entries', () => {
    const result = getSuggestedTickers(['FPT', 'VNM'])

    expect(result.length).toBeGreaterThanOrEqual(5)
    expect(result.length).toBeLessThanOrEqual(10)
    expect(result.every((item) => item.ticker !== 'FPT')).toBe(true)
    expect(result.every((item) => item.ticker !== 'VNM')).toBe(true)
    expect(new Set(result.map((item) => item.ticker)).size).toBe(result.length)
    expect(result.every((item) => getUpsidePct(item) >= MIN_SUGGESTION_UPSIDE_PCT)).toBe(true)

    const first = result[0]
    expect(first.score).toBeGreaterThan(0)
    expect(first.currentPrice).toBeGreaterThan(0)
    expect(first.targetPrice).toBeGreaterThan(first.currentPrice)
    expect(first.factors.growth).toBeGreaterThan(0)
    expect(first.factors.profitability).toBeGreaterThan(0)
    expect(first.factors.cashFlow).toBeGreaterThan(0)
    expect(first.factors.balanceSheet).toBeGreaterThan(0)
    expect(first.factors.valuation).toBeGreaterThan(0)
    expect(first.factors.outlook).toBeGreaterThan(0)
    expect(first.factors.trend).toBeGreaterThan(0)
    expect(first.factors.industry).toBeGreaterThan(0)
    expect(first.factors.risk).toBeGreaterThan(0)
  })

  it('calculates upside percentage from current and target prices', () => {
    expect(getUpsidePct({ currentPrice: 100, targetPrice: 120 })).toBe(20)
  })
})
