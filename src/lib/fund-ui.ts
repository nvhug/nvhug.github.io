export function formatDigitInput(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return new Intl.NumberFormat('vi-VN').format(Number(digits))
}

export function getAssetBreakdownEmptyText(options: { hasTransactions: boolean; vi: boolean }) {
  if (options.hasTransactions) {
    return options.vi ? 'Chưa có tài sản để phân bổ.' : 'No assets available for allocation yet.'
  }

  return options.vi ? 'Chưa có tài sản.' : 'No assets yet.'
}

// The owner of a shared fund records money that a co-manager contributed, so `who` must be selectable
export function getFundContributorOptions(options: {
  shares: { owner_id: string; member_id: string; member_email: string; status: string }[]
  userId: string | null
  selfLabel: string
}) {
  const { shares, userId, selfLabel } = options
  if (!userId) return []

  const isMemberElsewhere = shares.some((share) => share.member_id === userId && share.status === 'accepted')
  if (isMemberElsewhere) return []

  const coManagers = shares
    .filter((share) => share.owner_id === userId && share.status === 'accepted')
    .map((share) => share.member_email.trim())
    .filter(Boolean)

  const unique = [...new Set(coManagers)]
  if (unique.length === 0) return []

  return [selfLabel.trim(), ...unique]
}

// `fund_transactions.who` stores whatever label the account had when the row was written,
// so renamed or shared accounts get a stable display name here instead
const FUND_ACTOR_ALIASES: Record<string, string> = {
  'nvhug001@gmail.com': 'Văn Hưng',
  'vanhung12501@yahoo.com': 'Hồ Thủy',
}

export function getFundActorLabel(value: string) {
  return FUND_ACTOR_ALIASES[value.trim().toLowerCase()] ?? value
}
