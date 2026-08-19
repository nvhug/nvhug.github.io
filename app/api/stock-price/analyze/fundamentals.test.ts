import { describe, expect, it } from 'vitest'
import { assetQualityScoreFromNpl, snapshotFromVietcapRatios } from './fundamentals'

describe('Vietcap financial snapshot', () => {
  it('uses the newest reporting quarter and derives asset quality only from NPL', () => {
    const snapshot = snapshotFromVietcapRatios([
      { yearReport: 2025, quarter: 4, pe: 10, npl: 0.02 },
      { yearReport: 2026, quarter: 2, pe: 8.1, pb: 1.2, roe: 0.147, roa: 0.022, netInterestMargin: 0.036, npl: 0.0108 },
    ])

    expect(snapshot).toMatchObject({ reportPeriod: '2026-Q2', pe: 8.1, nplPct: 1.08, assetQualityScore: 8 })
  })

  it('does not create an asset-quality score when NPL is unavailable', () => {
    expect(assetQualityScoreFromNpl(null)).toBeNull()
  })
})