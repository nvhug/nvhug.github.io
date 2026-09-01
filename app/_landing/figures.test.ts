import { describe, expect, it } from 'vitest'
import {
  ALERTS_ARMED,
  AREA_SCORE_ROWS,
  ASSET_ROWS,
  ASSET_TOTAL,
  GOLD_HOLDING,
  STOCK_ROWS,
  formatDong,
} from './figures'
import { usdOunceToVndChi } from '../api/gold-price/price-utils'

describe('formatDong', () => {
  it('groups thousands with dots, the way the app writes money', () => {
    expect(formatDong(1234000000)).toBe('1.234.000.000 ₫')
  })

  it('handles a value with no grouping', () => {
    expect(formatDong(0)).toBe('0 ₫')
  })
})

describe('GOLD_HOLDING', () => {
  it('prices a chi, not a luong — the unit the product is named for', () => {
    // An earlier version was off by ~9x: it used a per-luong price and called it a
    // chi. Pinned against the app's OWN converter rather than a hand-typed number,
    // because the bug was exactly a hand-typed number that no internal-consistency
    // check could see.
    const realistic = usdOunceToVndChi(3300, 26000)
    expect(GOLD_HOLDING.pricePerChi).toBeGreaterThan(realistic / 3)
    expect(GOLD_HOLDING.pricePerChi).toBeLessThan(realistic * 3)
  })

  it('derives its dong figure, never carries a second copy of it', () => {
    // FR-021 and 2-plan.md R4: no gold API on a public page, so the figure is a
    // constant times a constant — and it must be computed here, not restated.
    expect(GOLD_HOLDING.amount).toBe(Math.round(GOLD_HOLDING.chi * GOLD_HOLDING.pricePerChi))
  })
})

describe('ASSET_ROWS — block 01 mockup', () => {
  it('has a gold row, because the gold unit is the point of the block', () => {
    expect(ASSET_ROWS.some((row) => row.gold)).toBe(true)
  })

  it('gives every row a share of the total between 0 and 1, for the bar widths', () => {
    const total = ASSET_ROWS.reduce((sum, row) => sum + row.amount, 0)
    for (const row of ASSET_ROWS) {
      const share = row.amount / total
      expect(share).toBeGreaterThan(0)
      expect(share).toBeLessThanOrEqual(1)
    }
  })

  it('is ordered largest first, so the bars descend', () => {
    const amounts = ASSET_ROWS.map((row) => row.amount)
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
  })

  it('adds up to the total the block displays', () => {
    // The page argues that the app does real arithmetic. A mockup whose total is
    // not the sum of its rows would contradict that in the reader's first glance,
    // fake figures or not.
    expect(ASSET_ROWS.reduce((sum, row) => sum + row.amount, 0)).toBe(ASSET_TOTAL)
  })

  it('reads its gold line from the shared holding, not a copied number', () => {
    const gold = ASSET_ROWS.find((row) => row.gold)
    expect(gold?.amount).toBe(GOLD_HOLDING.amount)
  })
})

describe('STOCK_ROWS — block 02 mockup', () => {
  it('names no security, so the block cannot read as a recommendation', () => {
    // Every three-letter code is a real ticker somewhere. The rows carry a key that
    // resolves to `mã 1 / mã 2 / mã 3`, never a symbol.
    expect(STOCK_ROWS.map((row) => row.key)).toEqual(['A', 'B', 'C'])
  })

  it('has weights that add up to a whole portfolio', () => {
    expect(STOCK_ROWS.reduce((sum, row) => sum + row.sharePct, 0)).toBe(100)
  })

  it('is ordered largest first, so the bars descend', () => {
    const shares = STOCK_ROWS.map((row) => row.sharePct)
    expect(shares).toEqual([...shares].sort((a, b) => b - a))
  })

  it('shows at least one holding down on the session', () => {
    // A portfolio where every line is green is a promise, not an illustration — and
    // this is the one block on the page that touches investing.
    expect(STOCK_ROWS.some((row) => row.changePct < 0)).toBe(true)
  })

  it('keeps every change plausible rather than a jackpot', () => {
    for (const row of STOCK_ROWS) {
      expect(Math.abs(row.changePct), row.key).toBeLessThan(10)
    }
  })
})

describe('ALERTS_ARMED', () => {
  it('is a small positive count — the row shows the feature exists, not a busy account', () => {
    expect(ALERTS_ARMED).toBeGreaterThan(0)
    expect(ALERTS_ARMED).toBeLessThan(10)
  })
})

describe('AREA_SCORE_ROWS — block 03 mockup', () => {
  it('names no two areas the same', () => {
    const keys = AREA_SCORE_ROWS.map((row) => row.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps every score a plausible percentage, not a perfect or empty one', () => {
    for (const row of AREA_SCORE_ROWS) {
      expect(row.scorePct, row.key).toBeGreaterThan(0)
      expect(row.scorePct, row.key).toBeLessThan(100)
    }
  })
})
