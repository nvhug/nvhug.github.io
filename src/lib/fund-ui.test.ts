import { describe, expect, it } from 'vitest'

import { formatDigitInput, getAssetBreakdownEmptyText } from './fund-ui'

describe('fund-ui helpers', () => {
  it('formats digit-only strings for display without changing stored digits', () => {
    expect(formatDigitInput('5000000')).toBe('5.000.000')
    expect(formatDigitInput('')).toBe('')
  })

  it('uses neutral empty-state copy when transactions exist but no assets are available', () => {
    expect(getAssetBreakdownEmptyText({ hasTransactions: true, vi: true })).toBe('Chưa có tài sản để phân bổ.')
    expect(getAssetBreakdownEmptyText({ hasTransactions: true, vi: false })).toBe('No assets available for allocation yet.')
  })

  it('keeps the basic empty-state copy when there are no assets and no transactions', () => {
    expect(getAssetBreakdownEmptyText({ hasTransactions: false, vi: true })).toBe('Chưa có tài sản.')
    expect(getAssetBreakdownEmptyText({ hasTransactions: false, vi: false })).toBe('No assets yet.')
  })
})