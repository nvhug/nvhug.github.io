import { describe, expect, it } from 'vitest'
import { computeCostUsd, formatUsd, isPeakHour, PRICING_VERSION, USD_TO_VND, usdToVnd } from './ai-pricing'

// 2026-08-24 is a Monday, 2026-08-29 a Saturday, 2026-08-30 a Sunday.
const mon = (hms: string) => new Date(`2026-08-24T${hms}Z`)
const sat = (hms: string) => new Date(`2026-08-29T${hms}Z`)
const sun = (hms: string) => new Date(`2026-08-30T${hms}Z`)

describe('isPeakHour', () => {
  // DeepSeek peak is 01:00-04:00 and 06:00-10:00 UTC, Mon-Fri, half-open [start, end).
  // The boundaries are the whole point: adjacent windows must neither overlap nor gap.
  it('treats the start of each window as peak and the end as off-peak', () => {
    expect(isPeakHour(mon('00:59:59'))).toBe(false)
    expect(isPeakHour(mon('01:00:00'))).toBe(true)
    expect(isPeakHour(mon('03:59:59'))).toBe(true)
    expect(isPeakHour(mon('04:00:00'))).toBe(false)
    expect(isPeakHour(mon('05:59:59'))).toBe(false)
    expect(isPeakHour(mon('06:00:00'))).toBe(true)
    expect(isPeakHour(mon('09:59:59'))).toBe(true)
    expect(isPeakHour(mon('10:00:00'))).toBe(false)
  })

  it('is off-peak in the gap between the two windows', () => {
    expect(isPeakHour(mon('05:00:00'))).toBe(false)
  })

  it('is off-peak outside both windows', () => {
    expect(isPeakHour(mon('00:00:00'))).toBe(false)
    expect(isPeakHour(mon('12:00:00'))).toBe(false)
    expect(isPeakHour(mon('23:59:59'))).toBe(false)
  })

  it('is never peak at the weekend, including inside the weekday windows', () => {
    for (const h of ['01:00:00', '03:00:00', '06:00:00', '09:59:59']) {
      expect(isPeakHour(sat(h))).toBe(false)
      expect(isPeakHour(sun(h))).toBe(false)
    }
  })
})

describe('computeCostUsd', () => {
  const offPeak = mon('12:00:00')
  const peak = mon('02:00:00')

  it('prices cached input at the cache-hit rate, not the miss rate', () => {
    // 1M cached input on deepseek-v4-flash: 0.007 off-peak, versus 0.22 if it were
    // treated as a miss. A 31x error, which is why this is the first test.
    const cost = computeCostUsd(
      { input: 1_000_000, cached: 1_000_000, output: 0 },
      'deepseek-v4-flash',
      offPeak
    )
    expect(cost).toBeCloseTo(0.007, 10)
  })

  it('splits input between the cached and uncached rates', () => {
    // 400k cached at 0.007/1M + 600k uncached at 0.22/1M
    const cost = computeCostUsd(
      { input: 1_000_000, cached: 400_000, output: 0 },
      'deepseek-v4-flash',
      offPeak
    )
    expect(cost).toBeCloseTo(0.4 * 0.007 + 0.6 * 0.22, 10)
  })

  it('prices output at the output rate', () => {
    const cost = computeCostUsd(
      { input: 0, cached: 0, output: 1_000_000 },
      'deepseek-v4-flash',
      offPeak
    )
    expect(cost).toBeCloseTo(0.66, 10)
  })

  it('costs exactly twice as much during a peak window', () => {
    const tokens = { input: 500_000, cached: 100_000, output: 200_000 }
    const off = computeCostUsd(tokens, 'deepseek-v4-flash', offPeak)
    const on = computeCostUsd(tokens, 'deepseek-v4-flash', peak)
    expect(off).not.toBeNull()
    expect(on).toBeCloseTo((off as number) * 2, 10)
  })

  it('ignores the peak rule for a provider that has none', () => {
    const tokens = { input: 1_000_000, cached: 0, output: 0 }
    expect(computeCostUsd(tokens, 'gemini-3.6-flash', peak)).toBeCloseTo(
      computeCostUsd(tokens, 'gemini-3.6-flash', offPeak) as number,
      10
    )
  })

  it('charges a flat input rate for a model with no cache tier', () => {
    // Gemini has no cached-input price here, so cached tokens cost the same as uncached
    // rather than silently costing nothing.
    const cost = computeCostUsd(
      { input: 1_000_000, cached: 1_000_000, output: 0 },
      'gemini-3.6-flash',
      offPeak
    )
    expect(cost).toBeCloseTo(0.75, 10)
  })

  it('returns null for an unknown model, never zero', () => {
    // The retired `deepseek-chat` id is the realistic case. A zero here would report a
    // cost of $0 for calls that are really being billed.
    const cost = computeCostUsd({ input: 1000, cached: 0, output: 500 }, 'deepseek-chat', offPeak)
    expect(cost).toBeNull()
    expect(cost).not.toBe(0)
  })

  it('keeps precision for a call costing about one millionth of a dollar', () => {
    // 300 fully cached input tokens: 300/1e6 * 0.007 = 2.1e-6
    const cost = computeCostUsd({ input: 300, cached: 300, output: 0 }, 'deepseek-v4-flash', offPeak)
    expect(cost).not.toBeNull()
    expect(cost as number).toBeGreaterThan(0)
    expect(cost).toBeCloseTo(2.1e-6, 12)
  })

  it('returns zero for a call that reported no tokens at all', () => {
    // A provider that refused before generating anything: priced model, genuinely $0.
    // Distinct from the unknown-model null above.
    expect(computeCostUsd({ input: 0, cached: 0, output: 0 }, 'deepseek-v4-flash', offPeak)).toBe(0)
  })
})

describe('formatUsd', () => {
  it('uses four decimals below one cent so small costs are not shown as $0.00', () => {
    expect(formatUsd(0.0000021)).toBe('$0.0000')
    expect(formatUsd(0.0021)).toBe('$0.0021')
    expect(formatUsd(0.0099)).toBe('$0.0099')
  })

  it('uses two decimals at one cent and above', () => {
    expect(formatUsd(0.01)).toBe('$0.01')
    expect(formatUsd(13.021)).toBe('$13.02')
    expect(formatUsd(1234.5)).toBe('$1,234.50')
  })

  it('renders a real zero as two decimals', () => {
    expect(formatUsd(0)).toBe('$0.00')
  })
})

describe('usdToVnd', () => {
  it('converts at the documented rate and rounds to whole dong', () => {
    expect(usdToVnd(1)).toBe(USD_TO_VND)
    expect(usdToVnd(13.0241)).toBe(Math.round(13.0241 * USD_TO_VND))
  })

  it('rounds a sub-dong cost to zero, which is why VND is aggregate-only', () => {
    expect(usdToVnd(0.0000021)).toBe(0)
  })
})

describe('PRICING_VERSION', () => {
  it('is a non-empty identifier, so every stored cost is traceable to a rate table', () => {
    expect(PRICING_VERSION).toMatch(/\S/)
  })
})
