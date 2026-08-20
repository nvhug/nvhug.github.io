export const PLANS = [
  {
    id: '1m' as const,
    label: '1 tháng',
    months: 1,
    price: 30_000,
    priceLabel: '30,000đ',
    perMonth: '30,000đ/tháng',
    badge: null as string | null,
    savePct: null as number | null,
  },
  {
    id: '6m' as const,
    label: '6 tháng',
    months: 6,
    price: 150_000,
    priceLabel: '150,000đ',
    perMonth: '25,000đ/tháng',
    badge: 'Phổ biến',
    savePct: 17,
  },
  {
    id: '1y' as const,
    label: '1 năm',
    months: 12,
    price: 250_000,
    priceLabel: '250,000đ',
    perMonth: '20,833đ/tháng',
    badge: 'Tiết kiệm nhất',
    savePct: 31,
  },
] as const

export type PlanId = (typeof PLANS)[number]['id']
export type Plan = (typeof PLANS)[number]

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id) as Plan | undefined
}

/** Transfer note format: NOTEVIET EMAILPREFIX PLANID */
export function buildTransferNote(email: string, planId: PlanId): string {
  const prefix = email
    .split('@')[0]
    .slice(0, 10)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return `NOTEVIET ${prefix} ${planId.toUpperCase()}`
}

export function buildVietQRUrl(
  bankId: string,
  accountNo: string,
  accountName: string,
  amount: number,
  addInfo: string,
): string {
  const params = new URLSearchParams({ amount: String(amount), addInfo, accountName })
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?${params}`
}

/** Read payment bank config from NEXT_PUBLIC_ env vars. */
export function getPaymentConfig() {
  return {
    bankId: process.env.NEXT_PUBLIC_PAYMENT_BANK_ID ?? '',
    accountNo: process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_NO ?? '',
    accountName: process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME ?? '',
  }
}

export function isPaymentConfigured(): boolean {
  const c = getPaymentConfig()
  return !!(c.bankId && c.accountNo && c.accountName)
}
