import type { Metadata } from 'next'
import FundFutureClient from '../FundFutureClient'

export const metadata: Metadata = {
  title: 'Sổ tài chính',
  description: 'Quản lý tài sản, dòng tiền, đầu tư và quỹ chung.',
}

export default function FinancePage() {
  return <FundFutureClient />
}