import { describe, expect, it } from 'vitest'

import { formatDigitInput, getAssetBreakdownEmptyText, getFundActorLabel, getFundContributorOptions } from './fund-ui'

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

describe('getFundContributorOptions', () => {
  const owner = 'owner-1'
  const share = (over: Partial<Parameters<typeof getFundContributorOptions>[0]['shares'][number]>) => ({
    owner_id: owner,
    member_id: 'member-1',
    member_email: 'friend@example.com',
    status: 'accepted' as const,
    ...over,
  })

  it('lists the owner first, then every accepted co-manager', () => {
    expect(getFundContributorOptions({
      shares: [share({}), share({ member_id: 'member-2', member_email: 'second@example.com' })],
      userId: owner,
      selfLabel: 'Văn Hưng',
    })).toEqual(['Văn Hưng', 'friend@example.com', 'second@example.com'])
  })

  it('returns nothing when the owner has no accepted co-manager', () => {
    expect(getFundContributorOptions({
      shares: [share({ status: 'pending' }), share({ member_id: 'member-3', status: 'revoked' })],
      userId: owner,
      selfLabel: 'Văn Hưng',
    })).toEqual([])
  })

  it('returns nothing for a member browsing a fund owned by someone else', () => {
    expect(getFundContributorOptions({
      shares: [share({})],
      userId: 'member-1',
      selfLabel: 'friend@example.com',
    })).toEqual([])
  })

  it('drops duplicated co-manager emails and blank labels', () => {
    expect(getFundContributorOptions({
      shares: [share({}), share({ member_id: 'member-2', member_email: 'friend@example.com' }), share({ member_id: 'member-4', member_email: '  ' })],
      userId: owner,
      selfLabel: '  Văn Hưng  ',
    })).toEqual(['Văn Hưng', 'friend@example.com'])
  })

  it('returns nothing when the signed-in user is unknown', () => {
    expect(getFundContributorOptions({ shares: [share({})], userId: null, selfLabel: 'Văn Hưng' })).toEqual([])
  })
})

describe('getFundActorLabel', () => {
  it('maps a known account to its display alias', () => {
    expect(getFundActorLabel('nvhug001@gmail.com')).toBe('Văn Hưng')
    expect(getFundActorLabel('vanhung12501@yahoo.com')).toBe('Hồ Thủy')
  })

  it('matches aliases regardless of casing and surrounding spaces', () => {
    expect(getFundActorLabel('  VanHung12501@Yahoo.com  ')).toBe('Hồ Thủy')
  })

  it('returns the original value untouched when no alias exists', () => {
    expect(getFundActorLabel('someone@example.com')).toBe('someone@example.com')
    expect(getFundActorLabel('')).toBe('')
  })
})
