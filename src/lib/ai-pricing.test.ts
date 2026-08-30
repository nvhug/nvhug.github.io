import { describe, expect, it } from 'vitest'
import {
  computeCostUsd,
  formatUsd,
  formatUsdAggregate,
  isPeakHour,
  PRICING_VERSION,
  resolvePriceKey,
  USD_TO_VND,
  usdToVnd,
} from './ai-pricing'

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

  it.each(['gemini-3.7-flash', 'gemini-3.1-flash-lite'])(
    'returns 0, not null, for the free-tier model %s at real token volume',
    (model) => {
      // The whole point of pricing these at zero rather than leaving them out of the
      // table: a real, large call must show up as a priced $0, not as "unpriced" null —
      // otherwise a dashboard reader can't tell "free tier" from "we forgot to price this".
      const cost = computeCostUsd({ input: 1_000_000, cached: 500_000, output: 1_000_000 }, model, offPeak)
      expect(cost).not.toBeNull()
      expect(cost).toBe(0)
    }
  )
})

describe('resolvePriceKey — the served id is not always a price-table key', () => {
  it('matches an exact id', () => {
    expect(resolvePriceKey('deepseek-v4-flash')).toBe('deepseek-v4-flash')
  })

  it('strips a point-release suffix, which is what Gemini actually returns', () => {
    // Ask for gemini-3.6-flash and the response reports gemini-3.6-flash-002. Indexing the
    // table with the served id would miss on every Gemini call and report $0 for real spend.
    expect(resolvePriceKey('gemini-3.6-flash-002')).toBe('gemini-3.6-flash')
  })

  it('falls back to the requested model when the served id is unknown', () => {
    expect(resolvePriceKey('some-internal-alias', 'deepseek-v4-flash')).toBe('deepseek-v4-flash')
  })

  it('returns null rather than a prototype member', () => {
    // A bare MODEL_PRICES[model] index returns Object.prototype.constructor here, and the
    // cost arithmetic then produces NaN.
    for (const evil of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
      expect(resolvePriceKey(evil), evil).toBeNull()
    }
  })
})

describe('price table covers every model the code can request', () => {
  // The highest-value test here: a model id that misses the table costs nothing on the
  // dashboard while costing real money at the provider.
  const REQUESTABLE = [
    'deepseek-v4-flash',
    'deepseek-v4-pro',
    'deepseek-v4-flash-vision-exp',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.1-flash-lite',
  ]

  it.each(REQUESTABLE)('%s resolves to a price', (model) => {
    expect(resolvePriceKey(model)).not.toBeNull()
  })

  it.each(REQUESTABLE)('%s still resolves when served with a -002 suffix', (model) => {
    expect(resolvePriceKey(`${model}-002`)).not.toBeNull()
  })
})

describe('computeCostUsd — hostile model ids', () => {
  const at = new Date('2026-08-24T12:00:00Z')

  it('returns null, never NaN, for a prototype-chain key', () => {
    // NaN is worse than null here: JSON.stringify turns it into null while pricing_version
    // stays set, which violates the table's cost-and-version-together CHECK and drops the
    // whole row instead of just its cost.
    const cost = computeCostUsd({ input: 1000, cached: 0, output: 500 }, 'constructor', at)
    expect(cost).toBeNull()
    expect(Number.isNaN(cost as unknown as number)).toBe(false)
  })

  it('prices a versioned served id off its base model', () => {
    const versioned = computeCostUsd({ input: 1e6, cached: 0, output: 0 }, 'gemini-3.6-flash-002', at)
    const base = computeCostUsd({ input: 1e6, cached: 0, output: 0 }, 'gemini-3.6-flash', at)
    expect(versioned).toBeCloseTo(base as number, 10)
  })
})

describe('formatUsd', () => {
  // The property, not a fixed string. The previous version of this test asserted
  // `formatUsd(0.0000021) === '$0.0000'` — locking in the exact failure the function exists
  // to prevent, because a row of zeros claims the call was free just as loudly as "$0.00".
  it('never renders a non-zero cost as all zeros', () => {
    for (const usd of [0.0000021, 1e-9, 2.1e-6, 0.0001, 0.0099, 0.00000004]) {
      const out = formatUsd(usd)
      expect(out, `formatUsd(${usd}) = ${out}`).toMatch(/[1-9]/)
    }
  })

  it('scales precision to the magnitude below one cent', () => {
    expect(formatUsd(0.0021)).toBe('$0.0021')
    expect(formatUsd(0.0099)).toBe('$0.0099')
    expect(formatUsd(0.0000021)).toBe('$0.0000021')
  })

  it('states a bound rather than zeros below the display floor', () => {
    expect(formatUsd(1e-14)).toBe('< $0.0000000001')
  })

  it('returns a dash for a non-finite value instead of "$NaN"', () => {
    expect(formatUsd(NaN)).toBe('—')
    expect(formatUsd(Infinity)).toBe('—')
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

describe('formatUsdAggregate', () => {
  // Tiles and totals want a floor, not precision: "$0.0083" in 30px type is noise.
  it('floors a sub-cent aggregate rather than showing its digits', () => {
    expect(formatUsdAggregate(0.0083)).toBe('< $0.01')
    expect(formatUsdAggregate(0.0000021)).toBe('< $0.01')
  })

  it('never claims a non-zero aggregate is zero', () => {
    expect(formatUsdAggregate(0.0083)).not.toBe('$0.00')
  })

  it('formats a real figure normally', () => {
    expect(formatUsdAggregate(13.021)).toBe('$13.02')
    expect(formatUsdAggregate(0)).toBe('$0.00')
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
