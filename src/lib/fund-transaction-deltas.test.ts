import { describe, expect, it } from 'vitest'

import { buildTransactionDeleteAdjustments, buildTransactionDeltaMap } from './fund-transaction-deltas'

function mapToObject(map: Map<string, number>) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

describe('fund transaction deltas', () => {
  it('adds money-in amount to the selected asset', () => {
    const deltas = buildTransactionDeltaMap({
      transactionType: 'in',
      amount: 40000,
      srcId: 'asset-main',
    })

    expect(mapToObject(deltas)).toEqual({ 'asset-main': 40000 })
  })

  it('subtracts money-out amount from the selected asset', () => {
    const deltas = buildTransactionDeltaMap({
      transactionType: 'out',
      amount: 15000,
      srcId: 'asset-main',
    })

    expect(mapToObject(deltas)).toEqual({ 'asset-main': -15000 })
  })

  it('moves value between assets for convert transactions', () => {
    const deltas = buildTransactionDeltaMap({
      transactionType: 'convert',
      amount: 250000,
      srcId: 'bank',
      dstId: 'gold',
    })

    expect(mapToObject(deltas)).toEqual({ bank: -250000, gold: 250000 })
  })

  it('reverses the previous transaction before applying an edited replacement', () => {
    const deltas = buildTransactionDeltaMap({
      transactionType: 'out',
      amount: 40000,
      srcId: 'asset-main',
      previousTransaction: {
        type: 'in',
        amount: 100000,
        asset_id: 'asset-main',
        dest_asset_id: null,
      },
    })

    expect(mapToObject(deltas)).toEqual({ 'asset-main': -140000 })
  })

  it('builds delete adjustments for money-in with floor-at-zero protection', () => {
    expect(
      buildTransactionDeleteAdjustments({
        type: 'in',
        amount: 40000,
        asset_id: 'asset-main',
        dest_asset_id: null,
      })
    ).toEqual([
      { assetId: 'asset-main', delta: -40000, floorAtZero: true },
    ])
  })

  it('builds delete adjustments for convert transactions on both source and destination assets', () => {
    expect(
      buildTransactionDeleteAdjustments({
        type: 'convert',
        amount: 200000,
        asset_id: 'bank',
        dest_asset_id: 'gold',
      })
    ).toEqual([
      { assetId: 'bank', delta: 200000, floorAtZero: false },
      { assetId: 'gold', delta: -200000, floorAtZero: true },
    ])
  })
})