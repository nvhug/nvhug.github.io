export type FundTransactionDeltaType = 'in' | 'out' | 'convert'

export type FundTransactionDeltaRecord = {
  type: FundTransactionDeltaType
  amount: number
  asset_id: string | null
  dest_asset_id: string | null
}

export type AssetDeltaInstruction = {
  assetId: string
  delta: number
  floorAtZero: boolean
}

export function buildTransactionDeltaMap(input: {
  transactionType: FundTransactionDeltaType
  amount: number
  srcId: string
  dstId?: string
  previousTransaction?: FundTransactionDeltaRecord | null
}) {
  const deltas = new Map<string, number>()
  const add = (id: string, delta: number) => deltas.set(id, (deltas.get(id) ?? 0) + delta)

  if (input.previousTransaction?.asset_id) {
    add(
      input.previousTransaction.asset_id,
      input.previousTransaction.type === 'in' ? -Number(input.previousTransaction.amount) : Number(input.previousTransaction.amount)
    )
  }

  if (input.previousTransaction?.dest_asset_id) {
    add(input.previousTransaction.dest_asset_id, -Number(input.previousTransaction.amount))
  }

  if (input.transactionType === 'convert') {
    if (input.srcId) add(input.srcId, -input.amount)
    if (input.dstId) add(input.dstId, input.amount)
    return deltas
  }

  if (input.srcId) {
    add(input.srcId, input.transactionType === 'in' ? input.amount : -input.amount)
  }

  return deltas
}

export function buildTransactionDeleteAdjustments(transaction: FundTransactionDeltaRecord): AssetDeltaInstruction[] {
  const adjustments: AssetDeltaInstruction[] = []

  if (transaction.asset_id) {
    adjustments.push({
      assetId: transaction.asset_id,
      delta: transaction.type === 'in' ? -Number(transaction.amount) : Number(transaction.amount),
      floorAtZero: transaction.type === 'in',
    })
  }

  if (transaction.dest_asset_id) {
    adjustments.push({
      assetId: transaction.dest_asset_id,
      delta: -Number(transaction.amount),
      floorAtZero: true,
    })
  }

  return adjustments
}