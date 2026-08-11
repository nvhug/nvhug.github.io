import type { Metadata } from 'next'
import FundFutureClient from './FundFutureClient'

export const metadata: Metadata = {
  title: 'Quỹ Tương Lai',
  description: 'Trang quỹ chung cho đầu tư, dự phòng, nợ vay và phân tích tài sản.',
}

export default function Home() {
  return <FundFutureClient />
}
