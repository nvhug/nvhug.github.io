import { describe, expect, it } from 'vitest'
import {
  compact, downsample, filterByRange, fmt, formatAxisLabel, formatTooltipDate, pctChangeForRange, pnlCls, smoothPath,
} from './stockChartUtils'
import type { DailyPricePoint } from './stockTypes'

function point(date: string, close: number): DailyPricePoint {
  return { date, close }
}

const dailySeries: DailyPricePoint[] = [
  point('2026-01-01', 100),
  point('2026-03-01', 110),
  point('2026-06-01', 90),
  point('2026-08-01', 120),
]

describe('fmt / compact / pnlCls', () => {
  it('formats numbers with vi-VN grouping', () => {
    expect(fmt(1234.6)).toBe('1.235')
  })

  it('compacts large magnitudes with K/M/T suffixes', () => {
    expect(compact(1_500)).toBe('2K')
    expect(compact(2_500_000)).toBe('2.5M')
    expect(compact(-3_200_000_000)).toBe('-3.20T')
  })

  it('maps pnl sign to a color class', () => {
    expect(pnlCls(10)).toBe('text-emerald-600')
    expect(pnlCls(-10)).toBe('text-red-500')
    expect(pnlCls(0)).toBe('text-zinc-400')
  })
})

describe('filterByRange', () => {
  it('returns everything for ALL', () => {
    expect(filterByRange(dailySeries, 'ALL')).toHaveLength(4)
  })

  it('returns the last 5 points for 5D regardless of date gaps', () => {
    expect(filterByRange(dailySeries, '5D')).toHaveLength(4)
  })

  it('cuts off points older than the requested window', () => {
    const result = filterByRange(dailySeries, '1M')
    expect(result).toEqual([point('2026-08-01', 120)])
  })

  it('handles an empty series', () => {
    expect(filterByRange([], '1Y')).toEqual([])
  })
})

describe('pctChangeForRange', () => {
  it('computes percent change between first and last point in range', () => {
    expect(pctChangeForRange(dailySeries, 'ALL')).toBeCloseTo(20)
  })

  it('returns null when fewer than 2 points are in range', () => {
    expect(pctChangeForRange(dailySeries, '1M')).toBeNull()
  })
})

describe('downsample', () => {
  it('keeps arrays under the cap untouched', () => {
    expect(downsample(dailySeries, 10)).toHaveLength(4)
  })

  it('reduces to maxPoints while always keeping the last point', () => {
    const many = Array.from({ length: 1000 }, (_, i) => point(`2026-01-${(i % 28) + 1}`, i))
    const result = downsample(many, 100)
    expect(result.length).toBeLessThanOrEqual(101)
    expect(result.at(-1)).toEqual(many.at(-1))
  })
})

describe('smoothPath', () => {
  it('returns empty string for no points', () => {
    expect(smoothPath([])).toBe('')
  })

  it('starts with a move-to command for the first point', () => {
    expect(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toMatch(/^M0,0/)
  })
})

describe('formatAxisLabel / formatTooltipDate', () => {
  it('shows only the year for ALL/5Y ranges', () => {
    expect(formatAxisLabel('2026-03-15', 'ALL')).toBe('2026')
    expect(formatAxisLabel('2026-03-15', '5Y')).toBe('2026')
  })

  it('shows day/month for 5D', () => {
    expect(formatAxisLabel('2026-03-15', '5D')).toBe('15/3')
  })

  it('shows month/year for medium ranges', () => {
    expect(formatAxisLabel('2026-03-15', '1Y')).toBe('3/26')
  })

  it('formats tooltip dates as dd/mm/yyyy', () => {
    expect(formatTooltipDate('2026-03-05')).toBe('05/03/2026')
  })
})
